import { env } from "@/lib/env";
import { deepgramProvider } from "./deepgram";
import { demoProvider } from "./demo";
import type { TranscriptionProvider } from "./types";

export { TranscriptionError } from "./types";

/** Elige el proveedor: demo para la reunión de ejemplo, Deepgram para el resto. */
export function getTranscriptionProvider(opts: { isDemo: boolean }): TranscriptionProvider {
  if (opts.isDemo) return demoProvider;
  if (!env.deepgramApiKey) {
    throw new Error("No hay proveedor de transcripción configurado (DEEPGRAM_API_KEY).");
  }
  return deepgramProvider;
}

export function hasTranscriptionProvider() {
  return Boolean(env.deepgramApiKey);
}
