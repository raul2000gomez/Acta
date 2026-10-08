import "server-only";
import { after } from "next/server";
import { env } from "@/lib/env";
import { inngest, MEETING_UPLOADED } from "@/lib/inngest/client";
import { inlineRunner, markFailed, runPipeline } from "./run";

/**
 * Lanza el procesado. Con Inngest configurado va a la cola (reintentos por
 * paso); si no, o si la cola no responde, se procesa en el mismo proceso tras
 * responder la petición (`after`), para que nunca se quede un audio sin procesar.
 */
export async function dispatchProcessing(meetingId: string, userId: string): Promise<"inngest" | "inline"> {
  if (!env.processInline) {
    try {
      await inngest.send({ name: MEETING_UPLOADED, data: { meetingId, userId } });
      return "inngest";
    } catch (err) {
      console.warn("[dispatch] Inngest no disponible, se procesa en línea:", err instanceof Error ? err.message : err);
    }
  }
  after(async () => {
    try {
      await runPipeline(meetingId, inlineRunner);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      console.error("[pipeline] fallo", meetingId, message);
      await markFailed(meetingId, message);
    }
  });
  return "inline";
}
