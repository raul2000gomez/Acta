import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./types";

/**
 * Cliente con la clave secreta. Solo para el worker (cola), webhooks y crons,
 * donde no hay sesión de usuario. Nunca importar desde código de cliente.
 */
export function createAdminClient() {
  if (!env.supabaseSecretKey) {
    throw new Error("Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient<Database>(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
