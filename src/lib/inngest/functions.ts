import { NonRetriableError } from "inngest";
import { inngest, MEETING_UPLOADED, type MeetingUploadedData } from "./client";
import { markFailed, PipelineError, runPipeline, type StepRunner } from "@/lib/pipeline/run";

/**
 * Procesa una reunión en pasos reintentables. Los errores que no tiene sentido
 * reintentar (archivo inválido, enlace roto) marcan la reunión como fallida
 * con un mensaje claro y detienen la función.
 */
export const processMeeting = inngest.createFunction(
  {
    id: "process-meeting",
    retries: 3,
    triggers: [{ event: MEETING_UPLOADED }],
    onFailure: async ({ event }) => {
      const data = event.data.event.data as MeetingUploadedData;
      const message = event.data.error?.message ?? "Error desconocido";
      await markFailed(data.meetingId, message);
    },
  },
  async ({ event, step }) => {
    const { meetingId } = event.data as MeetingUploadedData;
    // Los pasos devuelven objetos pequeños serializables; el cast evita el Jsonify<T> de Inngest.
    const run: StepRunner = async <T,>(name: string, fn: () => Promise<T>) =>
      (await step.run(name, async () => {
        try {
          return await fn();
        } catch (err) {
          if (err instanceof PipelineError && !err.retriable) {
            await markFailed(meetingId, err.message);
            throw new NonRetriableError(err.message, { cause: err });
          }
          throw err;
        }
      })) as T;
    await runPipeline(meetingId, run);
    return { meetingId, status: "ready" };
  },
);

export const functions = [processMeeting];
