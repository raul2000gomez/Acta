import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dispatchProcessing } from "@/lib/pipeline/dispatch";

const Body = z.object({
  durationSec: z.number().positive().nullable().optional(),
});

/** El archivo ya está en Storage: marca la reunión como subida y lanza el procesado. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => ({})));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const { data: meeting } = await supabase.from("meetings").select("id, status, duration_sec").eq("id", id).maybeSingle();
  if (!meeting) return NextResponse.json({ error: "Reunión no encontrada" }, { status: 404 });
  if (meeting.status !== "uploading") return NextResponse.json({ ok: true, status: meeting.status });

  const durationSec = body.success && body.data.durationSec ? Math.round(body.data.durationSec) : meeting.duration_sec;
  const { error } = await supabase.from("meetings").update({ status: "uploaded", duration_sec: durationSec }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const via = await dispatchProcessing(id, user.id);
  return NextResponse.json({ ok: true, via });
}
