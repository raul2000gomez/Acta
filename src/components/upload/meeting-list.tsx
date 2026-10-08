"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDuration, pluralize } from "@/lib/format";
import type { MeetingStatus } from "@/lib/supabase/types";

export type MeetingListItem = {
  id: string;
  title: string | null;
  meeting_date: string;
  duration_sec: number | null;
  status: MeetingStatus;
  is_demo: boolean;
  pending_tasks: number;
  participants: string[];
};

const STATUS_LABEL: Partial<Record<MeetingStatus, string>> = {
  uploading: "Subiendo",
  uploaded: "En cola",
  transcribing: "Transcribiendo",
  extracting: "Extrayendo",
  failed: "Falló",
};

export function MeetingList({ meetings }: { meetings: MeetingListItem[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return meetings;
    return meetings.filter(
      (m) => (m.title ?? "").toLowerCase().includes(term) || m.participants.some((p) => p.toLowerCase().includes(term)),
    );
  }, [meetings, q]);

  if (meetings.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Reuniones anteriores</h2>
        <div className="relative w-full max-w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente o título" className="h-9 pl-8 text-sm" />
        </div>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {filtered.map((m) => {
          const processing = !["ready", "failed"].includes(m.status);
          return (
            <li key={m.id}>
              <Link href={`/app/r/${m.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.title ?? (processing ? "Procesando…" : "Sin título")}
                    {m.is_demo && (
                      <Badge variant="secondary" className="ml-2 align-middle">
                        <Sparkles /> Ejemplo
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(m.meeting_date)}
                    {m.duration_sec ? ` · ${formatDuration(m.duration_sec)}` : ""}
                    {m.participants.length ? ` · ${m.participants.join(", ")}` : ""}
                  </p>
                </div>
                {m.status === "ready" && m.pending_tasks > 0 && (
                  <Badge variant="outline" className="shrink-0">
                    {pluralize(m.pending_tasks, "tarea pendiente", "tareas pendientes")}
                  </Badge>
                )}
                {processing && (
                  <Badge variant="secondary" className="shrink-0">
                    <Loader2 className="animate-spin" /> {STATUS_LABEL[m.status]}
                  </Badge>
                )}
                {m.status === "failed" && (
                  <Badge variant="destructive" className="shrink-0">
                    <AlertCircle /> Falló
                  </Badge>
                )}
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nada con «{q}».</li>}
      </ul>
    </section>
  );
}
