import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMeetingBundle } from "@/lib/meetings/queries";

/** La reunión completa en JSON (misma RLS que la pantalla). Útil para pruebas y automatizaciones. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const bundle = await getMeetingBundle(supabase, id);
  if (!bundle) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const { transcript, raw_extraction, ...meeting } = bundle.meeting;
  void transcript;
  const extraction_model = (raw_extraction as { model?: string } | null)?.model ?? null;
  return NextResponse.json({ ...bundle, meeting: { ...meeting, extraction_model } }, { headers: { "Cache-Control": "no-store" } });
}
