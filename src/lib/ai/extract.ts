import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "@/lib/env";
import { demoExtraction } from "@/lib/demo/meeting";
import { ExtractionSchema, type Extraction } from "./schema";
import { SYSTEM_PROMPT, buildUserContext, formatTranscript, type UserContext } from "./prompt";
import type { TranscriptSegment } from "@/lib/supabase/types";

/** Modelo de extracción (sección 9 del prompt). Cambiable por entorno. */
export const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL ?? "claude-opus-5-5";

/** Precios en dólares por millón de tokens, para estimar el coste por reunión. */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

export type ExtractResult = {
  extraction: Extraction;
  model: string;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
  costCents: number | null;
};

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export function canExtract() {
  return Boolean(env.anthropicApiKey);
}

export function estimateCostCents(model: string, usage: ExtractResult["usage"]) {
  if (!usage) return null;
  const p = PRICES[model];
  if (!p) return null;
  const dollars =
    (usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite) /
    1_000_000;
  return Math.round(dollars * 100);
}

/**
 * Extrae tareas, decisiones, correos y dudas de una transcripción con Claude.
 * - Salidas estructuradas (JSON Schema) para que el JSON siempre valide.
 * - System prompt cacheado (es largo y estable).
 * - Streaming para no sufrir timeouts en salidas largas.
 */
export async function extract(input: {
  context: UserContext;
  segments: TranscriptSegment[];
  isDemo: boolean;
}): Promise<ExtractResult> {
  // La reunión de ejemplo nunca gasta tokens; y sin clave, también sirve para desarrollar.
  if (input.isDemo || !canExtract()) {
    return { extraction: demoExtraction(input.context.meetingDate), model: "demo", usage: null, costCents: 0 };
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey, maxRetries: 2, timeout: 10 * 60 * 1000 });
  const userMessage = `${buildUserContext(input.context)}\n\n## Transcripción\n${formatTranscript(input.segments)}`;

  const stream = client.messages.stream({
    model: EXTRACTION_MODEL,
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMessage }],
    output_config: { format: zodOutputFormat(ExtractionSchema), effort: "medium" },
  });

  let message: Anthropic.Message;
  try {
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
      throw new ExtractionError(`Claude no disponible: ${err.message}`, true);
    }
    if (err instanceof Anthropic.APIError) {
      throw new ExtractionError(`Claude respondió ${err.status}: ${err.message}`, false);
    }
    throw err;
  }

  if (message.stop_reason === "refusal") {
    throw new ExtractionError("El modelo rechazó procesar esta grabación.", false);
  }
  if (message.stop_reason === "max_tokens") {
    throw new ExtractionError("La respuesta del modelo se cortó por longitud.", false);
  }

  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ExtractionError("El modelo no devolvió JSON válido.", true);
  }
  const result = ExtractionSchema.safeParse(parsed);
  if (!result.success) {
    throw new ExtractionError(`El JSON no cumple el esquema: ${result.error.message.slice(0, 300)}`, true);
  }

  const usage = {
    input: message.usage.input_tokens,
    output: message.usage.output_tokens,
    cacheRead: message.usage.cache_read_input_tokens ?? 0,
    cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
  };

  return {
    extraction: result.data,
    model: message.model,
    usage,
    costCents: estimateCostCents(EXTRACTION_MODEL, usage),
  };
}
