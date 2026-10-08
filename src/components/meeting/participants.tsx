"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Initials } from "@/components/ui/initials";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { participantLabel, sortParticipants } from "@/lib/meetings/labels";
import { renameParticipant, setParticipantIsUser } from "@/lib/meetings/actions";
import type { Participant } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/** Avatares de iniciales; un clic para poner nombre a «Hablante 2» (se recuerda para la próxima). */
export function Participants({ participants, meetingId }: { participants: Participant[]; meetingId: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function startEdit(p: Participant) {
    setEditing(p.id);
    setDraft(p.name ?? "");
  }

  function save(p: Participant) {
    const name = draft.trim();
    setEditing(null);
    if (name === (p.name ?? "")) return;
    startTransition(async () => {
      const r = await renameParticipant(p.id, meetingId, name, p.role);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {sortParticipants(participants).map((p) => {
        const label = participantLabel(p);
        const unnamed = !p.name;
        if (editing === p.id) {
          return (
            <li key={p.id} className="flex items-center gap-1 rounded-full border bg-card pl-1 pr-1">
              <Initials name={draft || label} colorKey={p.id} size="sm" />
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(p);
                  if (e.key === "Escape") setEditing(null);
                }}
                placeholder="Nombre"
                className="h-7 w-36 border-0 px-1 text-sm shadow-none focus-visible:ring-0"
              />
              {!p.is_user && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setEditing(null);
                    startTransition(async () => {
                      const r = await setParticipantIsUser(p.id, meetingId);
                      if (!r.ok) toast.error(r.error);
                    });
                  }}
                >
                  Soy yo
                </Button>
              )}
            </li>
          );
        }
        return (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => startEdit(p)}
              disabled={pending}
              title={unnamed ? "Ponle nombre" : `${label}${p.role ? ` · ${p.role}` : ""}. Clic para cambiar`}
              className={cn(
                "group flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5 text-sm transition-colors hover:bg-accent",
                unnamed && "border-dashed text-muted-foreground",
              )}
            >
              <Initials name={unnamed ? "?" : label} colorKey={p.id} size="sm" />
              <span className="max-w-40 truncate">{label}</span>
              {p.is_user && <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">tú</span>}
              {p.role && !p.is_user && <span className="hidden text-xs text-muted-foreground sm:inline">· {p.role}</span>}
              <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
