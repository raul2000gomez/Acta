"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckSquare, Gavel, Mail, MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditableText } from "./editable-text";
import { EvidenceProvider } from "./evidence";
import { Participants } from "./participants";
import { TasksTab } from "./tasks-tab";
import { DecisionsTab } from "./decisions-tab";
import { EmailsTab } from "./emails-tab";
import { OpenQuestions } from "./questions";
import { ExportMenu } from "./export-menu";
import { EmailGate } from "@/components/auth/email-gate";
import { deleteMeeting, updateMeeting } from "@/lib/meetings/actions";
import type { MeetingBundle } from "@/lib/meetings/queries";
import { formatDate, formatDuration } from "@/lib/format";
import { DEFAULT_RETENTION_DAYS } from "@/lib/config";

type Props = {
  bundle: MeetingBundle;
  hasAccount: boolean;
  canSend: boolean;
  retentionDays?: number;
};

/** Un resultado, una pantalla (regla 4): cabecera, resumen y tres pestañas. */
export function MeetingView({ bundle, hasAccount, canSend, retentionDays = DEFAULT_RETENTION_DAYS }: Props) {
  const { meeting, participants, tasks, decisions, emails, questions } = bundle;
  const router = useRouter();
  const [emailGate, setEmailGate] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const pendingTasks = tasks.filter((t) => !t.done).length;
  const audioAvailable = Boolean(meeting.audio_path && !meeting.audio_deleted_at);

  return (
    <EvidenceProvider meetingId={meeting.id} audioAvailable={audioAvailable}>
      <div className="flex flex-col gap-5 pb-20">
        <div className="no-print flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/app">
              <ArrowLeft /> Reuniones
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {!hasAccount && (
              <Button size="sm" variant="secondary" onClick={() => setEmailGate("Para guardar esta reunión y volver a ella cuando quieras.")}>
                Guardar con mi email
              </Button>
            )}
            <ExportMenu bundle={bundle} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Más opciones">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    if (!confirm("¿Borrar esta reunión, su audio y todo lo extraído? No se puede deshacer.")) return;
                    startTransition(async () => {
                      const r = await deleteMeeting(meeting.id);
                      if (!r.ok) toast.error(r.error);
                      else router.push("/app");
                    });
                  }}
                >
                  <Trash2 /> Borrar reunión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {meeting.is_demo && (
              <Badge variant="secondary">
                <Sparkles /> Reunión de ejemplo
              </Badge>
            )}
            {meeting.quality_warning && (
              <Badge variant="warning">
                <AlertTriangle /> {meeting.quality_warning}
              </Badge>
            )}
          </div>
          <EditableText
            value={meeting.title ?? ""}
            placeholder="Ponle un título"
            onSave={async (title) => updateMeeting(meeting.id, { title })}
            as="h1"
            className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
          />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1 hover:bg-accent/60" title="Cambiar la fecha">
              {formatDate(meeting.meeting_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              <input
                type="date"
                value={meeting.meeting_date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  startTransition(async () => {
                    const r = await updateMeeting(meeting.id, { meeting_date: e.target.value });
                    if (!r.ok) toast.error(r.error);
                  });
                }}
                className="w-5 bg-transparent text-transparent outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60"
              />
            </label>
            {meeting.duration_sec ? <span>· {formatDuration(meeting.duration_sec)}</span> : null}
            {meeting.language && meeting.language !== "es" && <span>· {meeting.language === "ca" ? "en catalán" : "en inglés"}</span>}
          </p>
          <Participants participants={participants} meetingId={meeting.id} />
        </header>

        {meeting.summary && <p className="rounded-xl border bg-card px-4 py-3 text-sm leading-relaxed sm:text-[15px]">{meeting.summary}</p>}

        <Tabs defaultValue="tareas">
          <TabsList className="no-print">
            <TabsTrigger value="tareas">
              <CheckSquare /> Tareas{pendingTasks > 0 && <span className="text-xs text-muted-foreground">({pendingTasks})</span>}
            </TabsTrigger>
            <TabsTrigger value="decisiones">
              <Gavel /> Decisiones{decisions.length > 0 && <span className="text-xs text-muted-foreground">({decisions.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="correos">
              <Mail /> Correos{emails.length > 0 && <span className="text-xs text-muted-foreground">({emails.length})</span>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tareas">
            <TasksTab tasks={tasks} participants={participants} meetingId={meeting.id} />
          </TabsContent>
          <TabsContent value="decisiones">
            <DecisionsTab decisions={decisions} participants={participants} meetingId={meeting.id} />
          </TabsContent>
          <TabsContent value="correos">
            <EmailsTab
              emails={emails}
              tasks={tasks}
              meetingId={meeting.id}
              canSend={canSend}
              hasAccount={hasAccount}
              onNeedEmail={() => setEmailGate("Para enviar correos desde aquí necesitamos tu email (así las respuestas te llegan a ti).")}
            />
          </TabsContent>
        </Tabs>

        <OpenQuestions questions={questions} meetingId={meeting.id} />

        <footer className="no-print text-xs text-muted-foreground">
          {meeting.is_demo
            ? "Reunión de ejemplo: no tiene grabación, por eso las citas no se reproducen."
            : `El audio se borra automáticamente a los ${retentionDays} días. No entrenamos modelos con tus datos. Exporta o borra todo desde Ajustes con un clic.`}
        </footer>
      </div>

      <EmailGate open={emailGate !== null} message={emailGate ?? ""} onOpenChange={(o) => !o && setEmailGate(null)} />
    </EvidenceProvider>
  );
}
