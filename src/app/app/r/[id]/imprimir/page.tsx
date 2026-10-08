import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMeetingBundle } from "@/lib/meetings/queries";
import { participantById, participantLabel, sortParticipants } from "@/lib/meetings/labels";
import { formatDate, formatDuration } from "@/lib/format";
import { AutoPrint } from "@/components/meeting/auto-print";
import { PRODUCT_NAME } from "@/lib/config";

/** Vista de impresión: una página A4 con lo esencial. El navegador la guarda como PDF. */
export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const bundle = await getMeetingBundle(supabase, id);
  if (!bundle || bundle.meeting.status !== "ready") notFound();
  const { meeting, participants, tasks, decisions, questions } = bundle;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 text-[13px] leading-snug text-black print:px-0 print:py-0">
      <AutoPrint />
      <header className="border-b pb-3">
        <h1 className="text-xl font-semibold">{meeting.title ?? "Reunión"}</h1>
        <p className="mt-1 text-neutral-600">
          {formatDate(meeting.meeting_date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          {meeting.duration_sec ? ` · ${formatDuration(meeting.duration_sec)}` : ""}
          {participants.length ? ` · ${sortParticipants(participants).map((p) => participantLabel(p, "yo")).join(", ")}` : ""}
        </p>
      </header>

      {meeting.summary && <p className="mt-3">{meeting.summary}</p>}

      <section className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Tareas</h2>
        {tasks.length === 0 ? (
          <p className="text-neutral-600">Ninguna.</p>
        ) : (
          <table className="mt-1 w-full border-collapse">
            <thead>
              <tr className="border-b text-left text-neutral-600">
                <th className="py-1 pr-2 font-medium">Tarea</th>
                <th className="py-1 pr-2 font-medium">Responsable</th>
                <th className="py-1 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-neutral-200 align-top">
                  <td className="py-1 pr-2">
                    {t.done ? "☑" : "☐"} {t.text}
                    {t.priority === "alta" ? " (alta)" : ""}
                  </td>
                  <td className="py-1 pr-2 whitespace-nowrap">{participantLabel(participantById(participants, t.owner_participant_id), "yo") || "¿?"}</td>
                  <td className="py-1 whitespace-nowrap">{t.due_date ? formatDate(t.due_date) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Decisiones</h2>
        {decisions.length === 0 ? (
          <p className="text-neutral-600">No se tomó ninguna.</p>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {decisions.map((d) => {
              const by = participantLabel(participantById(participants, d.decided_by_participant_id), "yo");
              return (
                <li key={d.id}>
                  {d.text}
                  {by ? ` (${by})` : ""}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {questions.length > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Dudas por confirmar</h2>
          <ul className="mt-1 list-disc pl-5">
            {questions.map((q) => (
              <li key={q.id}>
                {q.resolved ? "☑ " : ""}
                {q.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-6 border-t pt-2 text-[11px] text-neutral-500">Generado con {PRODUCT_NAME}.</footer>
    </main>
  );
}
