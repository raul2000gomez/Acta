import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Meeting, PhaseTimings, Transcript } from "@/lib/supabase/types";
import { getTranscriptionProvider, TranscriptionError } from "@/lib/transcription";
import { extract, ExtractionError } from "@/lib/ai/extract";
import type { UserContext } from "@/lib/ai/prompt";
import { persistExtraction } from "./persist";
import { sendEmail } from "@/lib/email/resend";
import { env } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/config";

/** Ejecuta un paso con nombre. Inngest lo memoriza y reintenta; en línea, simplemente lo ejecuta. */
export type StepRunner = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

export const inlineRunner: StepRunner = (_name, fn) => fn();

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

function extFromMime(mime: string | null | undefined) {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/webm": "webm",
    "audio/aac": "aac",
    "audio/flac": "flac",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  return (mime && map[mime.split(";")[0]]) || "bin";
}

/** Convierte enlaces compartidos de Google Drive en descarga directa. */
export function normalizeSourceUrl(raw: string) {
  const drive = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/) ?? raw.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  return raw;
}

async function loadMeeting(meetingId: string): Promise<Meeting> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("meetings").select("*").eq("id", meetingId).single();
  if (error || !data) throw new PipelineError(`Reunión ${meetingId} no encontrada`, false);
  return data as Meeting;
}

async function patchMeeting(meetingId: string, patch: Partial<Meeting>) {
  const admin = createAdminClient();
  const { error } = await admin.from("meetings").update(patch).eq("id", meetingId);
  if (error) throw new PipelineError(`No se pudo actualizar la reunión: ${error.message}`, true);
}

async function addTiming(meeting: Meeting, key: keyof PhaseTimings, ms: number) {
  const timings: PhaseTimings = { ...(meeting.phase_timings ?? {}), [key]: Math.round(ms) };
  await patchMeeting(meeting.id, { phase_timings: timings });
  return timings;
}

export async function markFailed(meetingId: string, message: string) {
  const admin = createAdminClient();
  await admin.from("meetings").update({ status: "failed", error: message.slice(0, 500) }).eq("id", meetingId);
}

/**
 * De la grabación al resultado: enlace → audio en Storage → transcripción →
 * extracción → tablas → aviso. Cada paso relee la reunión de la base de datos
 * para que un reintento no dependa de memoria.
 */
export async function runPipeline(meetingId: string, run: StepRunner) {
  const admin = createAdminClient();

  // 0. Si vino por enlace, descargar el archivo a Storage.
  await run("fetch-link", async () => {
    const meeting = await loadMeeting(meetingId);
    if (meeting.is_demo || meeting.audio_path || !meeting.source_url) return { skipped: true };
    const url = normalizeSourceUrl(meeting.source_url);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new PipelineError(`No se pudo descargar el enlace (${res.status}).`, false);
    const mime = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
    if (mime.startsWith("text/html")) {
      throw new PipelineError("El enlace abre una página web, no un archivo de audio o vídeo. Descárgalo y súbelo.", false);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `${meeting.user_id}/${meeting.id}.${extFromMime(mime)}`;
    const { error } = await admin.storage.from("audio").upload(path, buffer, { contentType: mime, upsert: true });
    if (error) throw new PipelineError(`No se pudo guardar el audio: ${error.message}`, true);
    await patchMeeting(meetingId, { audio_path: path, audio_mime: mime });
    return { path };
  });

  // 1. Transcribir
  await run("transcribe", async () => {
    const meeting = await loadMeeting(meetingId);
    if (meeting.transcript && meeting.status !== "uploaded" && meeting.status !== "transcribing") return { skipped: true };
    const started = Date.now();
    await patchMeeting(meetingId, {
      status: "transcribing",
      error: null,
      phase_timings: { ...(meeting.phase_timings ?? {}), started_at: new Date().toISOString() },
    });

    let transcript: Transcript;
    try {
      const provider = getTranscriptionProvider({ isDemo: meeting.is_demo });
      if (meeting.is_demo) {
        transcript = await provider.transcribe({ url: "" });
      } else {
        if (!meeting.audio_path) throw new PipelineError("La reunión no tiene audio.", false);
        const { data, error } = await admin.storage.from("audio").createSignedUrl(meeting.audio_path, 60 * 60);
        if (error || !data) throw new PipelineError(`No se pudo firmar la URL del audio: ${error?.message}`, true);
        transcript = await provider.transcribe({ url: data.signedUrl, mime: meeting.audio_mime });
      }
    } catch (err) {
      if (err instanceof TranscriptionError) throw new PipelineError(err.message, err.retriable);
      throw err;
    }

    if (transcript.segments.length === 0) {
      throw new PipelineError("No se ha detectado voz en la grabación. Comprueba el archivo.", false);
    }

    await patchMeeting(meetingId, {
      transcript,
      language: transcript.language ?? meeting.language,
      duration_sec: meeting.duration_sec ?? transcript.duration_sec,
    });
    await addTiming({ ...meeting, phase_timings: { ...(meeting.phase_timings ?? {}), started_at: new Date(started).toISOString() } }, "transcribe", Date.now() - started);
    return { segments: transcript.segments.length };
  });

  // 2. Extraer con Claude
  await run("extract", async () => {
    const meeting = await loadMeeting(meetingId);
    if (!meeting.transcript) throw new PipelineError("Falta la transcripción.", true);
    const started = Date.now();
    await patchMeeting(meetingId, { status: "extracting" });

    const [{ data: profile }, { data: contacts }, { data: previous }] = await Promise.all([
      admin.from("profiles").select("*").eq("id", meeting.user_id).maybeSingle(),
      admin.from("contacts").select("name, role, email").eq("user_id", meeting.user_id).order("times_seen", { ascending: false }).limit(40),
      admin
        .from("meetings")
        .select("meeting_date, title, summary")
        .eq("user_id", meeting.user_id)
        .eq("status", "ready")
        .neq("id", meeting.id)
        .order("meeting_date", { ascending: false })
        .limit(5),
    ]);

    const context: UserContext = {
      userName: profile?.full_name ?? null,
      company: profile?.company ?? null,
      phone: profile?.phone ?? null,
      signature: profile?.signature ?? null,
      locale: profile?.locale ?? "es",
      meetingDate: meeting.meeting_date,
      hint: meeting.hint,
      knownContacts: contacts ?? [],
      previousMeetings: (previous ?? []).map((m) => ({ date: m.meeting_date, title: m.title, summary: m.summary })),
    };

    let result;
    try {
      result = await extract({ context, segments: meeting.transcript.segments, isDemo: meeting.is_demo });
    } catch (err) {
      if (err instanceof ExtractionError) throw new PipelineError(err.message, err.retriable);
      throw err;
    }

    await patchMeeting(meetingId, {
      raw_extraction: { model: result.model, usage: result.usage, extraction: result.extraction },
      cost_cents: result.costCents,
    });
    await addTiming(meeting, "extract", Date.now() - started);
    return { model: result.model };
  });

  // 3. Guardar en tablas
  await run("persist", async () => {
    const meeting = await loadMeeting(meetingId);
    const raw = meeting.raw_extraction as { extraction?: Parameters<typeof persistExtraction>[2] } | null;
    if (!raw?.extraction) throw new PipelineError("Falta la extracción.", true);
    const started = Date.now();
    await persistExtraction(admin, meeting, raw.extraction, meeting.transcript);
    const timings: PhaseTimings = {
      ...(meeting.phase_timings ?? {}),
      persist: Date.now() - started,
      finished_at: new Date().toISOString(),
    };
    await patchMeeting(meetingId, {
      status: "ready",
      error: null,
      title: meeting.title ?? raw.extraction.title,
      summary: raw.extraction.summary,
      language: raw.extraction.language,
      quality_warning: raw.extraction.quality_warning,
      phase_timings: timings,
    });
    return { ok: true };
  });

  // 4. Avisar por correo si el usuario tiene email
  await run("notify", async () => {
    const meeting = await loadMeeting(meetingId);
    const { data: profile } = await admin.from("profiles").select("email, full_name").eq("id", meeting.user_id).maybeSingle();
    if (!profile?.email) return { skipped: "sin email" };
    const link = `${env.appUrl}/app/r/${meeting.id}`;
    const { skipped } = await sendEmail({
      to: profile.email,
      subject: `Tu reunión está lista: ${meeting.title ?? "sin título"}`,
      text: `Hola${profile.full_name ? ` ${profile.full_name}` : ""}:\n\nYa tienes las tareas, decisiones y correos de «${meeting.title ?? "tu reunión"}».\n\n${link}\n\n${PRODUCT_NAME}`,
    });
    return { skipped };
  });
}
