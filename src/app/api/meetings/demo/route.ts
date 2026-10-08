import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { ensureUser } from "@/lib/auth/ensure-user";
import { dispatchProcessing } from "@/lib/pipeline/dispatch";
import { DEMO_HINT, DEMO_TRANSCRIPT } from "@/lib/demo/meeting";
import { todayISO } from "@/lib/format";

/** Crea la reunión de ejemplo del sector y la procesa (sin gastar transcripción ni tokens). */
export async function POST() {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase no está configurado (ver README)." }, { status: 503 });
  let session: Awaited<ReturnType<typeof ensureUser>>;
  try {
    session = await ensureUser();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo iniciar sesión" }, { status: 500 });
  }
  const { supabase, user } = session;

  const { data: existing } = await supabase
    .from("meetings")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && existing.status === "ready") {
    return NextResponse.json({ meetingId: existing.id, existing: true });
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      status: "uploaded",
      is_demo: true,
      hint: DEMO_HINT,
      duration_sec: DEMO_TRANSCRIPT.duration_sec,
      meeting_date: todayISO(),
    })
    .select("id")
    .single();
  if (error || !meeting) return NextResponse.json({ error: error?.message ?? "No se pudo crear el ejemplo" }, { status: 500 });

  const via = await dispatchProcessing(meeting.id, user.id);
  return NextResponse.json({ meetingId: meeting.id, via });
}
