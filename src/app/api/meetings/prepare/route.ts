import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { z } from "zod";
import { ensureUser } from "@/lib/auth/ensure-user";
import { checkCanCreateMeeting } from "@/lib/meetings/limits";
import { isAcceptedFile } from "@/lib/meetings/validate";
import { todayISO } from "@/lib/format";

const Body = z.object({
  filename: z.string().min(1).max(300),
  mime: z.string().max(100).nullable().optional(),
  size: z.number().int().positive(),
  durationSec: z.number().positive().nullable().optional(),
  meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hint: z.string().max(300).nullable().optional(),
});

/** Crea la reunión y devuelve una URL firmada para subir el audio directo a Storage. */
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase no está configurado (ver README)." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const body = parsed.data;

  const check = isAcceptedFile(body.filename, body.mime, body.size);
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: 400 });

  let session: Awaited<ReturnType<typeof ensureUser>>;
  try {
    session = await ensureUser();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo iniciar sesión" }, { status: 500 });
  }
  const { supabase, user } = session;
  const limit = await checkCanCreateMeeting(supabase, user, { durationSec: body.durationSec ?? null });
  if (!limit.ok) return NextResponse.json({ error: limit.message, code: limit.code }, { status: limit.status });

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      status: "uploading",
      audio_mime: body.mime ?? null,
      duration_sec: body.durationSec ? Math.round(body.durationSec) : null,
      meeting_date: body.meetingDate ?? todayISO(),
      hint: body.hint?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !meeting) return NextResponse.json({ error: error?.message ?? "No se pudo crear la reunión" }, { status: 500 });

  const path = `${user.id}/${meeting.id}.${check.ext}`;
  const { data: signed, error: signError } = await supabase.storage.from("audio").createSignedUploadUrl(path);
  if (signError || !signed) {
    return NextResponse.json({ error: `No se pudo preparar la subida: ${signError?.message}` }, { status: 500 });
  }
  await supabase.from("meetings").update({ audio_path: path }).eq("id", meeting.id);

  return NextResponse.json({ meetingId: meeting.id, path, token: signed.token, signedUrl: signed.signedUrl });
}
