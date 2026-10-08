import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const maxDuration = 120;

/**
 * Borra las grabaciones que han superado la retención de cada usuario (regla 11).
 * Lo lanza el cron de Vercel (vercel.json) con Authorization: Bearer CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: profiles } = await admin.from("profiles").select("id, audio_retention_days").limit(5000);
  let deleted = 0;
  for (const p of profiles ?? []) {
    const cutoff = new Date(Date.now() - p.audio_retention_days * 86400000).toISOString();
    const { data: meetings } = await admin
      .from("meetings")
      .select("id, audio_path")
      .eq("user_id", p.id)
      .is("audio_deleted_at", null)
      .not("audio_path", "is", null)
      .lt("created_at", cutoff)
      .limit(200);
    if (!meetings?.length) continue;
    const paths = meetings.map((m) => m.audio_path as string);
    const { error } = await admin.storage.from("audio").remove(paths);
    if (error) continue;
    await admin
      .from("meetings")
      .update({ audio_deleted_at: new Date().toISOString() })
      .in(
        "id",
        meetings.map((m) => m.id),
      );
    deleted += meetings.length;
  }
  return NextResponse.json({ deleted });
}
