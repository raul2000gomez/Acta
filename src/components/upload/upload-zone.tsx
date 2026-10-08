"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Recorder } from "./recorder";
import { createDemoMeeting, createMeetingFromLink, uploadMeetingFile, UploadError, type UploadProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";

type Props = {
  /** true cuando el usuario ya ha dado su email (no anónimo). */
  hasAccount: boolean;
  /** Pedir email cuando el servidor lo exija (segunda reunión, > 30 min). */
  onNeedEmail?: (message: string) => void;
  onNeedUpgrade?: (message: string) => void;
  compact?: boolean;
};

const PHASE_LABEL: Record<UploadProgress["phase"], string> = {
  preparing: "Leyendo el archivo",
  uploading: "Subiendo",
  starting: "Arrancando el procesado",
};

/**
 * La única acción para empezar (regla 1): soltar un archivo, pegar un enlace o grabar.
 * Sin configuración previa. El campo «¿De qué va?» es opcional.
 */
export function UploadZone({ hasAccount, onNeedEmail, onNeedUpgrade, compact }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [hint, setHint] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof UploadError && err.code === "signup_required") {
        onNeedEmail?.(err.message);
        return;
      }
      if (err instanceof UploadError && err.code === "upgrade_required") {
        onNeedUpgrade?.(err.message);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Algo ha fallado. Inténtalo de nuevo.");
    },
    [onNeedEmail, onNeedUpgrade],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (busy) return;
      setBusy(true);
      setFileInfo({ name: file.name, size: file.size });
      try {
        const { meetingId } = await uploadMeetingFile(file, { hint, onProgress: setProgress });
        router.push(`/app/r/${meetingId}`);
      } catch (err) {
        handleError(err);
        setBusy(false);
        setProgress(null);
        setFileInfo(null);
      }
    },
    [busy, hint, router, handleError],
  );

  async function handleLink() {
    const url = link.trim();
    if (!url) return;
    setBusy(true);
    try {
      const { meetingId } = await createMeetingFromLink(url, hint);
      router.push(`/app/r/${meetingId}`);
    } catch (err) {
      handleError(err);
      setBusy(false);
    }
  }

  async function handleDemo() {
    setBusy(true);
    try {
      const { meetingId } = await createDemoMeeting();
      router.push(`/app/r/${meetingId}`);
    } catch (err) {
      handleError(err);
      setBusy(false);
    }
  }

  const sizeMB = fileInfo ? (fileInfo.size / 1024 / 1024).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Soltar aquí la grabación o pulsar para elegir un archivo"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "group relative flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-colors",
          compact ? "min-h-40 py-8" : "min-h-64 py-12 sm:min-h-80",
          dragging ? "border-primary bg-accent" : "border-input bg-card hover:border-primary/60 hover:bg-accent/40",
          busy && "cursor-default",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*,.mp3,.m4a,.wav,.ogg,.opus,.mp4,.webm,.mov"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        {progress ? (
          <div className="flex w-full max-w-sm flex-col gap-3">
            <CloudUpload className="mx-auto size-10 text-primary" />
            <p className="font-medium">{PHASE_LABEL[progress.phase]}…</p>
            <Progress value={progress.phase === "uploading" ? progress.percent : progress.phase === "starting" ? 100 : 5} />
            {fileInfo && (
              <p className="truncate text-xs text-muted-foreground">
                {fileInfo.name} · {sizeMB} MB
                {progress.phase === "uploading" ? ` · ${progress.percent} %` : ""}
              </p>
            )}
          </div>
        ) : (
          <>
            <CloudUpload className="size-12 text-primary transition-transform group-hover:-translate-y-0.5" />
            <div>
              <p className="text-lg font-semibold sm:text-xl">Suelta aquí la grabación de la reunión</p>
              <p className="mt-1 text-sm text-muted-foreground">
                o pulsa para elegirla. Audio o vídeo: mp3, m4a, wav, nota de voz de WhatsApp, mp4…
              </p>
            </div>
            <Button type="button" size="lg" className="mt-1 pointer-events-none">
              Elegir archivo
            </Button>
          </>
        )}
      </div>

      {!progress && (
        <>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Recorder onRecorded={(file) => void handleFile(file)} disabled={busy} />
            <Button type="button" size="lg" variant="outline" disabled={busy} onClick={() => setShowLink((v) => !v)} className="min-w-44">
              <Link2 />
              Pegar un enlace
            </Button>
          </div>

          {showLink && (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void handleLink();
              }}
            >
              <Input
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/… o enlace directo al archivo"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={busy || !link.trim()}>
                Procesar enlace
              </Button>
            </form>
          )}

          <Input
            placeholder="¿De qué va? (opcional) · p. ej. «visita piso calle Mayor con los Sánchez»"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            maxLength={300}
            className="bg-card"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {hasAccount
                ? "Te avisamos por email cuando esté lista. Puedes cerrar la pestaña."
                : "Sin registro para la primera reunión (hasta 30 min). Sin contraseñas, nunca."}
            </span>
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" disabled={busy} onClick={handleDemo}>
              <Sparkles className="size-3.5" />
              Probar con una reunión de ejemplo ({formatDuration(200)})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
