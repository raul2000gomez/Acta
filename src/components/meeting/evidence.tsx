"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pause, Play, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type EvidenceCtx = {
  audioAvailable: boolean;
  playing: string | null;
  play: (ts: string, quote: string) => void;
  stop: () => void;
};

const Ctx = createContext<EvidenceCtx>({ audioAvailable: false, playing: null, play: () => {}, stop: () => {} });

export function tsToSeconds(ts: string | null | undefined) {
  if (!ts) return 0;
  const parts = ts.split(":").map((n) => Number(n));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

const SNIPPET_SECONDS = 15;

/**
 * Un solo <audio> para toda la página. Cada «prueba» salta al minuto de la cita
 * y reproduce unos 15 segundos (regla 6: confiar sin escuchar la reunión entera).
 */
export function EvidenceProvider({ meetingId, audioAvailable, children }: { meetingId: string; audioAvailable: boolean; children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ ts: string; quote: string } | null>(null);
  const stopAt = useRef<number | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(null);
    stopAt.current = null;
  }, []);

  const play = useCallback(
    (ts: string, quote: string) => {
      const el = audioRef.current;
      if (!el || !audioAvailable) return;
      if (playing === ts) {
        stop();
        return;
      }
      const start = Math.max(0, tsToSeconds(ts) - 1);
      stopAt.current = start + SNIPPET_SECONDS;
      setCurrent({ ts, quote });
      setPlaying(ts);
      const go = () => {
        el.currentTime = start;
        void el.play().catch(() => setPlaying(null));
      };
      if (el.readyState >= 1) go();
      else {
        el.addEventListener("loadedmetadata", go, { once: true });
        el.load();
      }
    },
    [audioAvailable, playing, stop],
  );

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (stopAt.current != null && el.currentTime >= stopAt.current) stop();
    };
    const onEnded = () => stop();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
    };
  }, [stop]);

  return (
    <Ctx.Provider value={{ audioAvailable, playing, play, stop }}>
      {children}
      {audioAvailable && <audio ref={audioRef} src={`/api/meetings/${meetingId}/audio`} preload="none" className="hidden" />}
      {playing && current && (
        <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <button type="button" onClick={stop} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Pause className="size-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Reproduciendo desde el minuto {current.ts}</p>
              <p className="truncate text-sm">«{current.quote}»</p>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useEvidence() {
  return useContext(Ctx);
}

/** Botón «prueba»: muestra la cita literal y, si hay audio, reproduce el fragmento. */
export function EvidenceButton({ quote, ts, className }: { quote: string | null; ts: string | null; className?: string }) {
  const { audioAvailable, playing, play } = useEvidence();
  const [open, setOpen] = useState(false);
  if (!quote && !ts) return null;
  const active = playing === ts;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (ts && audioAvailable) play(ts, quote ?? "");
        }}
        title={audioAvailable ? "Ver la cita y escuchar el fragmento" : "Ver la cita"}
        className={cn(
          "inline-flex h-7 items-center gap-1 self-start rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-accent text-foreground",
        )}
      >
        {audioAvailable ? active ? <Pause className="size-3" /> : <Play className="size-3" /> : <Quote className="size-3" />}
        {ts ?? "cita"}
      </button>
      {open && quote && <p className="rounded-md border-l-2 border-primary/50 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">«{quote}»</p>}
    </div>
  );
}
