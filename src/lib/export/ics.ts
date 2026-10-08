import type { MeetingBundle } from "@/lib/meetings/queries";
import { participantById, participantLabel } from "@/lib/meetings/labels";

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function dateValue(iso: string) {
  return iso.replace(/-/g, "");
}

function nextDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Un evento de día completo por cada tarea con fecha, más la propia reunión. */
export function meetingToICS(b: MeetingBundle, productName: string) {
  const { meeting, tasks, participants } = b;
  const out: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${esc(productName)}//ES`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const ds = stamp();

  out.push(
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.id}@${productName.toLowerCase()}`,
    `DTSTAMP:${ds}`,
    `DTSTART;VALUE=DATE:${dateValue(meeting.meeting_date)}`,
    `DTEND;VALUE=DATE:${dateValue(nextDay(meeting.meeting_date))}`,
    `SUMMARY:${esc(meeting.title ?? "Reunión")}`,
    `DESCRIPTION:${esc(meeting.summary ?? "")}`,
    "END:VEVENT",
  );

  for (const t of tasks) {
    if (!t.due_date || t.done) continue;
    const owner = participantLabel(participantById(participants, t.owner_participant_id), "yo");
    out.push(
      "BEGIN:VEVENT",
      `UID:task-${t.id}@${productName.toLowerCase()}`,
      `DTSTAMP:${ds}`,
      `DTSTART;VALUE=DATE:${dateValue(t.due_date)}`,
      `DTEND;VALUE=DATE:${dateValue(nextDay(t.due_date))}`,
      `SUMMARY:${esc(t.text)}`,
      `DESCRIPTION:${esc(`${owner ? `Responsable: ${owner}\n` : ""}${t.evidence_quote ? `«${t.evidence_quote}» (${t.evidence_ts})\n` : ""}De la reunión: ${meeting.title ?? ""}`)}`,
      `PRIORITY:${t.priority === "alta" ? 1 : 5}`,
      "END:VEVENT",
    );
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n") + "\r\n";
}
