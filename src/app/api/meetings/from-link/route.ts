import { NextResponse } from "next/server";
import { hasSupabase } from "@/lib/env";
import { z } from "zod";
import { ensureUser } from "@/lib/auth/ensure-user";
import { checkCanCreateMeeting } from "@/lib/meetings/limits";
import { dispatchProcessing } from "@/lib/pipeline/dispatch";
import { todayISO } from "@/lib/format";

const Body = z.object({
  url: z.string().url().max(2000),
  hint: z.string().max(300).nullable().optional(),
});

/** Reunión a partir de un enlace a un archivo (Drive, descarga directa…). */
export async function POST(req: Request) {
  if (!hasSupabase()) return NextResponse.json({ error: "Supabase no está configurado (ver README)." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pega un enlace completo (https://…)" }, { status: 400 });
  const { url, hint } = parsed.data;
  if (!/^https?:\/\//i.test(url)) return NextResponse.json({ error: "El enlace debe empezar por http o https" }, { status: 400 });

  let session: Awaited<ReturnType<typeof ensureUser>>;
  try {
    session = await ensureUser();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo iniciar sesión" }, { status: 500 });
  }
  const { supabase, user } = session;
  const limit = await checkCanCreateMeeting(supabase, user, {});
  if (!limit.ok) return NextResponse.json({ error: limit.message, code: limit.code }, { status: limit.status });

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({ user_id: user.id, status: "uploaded", source_url: url, hint: hint?.trim() || null, meeting_date: todayISO() })
    .select("id")
    .single();
  if (error || !meeting) return NextResponse.json({ error: error?.message ?? "No se pudo crear la reunión" }, { status: 500 });

  const via = await dispatchProcessing(meeting.id, user.id);
  return NextResponse.json({ meetingId: meeting.id, via });
}
