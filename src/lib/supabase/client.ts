"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "./types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente de Supabase para componentes de cliente (singleton). */
export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey);
  }
  return browserClient;
}
