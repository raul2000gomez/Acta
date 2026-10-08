import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchProcessing } from "@/lib/pipeline/dispatch";

/** Reintenta una reunión fallida. El audio sigue en Storage: nunca se pierde. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const { data: meeting } = await supabase.from("meetings").select("id, status, is_demo, audio_path, source_url").eq("id", id).maybeSingle();
  if (!meeting) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (!meeting.is_demo && !meeting.audio_path && !meeting.source_url) {
    return NextResponse.json({ error: "Esta reunión no tiene audio. Súbelo de nuevo." }, { status: 400 });
  }
  await supabase.from("meetings").update({ status: "uploaded", error: null }).eq("id", id);
  const via = await dispatchProcessing(id, user.id);
  return NextResponse.json({ ok: true, via });
}
