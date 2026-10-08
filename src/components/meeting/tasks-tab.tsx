"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Initials } from "@/components/ui/initials";
import { EditableText } from "./editable-text";
import { EvidenceButton } from "./evidence";
import { addTask, deleteTask, toggleTaskDone, updateTask } from "@/lib/meetings/actions";
import { participantById, participantLabel, sortParticipants } from "@/lib/meetings/labels";
import { relativeDay } from "@/lib/format";
import type { Participant, Task } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

function TaskRow({ task, participants, meetingId }: { task: Task; participants: Participant[]; meetingId: string }) {
  const [done, setDone] = useState(task.done);
  const [pending, startTransition] = useTransition();
  const owner = participantById(participants, task.owner_participant_id);
  const overdue = task.due_date && !done && task.due_date < new Date().toISOString().slice(0, 10);

  function patch(p: Parameters<typeof updateTask>[2]) {
    startTransition(async () => {
      const r = await updateTask(task.id, meetingId, p);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <li className={cn("flex gap-3 px-3 py-3 sm:px-4", done && "opacity-60")}>
      <Checkbox
        checked={done}
        aria-label="Hecha"
        className="mt-1"
        onCheckedChange={(v) => {
          const next = v === true;
          setDone(next);
          startTransition(async () => {
            const r = await toggleTaskDone(task.id, next);
            if (!r.ok) {
              setDone(!next);
              toast.error(r.error);
            }
          });
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <EditableText
            value={task.text}
            onSave={async (text) => updateTask(task.id, meetingId, { text })}
            className={cn("flex-1 text-sm leading-snug sm:text-[15px]", done && "line-through")}
            as="p"
          />
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                const r = await deleteTask(task.id, meetingId);
                if (!r.ok) toast.error(r.error);
              })
            }
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-60 transition-opacity hover:bg-accent hover:text-destructive hover:opacity-100"
            title="Quitar tarea"
            disabled={pending}
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
          <label className={cn("inline-flex h-7 items-center gap-1 rounded-md border bg-background px-1.5", !owner && "border-dashed text-muted-foreground")}>
            {owner ? <Initials name={participantLabel(owner)} colorKey={owner.id} size="sm" /> : <span className="px-0.5 font-semibold">¿?</span>}
            <select
              aria-label="Responsable"
              value={task.owner_participant_id ?? ""}
              onChange={(e) => patch({ owner_participant_id: e.target.value || null })}
              className="max-w-36 bg-transparent pr-1 outline-none"
            >
              <option value="">¿Quién?</option>
              {sortParticipants(participants).map((p) => (
                <option key={p.id} value={p.id}>
                  {participantLabel(p)}
                </option>
              ))}
            </select>
          </label>

          <label className={cn("inline-flex h-7 items-center gap-1 rounded-md border bg-background px-1.5", !task.due_date && "border-dashed text-muted-foreground", overdue && "border-destructive/50 text-destructive")}>
            <span>{task.due_date ? relativeDay(task.due_date) : "Sin fecha"}</span>
            <input
              type="date"
              aria-label="Fecha"
              value={task.due_date ?? ""}
              onChange={(e) => patch({ due_date: e.target.value || null })}
              className="w-6 bg-transparent text-transparent outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70"
            />
          </label>
          {task.date_inferred && task.due_date && <span className="text-muted-foreground" title="Fecha deducida de una expresión como «el jueves»">(deducida)</span>}

          <button
            type="button"
            onClick={() => patch({ priority: task.priority === "alta" ? "normal" : "alta" })}
            className={cn(
              "h-7 rounded-md border px-1.5 transition-colors",
              task.priority === "alta" ? "border-warning/60 bg-warning/20 font-medium" : "text-muted-foreground hover:bg-accent",
            )}
            title="Cambiar prioridad"
          >
            {task.priority === "alta" ? "Prioridad alta" : "Normal"}
          </button>

          {task.suggested && (
            <span className="h-7 rounded-md border border-dashed px-1.5 leading-7 text-muted-foreground" title="Nadie la dijo; es habitual en el sector">
              Sugerida
            </span>
          )}

          <EvidenceButton quote={task.evidence_quote} ts={task.evidence_ts} />
        </div>
      </div>
    </li>
  );
}

export function TasksTab({ tasks, participants, meetingId }: { tasks: Task[]; participants: Participant[]; meetingId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  // Las del usuario primero (regla: «las tareas del propio usuario van primero»), las hechas al final.
  const sorted = useMemo(() => {
    const userIds = new Set(participants.filter((p) => p.is_user).map((p) => p.id));
    return [...tasks].sort((a, b) => {
      if (a.done !== b.done) return Number(a.done) - Number(b.done);
      const au = a.owner_participant_id && userIds.has(a.owner_participant_id) ? 0 : 1;
      const bu = b.owner_participant_id && userIds.has(b.owner_participant_id) ? 0 : 1;
      if (au !== bu) return au - bu;
      return a.position - b.position;
    });
  }, [tasks, participants]);

  function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    startTransition(async () => {
      const r = await addTask(meetingId, t);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No se detectó ninguna tarea en esta reunión. Si falta alguna, añádela abajo.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} participants={participants} meetingId={meetingId} />
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Añadir tarea…" className="bg-card" maxLength={500} />
        <Button type="submit" variant="outline" disabled={pending || !text.trim()}>
          <Plus /> Añadir
        </Button>
      </form>
    </div>
  );
}
