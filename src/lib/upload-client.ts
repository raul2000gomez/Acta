"use client";

/** Lógica de subida en el navegador: duración, URL firmada, progreso real y arranque. */

export type UploadProgress = { phase: "preparing" | "uploading" | "starting"; percent: number };

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/** Lee la duración del archivo con un elemento <audio>/<video> sin descargarlo entero. */
export function readMediaDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const isVideo = file.type.startsWith("video/");
    const el = document.createElement(isVideo ? "video" : "audio");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 8000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = el.duration;
      // Algunos webm grabados en el navegador devuelven Infinity: lo dejamos en null.
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    el.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    el.src = url;
  });
}

async function parseError(res: Response) {
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  return new UploadError(data.error ?? `Error ${res.status}`, data.code, res.status);
}

function putWithProgress(signedUrl: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError(`La subida falló (${xhr.status}). Inténtalo de nuevo.`));
    };
    xhr.onerror = () => reject(new UploadError("Se perdió la conexión durante la subida."));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

export async function uploadMeetingFile(
  file: File,
  opts: { hint?: string; onProgress: (p: UploadProgress) => void },
): Promise<{ meetingId: string }> {
  opts.onProgress({ phase: "preparing", percent: 0 });
  const durationSec = await readMediaDuration(file);
  const lastModified = file.lastModified ? new Date(file.lastModified) : new Date();
  const meetingDate = new Date(lastModified.getTime() - lastModified.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const prep = await fetch("/api/meetings/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name || "grabacion",
      mime: file.type || null,
      size: file.size,
      durationSec,
      meetingDate,
      hint: opts.hint ?? null,
    }),
  });
  if (!prep.ok) throw await parseError(prep);
  const { meetingId, signedUrl } = (await prep.json()) as { meetingId: string; signedUrl: string };

  opts.onProgress({ phase: "uploading", percent: 0 });
  await putWithProgress(signedUrl, file, (percent) => opts.onProgress({ phase: "uploading", percent }));

  opts.onProgress({ phase: "starting", percent: 100 });
  const start = await fetch(`/api/meetings/${meetingId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSec }),
  });
  if (!start.ok) throw await parseError(start);
  return { meetingId };
}

export async function createMeetingFromLink(url: string, hint?: string): Promise<{ meetingId: string }> {
  const res = await fetch("/api/meetings/from-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, hint: hint ?? null }),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { meetingId: string };
}

export async function createDemoMeeting(): Promise<{ meetingId: string }> {
  const res = await fetch("/api/meetings/demo", { method: "POST" });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as { meetingId: string };
}
