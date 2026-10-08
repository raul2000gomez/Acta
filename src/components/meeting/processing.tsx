"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { estimateProcessingSeconds, formatEstimate } from "@/lib/format";
import type { MeetingStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { EmailForm } from "@/components/auth/email-form";

type Status = { status: MeetingStatus; error: string | null; duration_sec: number | null; title: string | null };

const PHASES: { key: MeetingStatus[]; label: string }[] = [
  { key: ["uploading", "uploaded"], label: "Audio recibido" },
  { key: ["transcribing"], label: "Transcribiendo" },
  { key: ["extracting"], label: "Sacando tareas, decisiones y correos" },
  { key: ["ready"], label: "Listo" },
];

function phaseIndex(status: MeetingStatus) {
  if (status === "uploading" || status === "uploaded") return 0;
  if (status === "transcribing") return 1;
  if (status === "extracting") return 2;
  return 3;
}

/**
 * Tiempo honesto (regla 8): fases reales, estimación por duración y la opción
 * de irse. Si algo falla, el audio sigue ahí y se reintenta con un botón.
 */
export function Processing({ meetingId, initial, hasAccount }: { meetingId: string; initial: Status; hasAccount: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Status>(initial);
  const [elapsed, setElapsed] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const startedAt = useRef<number | null>(null);

  const estimate = estimateProcessingSeconds(state.duration_sec);
  const failed = state.status === "failed";
  const idx = phaseIndex(state.status);

  useEffect(() => {
    if (failed || state.status === "ready") return;
    if (startedAt.current === null) startedAt.current = Date.now();
    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${meetingId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        setState(data);
        if (data.status === "ready") {
          window.clearInterval(poll);
          router.refresh();
        }
      } catch {
        // Reintenta en el siguiente tick.
      }
    }, 2500);
    const tick = window.setInterval(() => setElapsed(Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [meetingId, failed, state.status, router]);

  async function retry() {
    setRetrying(true);
    const res = await fetch(`/api/meetings/${meetingId}/retry`, { method: "POST" });
    if (res.ok) {
      startedAt.current = Date.now();
      setElapsed(0);
      setState((s) => ({ ...s, status: "uploaded", error: null }));
    }
    setRetrying(false);
  }

  const percent = failed ? 0 : Math.min(95, Math.round((elapsed / estimate) * 100) + idx * 5);
  const remaining = Math.max(0, estimate - elapsed);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{failed ? "No ha podido ser" : "Preparando tu reunión"}</h1>
        {!failed && (
          <p className="mt-1 text-sm text-muted-foreground">
            {remaining > 0 ? `Quedan ${formatEstimate(remaining)}, más o menos.` : "Ya casi está."}
          </p>
        )}
      </div>

      {failed ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{state.error ?? "Error desconocido."}</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">El audio no se ha perdido. Puedes volver a intentarlo.</p>
          <Button className="mt-3" onClick={retry} disabled={retrying}>
            <RotateCcw /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          <Progress value={percent} />
          <ol className="flex flex-col gap-2">
            {PHASES.map((p, i) => {
              const done = i < idx;
              const active = i === idx && state.status !== "ready";
              return (
                <li key={p.label} className={cn("flex items-center gap-3 text-sm", !done && !active && "text-muted-foreground")}>
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full border",
                      done && "border-primary bg-primary text-primary-foreground",
                      active && "border-primary text-primary",
                    )}
                  >
                    {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <span className="text-xs">{i + 1}</span>}
                  </span>
                  {p.label}
                </li>
              );
            })}
          </ol>
          <div className="rounded-xl border bg-card p-4 text-sm">
            {hasAccount ? (
              <p className="text-muted-foreground">Puedes cerrar esta pestaña: te avisamos por email cuando esté lista.</p>
            ) : (
              <>
                <p className="mb-3">¿Te vas? Déjanos tu email y te avisamos cuando esté lista.</p>
                <EmailForm next={`/app/r/${meetingId}`} cta="Avisadme por email" />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
