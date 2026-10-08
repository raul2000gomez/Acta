import type { MeetingBundle } from "@/lib/meetings/queries";
import { participantById, participantLabel } from "@/lib/meetings/labels";
import { formatDate } from "@/lib/format";

/** Reunión completa como texto plano, para copiar en cualquier sitio. */
export function meetingToText(b: MeetingBundle) {
  const { meeting, participants, tasks, decisions, emails, questions } = b;
  const lines: string[] = [];
  lines.push(meeting.title ?? "Reunión");
  lines.push(`${formatDate(meeting.meeting_date)}${participants.length ? ` · ${participants.map((p) => participantLabel(p)).join(", ")}` : ""}`);
  lines.push("");
  if (meeting.summary) {
    lines.push("RESUMEN");
    lines.push(meeting.summary);
    lines.push("");
  }
  lines.push("TAREAS");
  if (tasks.length === 0) lines.push("(ninguna)");
  for (const t of tasks) {
    const owner = participantLabel(participantById(participants, t.owner_participant_id), "yo");
    lines.push(`${t.done ? "[x]" : "[ ]"} ${t.text}${owner ? ` — ${owner}` : ""}${t.due_date ? ` — ${formatDate(t.due_date)}` : ""}${t.priority === "alta" ? " — ALTA" : ""}`);
  }
  lines.push("");
  lines.push("DECISIONES");
  if (decisions.length === 0) lines.push("(no se tomó ninguna decisión)");
  for (const d of decisions) {
    const by = participantLabel(participantById(participants, d.decided_by_participant_id), "yo");
    lines.push(`• ${d.text}${by ? ` (${by})` : ""}`);
  }
  if (questions.length) {
    lines.push("");
    lines.push("DUDAS POR CONFIRMAR");
    for (const q of questions) lines.push(`${q.resolved ? "[x]" : "[ ]"} ${q.text}`);
  }
  if (emails.length) {
    lines.push("");
    lines.push("CORREOS DE SEGUIMIENTO");
    for (const e of emails) {
      lines.push("");
      lines.push(`Para: ${e.to_label}${e.to_email ? ` <${e.to_email}>` : ""}`);
      lines.push(`Asunto: ${e.subject}`);
      lines.push("");
      lines.push(e.body);
    }
  }
  return lines.join("\n");
}

export function emailToClipboardText(e: { subject: string; body: string }) {
  return `Asunto: ${e.subject}\n\n${e.body}`;
}
