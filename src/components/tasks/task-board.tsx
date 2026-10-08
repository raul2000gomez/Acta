"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Initials } from "@/components/ui/initials";
import { toggleTaskDone } from "@/lib/meetings/actions";
import { formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

export type BoardTask = {
  id: string;
  text: string;
  due_date: string | null;
  priority: "alta" | "normal";
  done: boolean;
  meeting_id: string;
  meeting_title: string | null;
  meeting_date: string;
  owner_name: string | null;
  owner_is_user: boolean;
  owner_id: string | null;
};

type Group = { key: string; label: string; tasks: BoardTask[] };

function groupTasks(tasks: BoardTask[]): Group[] {
  const today = todayISO();
  const d = new Date(`${today}T12:00:00`);
  const plus = (n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const tomorrow = plus(1);
  const weekEnd = plus(7);
  const groups: Group[] = [
    { key: "overdue", label: "Vencidas", tasks: [] },
    { key: "today", label: "Hoy", tasks: [] },
    { key: "tomorrow", label: "Mañana", tasks: [] },
    { key: "week", label: "Esta semana", tasks: [] },
    { key: "later", label: "Más adelante", tasks: [] },
    { key: "nodate", label: "Sin fecha", tasks: [] },
  ];
  for (const t of tasks) {
    if (!t.due_date) groups[5].tasks.push(t);
    else if (t.due_date < today) groups[0].tasks.push(t);
    else if (t.due_date === today) groups[1].tasks.push(t);
    else if (t.due_date === tomorrow) groups[2].tasks.push(t);
    else if (t.due_date <= weekEnd) groups[3].tasks.push(t);
    else groups[4].tasks.push(t);
  }
  for (const g of groups) g.tasks.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || (a.priority === "alta" ? -1 : 1));
  return groups.filter((g) => g.tasks.length > 0);
}

/** La vista de cada mañana: todas las tareas pendientes, agrupadas por vencimiento. */
export function TaskBoard({ tasks, onlyMine: initialOnlyMine }: { tasks: BoardTask[]; onlyMine: boolean }) {
  const [onlyMine, setOnlyMine] = useState(initialOnlyMine);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const visible = useMemo(() => tasks.filter((t) => !onlyMine || t.owner_is_user || !t.owner_id), [tasks, onlyMine]);
  const groups = useMemo(() => groupTasks(visible), [visible]);

  function toggle(t: BoardTask, done: boolean) {
    setDoneIds((s) => {
      const n = new Set(s);
      if (done) n.add(t.id);
      else n.delete(t.id);
      return n;
    });
    startTransition(async () => {
      const r = await toggleTaskDone(t.id, done);
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tareas pendientes</h1>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={onlyMine} onCheckedChange={(v) => setOnlyMine(v === true)} />
          Solo las mías
        </label>
      </div>
      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Nada pendiente. {tasks.length === 0 ? "Sube una reunión y aquí aparecerán sus tareas." : ""}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2 className={cn("text-sm font-semibold", g.key === "overdue" && "text-destructive")}>
            {g.label} <span className="font-normal text-muted-foreground">({g.tasks.length})</span>
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {g.tasks.map((t) => {
              const done = doneIds.has(t.id);
              return (
                <li key={t.id} className={cn("flex items-start gap-3 px-3 py-2.5 sm:px-4", done && "opacity-50")}>
                  <Checkbox checked={done} className="mt-0.5" onCheckedChange={(v) => toggle(t, v === true)} aria-label="Hecha" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm leading-snug", done && "line-through")}>{t.text}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {t.owner_name && (
                        <span className="inline-flex items-center gap-1">
                          <Initials name={t.owner_name} colorKey={t.owner_id ?? t.owner_name} size="sm" />
                          {t.owner_is_user ? "Tú" : t.owner_name}
                        </span>
                      )}
                      {!t.owner_id && <span className="font-semibold">¿Quién?</span>}
                      {t.due_date && g.key !== "today" && g.key !== "tomorrow" && <span>· {formatDate(t.due_date, { weekday: "short", day: "numeric", month: "short" })}</span>}
                      {t.priority === "alta" && <span className="rounded bg-warning/30 px-1 font-medium text-foreground">alta</span>}
                      <Link href={`/app/r/${t.meeting_id}`} className="truncate underline-offset-2 hover:underline">
                        · {t.meeting_title ?? formatDate(t.meeting_date)}
                      </Link>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
