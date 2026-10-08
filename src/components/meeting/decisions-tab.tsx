"use client";

import { useState, useTransition } from "react";
import { FileSignature, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Initials } from "@/components/ui/initials";
import { EditableText } from "./editable-text";
import { EvidenceButton } from "./evidence";
import { addDecision, deleteDecision, updateDecision } from "@/lib/meetings/actions";
import { participantById, participantLabel } from "@/lib/meetings/labels";
import type { Decision, Participant } from "@/lib/supabase/types";

export function DecisionsTab({ decisions, participants, meetingId }: { decisions: Decision[]; participants: Participant[]; meetingId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    startTransition(async () => {
      const r = await addDecision(meetingId, t);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {decisions.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          En esta reunión no se tomó ninguna decisión. Lo que se propuso o quedó en el aire está en el resumen y en las dudas.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {decisions.map((d) => {
            const by = participantById(participants, d.decided_by_participant_id);
            return (
              <li key={d.id} className="flex gap-3 px-3 py-3 sm:px-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <EditableText value={d.text} onSave={async (t) => updateDecision(d.id, meetingId, t)} as="p" className="flex-1 text-sm font-medium leading-snug sm:text-[15px]" />
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteDecision(d.id, meetingId);
                          if (!r.ok) toast.error(r.error);
                        })
                      }
                      className="shrink-0 rounded-md p-1 text-muted-foreground opacity-60 transition-opacity hover:bg-accent hover:text-destructive hover:opacity-100"
                      title="Quitar decisión"
                      disabled={pending}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {by && (
                      <span className="inline-flex items-center gap-1">
                        <Initials name={participantLabel(by)} colorKey={by.id} size="sm" /> lo decidió {participantLabel(by, "el usuario")}
                      </span>
                    )}
                    {d.involves_money_or_contract && (
                      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-warning/60 bg-warning/20 px-1.5 font-medium text-foreground" title="Implica dinero, contrato o firma">
                        <FileSignature className="size-3" /> Dinero o contrato
                      </span>
                    )}
                    <EvidenceButton quote={d.evidence_quote} ts={d.evidence_ts} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Añadir decisión…" className="bg-card" maxLength={500} />
        <Button type="submit" variant="outline" disabled={pending || !text.trim()}>
          <Plus /> Añadir
        </Button>
      </form>
    </div>
  );
}
