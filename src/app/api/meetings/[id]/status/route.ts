import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Estado de procesado para la barra de progreso. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id, status, error, duration_sec, phase_timings, title")
    .eq("id", id)
    .maybeSingle();
  if (!meeting) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json(meeting, { headers: { "Cache-Control": "no-store" } });
}
