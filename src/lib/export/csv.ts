import type { MeetingBundle } from "@/lib/meetings/queries";
import { participantById, participantLabel } from "@/lib/meetings/labels";

function cell(v: string | null | undefined | boolean | number) {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV con punto y coma (lo que Excel en español abre bien a la primera). */
export function tasksToCSV(b: MeetingBundle) {
  const rows = [["Tarea", "Responsable", "Fecha", "Prioridad", "Hecha", "Cita", "Minuto", "Reunión"]];
  for (const t of b.tasks) {
    rows.push([
      t.text,
      participantLabel(participantById(b.participants, t.owner_participant_id), "yo"),
      t.due_date ?? "",
      t.priority,
      t.done ? "sí" : "no",
      t.evidence_quote ?? "",
      t.evidence_ts ?? "",
      b.meeting.title ?? "",
    ]);
  }
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
}
