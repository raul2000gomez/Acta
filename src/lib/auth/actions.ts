"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export type AuthResult = { ok: true; message: string } | { ok: false; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : env.appUrl;
}

/**
 * Pide el email y manda un enlace mágico. Si el usuario es anónimo, se vincula
 * el email a su mismo id (no se pierde nada de lo procesado). Si el email ya
 * tiene cuenta, se le manda un enlace para entrar en ella.
 */
export async function requestEmailLink(rawEmail: string, next = "/app"): Promise<AuthResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Ese email no parece válido." };

  const supabase = await createClient();
  const redirectTo = `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.is_anonymous) {
    const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
    if (!error) {
      return { ok: true, message: `Te hemos enviado un enlace a ${email}. Ábrelo y seguimos donde estábamos.` };
    }
    // Si el email ya tiene cuenta, entramos en ella.
    const alreadyUsed = /already|registered|exists|taken/i.test(error.message);
    if (!alreadyUsed) return { ok: false, message: error.message };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: `Te hemos enviado un enlace a ${email}. Ábrelo para entrar.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
