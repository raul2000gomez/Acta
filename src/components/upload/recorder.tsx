"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Grabadora en el navegador. Al parar, entrega un File listo para subir.
 * Pensada para el móvil al salir de la reunión: un botón grande y un contador.
 */
export function Recorder({ onRecorded, disabled }: { onRecorded: (file: File) => void; disabled?: boolean }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const now = new Date();
        const name = `grabacion-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${ext}`;
        const file = new File(chunksRef.current, name, { type, lastModified: Date.now() });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onRecorded(file);
      };
      rec.start(1000);
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  function stop() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const mm = pad(Math.floor(seconds / 60));
  const ss = pad(seconds % 60);

  return (
    <div className="flex flex-col items-center gap-2">
      {recording ? (
        <Button type="button" size="lg" variant="destructive" onClick={stop} className="min-w-44">
          <Square className="fill-current" />
          Parar · {mm}:{ss}
        </Button>
      ) : (
        <Button type="button" size="lg" variant="outline" onClick={start} disabled={disabled} className="min-w-44">
          <Mic />
          Grabar ahora
        </Button>
      )}
      {recording && (
        <p className={cn("text-xs text-muted-foreground")}>
          <span className="mr-1 inline-block size-2 animate-pulse rounded-full bg-destructive align-middle" />
          Grabando. Al parar se sube sola.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
