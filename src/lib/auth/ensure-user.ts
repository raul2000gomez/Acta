import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Devuelve el usuario actual o crea una sesión anónima (regla 2: la primera
 * reunión no pide registro). Solo desde Route Handlers o Server Actions,
 * que pueden escribir cookies.
 */
export async function ensureUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { supabase, user };

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `No se pudo iniciar una sesión anónima${error ? `: ${error.message}` : ""}. Activa «Anonymous sign-ins» en Supabase › Authentication.`,
    );
  }
  return { supabase, user: data.user };
}
