import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Redirige a una URL firmada del audio (1 hora) para reproducir el fragmento de la prueba. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: meeting } = await supabase.from("meetings").select("audio_path, audio_deleted_at").eq("id", id).maybeSingle();
  if (!meeting?.audio_path || meeting.audio_deleted_at) return NextResponse.json({ error: "Sin audio" }, { status: 404 });
  const { data, error } = await supabase.storage.from("audio").createSignedUrl(meeting.audio_path, 3600);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "No se pudo firmar" }, { status: 500 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, max-age=3000" } });
}
