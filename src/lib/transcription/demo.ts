import { DEMO_TRANSCRIPT } from "@/lib/demo/meeting";
import type { Transcript } from "@/lib/supabase/types";
import type { TranscriptionProvider } from "./types";

/** Devuelve la transcripción de la reunión de ejemplo. Sin red, sin claves. */
export const demoProvider: TranscriptionProvider = {
  name: "demo",
  async transcribe(): Promise<Transcript> {
    return structuredClone(DEMO_TRANSCRIPT);
  },
};
