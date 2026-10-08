"use client";

import { useTransition } from "react";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { EvidenceButton } from "./evidence";
import { resolveQuestion } from "@/lib/meetings/actions";
import type { OpenQuestion } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/** Lo que la IA no ha podido cerrar (regla 10): duda en voz alta, no inventa. */
export function OpenQuestions({ questions, meetingId }: { questions: OpenQuestion[]; meetingId: string }) {
  const [, startTransition] = useTransition();
  if (questions.length === 0) return null;
  const open = questions.filter((q) => !q.resolved).length;
  return (
    <section className="rounded-xl border border-warning/50 bg-warning/10 p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <HelpCircle className="size-4" />
        Dudas por confirmar {open > 0 && <span className="rounded-full bg-warning/40 px-1.5 text-xs">{open}</span>}
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q.id} className={cn("flex items-start gap-2 text-sm", q.resolved && "opacity-60")}>
            <Checkbox
              className="mt-0.5"
              checked={q.resolved}
              aria-label="Resuelta"
              onCheckedChange={(v) =>
                startTransition(async () => {
                  const r = await resolveQuestion(q.id, meetingId, v === true);
                  if (!r.ok) toast.error(r.error);
                })
              }
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={cn(q.resolved && "line-through")}>{q.text}</span>
              <EvidenceButton quote={q.evidence_quote} ts={q.evidence_ts} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
