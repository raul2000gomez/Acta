import type { Transcript } from "@/lib/supabase/types";

export type TranscribeInput = {
  /** URL firmada desde la que el proveedor descarga el audio (la app siempre usa esta vía). */
  url?: string;
  /** Alternativa a `url`: el audio en memoria. Lo usa la prueba sin app (`smoke:real -- --sin-app`). */
  bytes?: Uint8Array;
  mime?: string | null;
  /** Pista de idioma (es, ca, en) si se conoce. */
  languageHint?: string | null;
};

export class TranscriptionError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export type TranscriptionProvider = {
  name: string;
  transcribe(input: TranscribeInput): Promise<Transcript>;
};
