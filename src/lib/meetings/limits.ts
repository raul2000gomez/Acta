import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ANON_MAX_AUDIO_SECONDS, ANON_MAX_MEETINGS, FREE_MEETINGS } from "@/lib/config";
import type { Database } from "@/lib/supabase/types";

export type LimitCheck =
  | { ok: true }
  | { ok: false; status: number; code: "signup_required" | "upgrade_required"; message: string };

/**
 * Reglas de acceso:
 * - Sin cuenta (anónimo): una reunión de hasta 30 minutos. Después, pedir el email.
 * - Plan gratis: 3 reuniones. Después, plan Pro.
 * La reunión de ejemplo nunca cuenta.
 */
export async function checkCanCreateMeeting(
  supabase: SupabaseClient<Database>,
  user: User,
  opts: { durationSec?: number | null; isDemo?: boolean },
): Promise<LimitCheck> {
  if (opts.isDemo) return { ok: true };

  if (user.is_anonymous) {
    if (opts.durationSec && opts.durationSec > ANON_MAX_AUDIO_SECONDS) {
      return {
        ok: false,
        status: 401,
        code: "signup_required",
        message: "Sin cuenta puedes probar con una grabación de hasta 30 minutos. Déjanos tu email para procesar esta.",
      };
    }
    const { count } = await supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_demo", false);
    if ((count ?? 0) >= ANON_MAX_MEETINGS) {
      return {
        ok: false,
        status: 401,
        code: "signup_required",
        message: "Ya has probado con una reunión. Déjanos tu email para guardar esta y las siguientes.",
      };
    }
    return { ok: true };
  }

  const { data: profile } = await supabase.from("profiles").select("plan, meetings_used").eq("id", user.id).maybeSingle();
  if (profile && profile.plan === "free" && profile.meetings_used >= FREE_MEETINGS) {
    return {
      ok: false,
      status: 402,
      code: "upgrade_required",
      message: `Has usado las ${FREE_MEETINGS} reuniones gratis. Con el plan Pro no hay límite.`,
    };
  }
  return { ok: true };
}
