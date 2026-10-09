import { env } from "@/lib/env";
import type { Transcript, TranscriptSegment } from "@/lib/supabase/types";
import { TranscriptionError, type TranscribeInput, type TranscriptionProvider } from "./types";
import { SECTOR_KEYTERMS } from "./keyterms";

type DeepgramUtterance = { start: number; end: number; transcript: string; speaker?: number };
type DeepgramResponse = {
  metadata?: { duration?: number };
  results?: {
    utterances?: DeepgramUtterance[];
    channels?: { detected_language?: string; alternatives?: { transcript?: string }[] }[];
  };
};

/**
 * Deepgram por URL (el servicio descarga el audio desde la URL firmada de Storage)
 * o con el audio en el cuerpo de la petición (prueba sin app).
 * nova-3 cubre español, catalán e inglés; detect_language elige el dominante.
 */
export const deepgramProvider: TranscriptionProvider = {
  name: "deepgram",
  async transcribe(input: TranscribeInput): Promise<Transcript> {
    if (!env.deepgramApiKey) {
      throw new TranscriptionError("Falta DEEPGRAM_API_KEY", false);
    }
    const params = new URLSearchParams({
      model: process.env.DEEPGRAM_MODEL ?? "nova-3",
      diarize: "true",
      utterances: "true",
      smart_format: "true",
      punctuate: "true",
    });
    if (input.languageHint) params.set("language", input.languageHint);
    else params.set("detect_language", "true");

    if (!input.bytes && !input.url) {
      throw new TranscriptionError("No hay audio que transcribir (ni URL ni bytes).", false);
    }
    // Vocabulario del sector (keyterm): mejora términos como «IBI» o «arras». Desactivable con DEEPGRAM_KEYTERMS=off.
    const useKeyterms = process.env.DEEPGRAM_KEYTERMS !== "off";
    if (useKeyterms) for (const term of SECTOR_KEYTERMS) params.append("keyterm", term);

    // Por URL (la app: Deepgram descarga desde Storage) o con el audio en el cuerpo (prueba sin app).
    const request = (p: URLSearchParams) =>
      fetch(`https://api.deepgram.com/v1/listen?${p.toString()}`, {
        method: "POST",
        headers: {
          Authorization: `Token ${env.deepgramApiKey}`,
          "Content-Type": input.bytes ? (input.mime ?? "application/octet-stream") : "application/json",
        },
        body: input.bytes ? new Uint8Array(input.bytes) : JSON.stringify({ url: input.url }),
      });

    let res = await request(params);
    if (res.status === 400 && useKeyterms) {
      // Si este modelo o idioma no admite keyterm, se repite sin vocabulario en vez de fallar.
      const detail = await res.clone().text();
      if (/keyterm/i.test(detail)) {
        params.delete("keyterm");
        res = await request(params);
      }
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 400);
      const retriable = res.status === 429 || res.status >= 500;
      throw new TranscriptionError(`Deepgram respondió ${res.status}: ${text}`, retriable);
    }

    const json = (await res.json()) as DeepgramResponse;
    const utterances = json.results?.utterances ?? [];
    const channel = json.results?.channels?.[0];

    const segments: TranscriptSegment[] = [];
    for (const u of utterances) {
      const text = (u.transcript ?? "").trim();
      if (!text) continue;
      const speaker = `spk_${(u.speaker ?? 0) + 1}`;
      const last = segments[segments.length - 1];
      // Une frases seguidas del mismo hablante con menos de 1,5 s de silencio.
      if (last && last.speaker === speaker && u.start - last.end < 1.5 && last.text.length < 600) {
        last.text = `${last.text} ${text}`;
        last.end = u.end;
      } else {
        segments.push({ speaker, start: u.start, end: u.end, text });
      }
    }

    if (segments.length === 0) {
      const flat = channel?.alternatives?.[0]?.transcript?.trim();
      if (flat) segments.push({ speaker: "spk_1", start: 0, end: json.metadata?.duration ?? 0, text: flat });
    }

    return {
      provider: "deepgram",
      language: channel?.detected_language ?? input.languageHint ?? null,
      duration_sec: json.metadata?.duration != null ? Math.round(json.metadata.duration) : null,
      segments,
    };
  },
};
