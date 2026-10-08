import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Extraction } from "@/lib/ai/schema";
import type { Database, Meeting, Transcript } from "@/lib/supabase/types";

type Admin = SupabaseClient<Database>;

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/**
 * Guarda la extracción en tablas normalizadas. Es idempotente: borra lo que
 * hubiera de esa reunión antes de insertar, por si el paso se reintenta.
 */
export async function persistExtraction(admin: Admin, meeting: Meeting, extraction: Extraction, transcript: Transcript | null) {
  const meetingId = meeting.id;
  const userId = meeting.user_id;

  for (const table of ["emails", "tasks", "decisions", "open_questions", "participants"] as const) {
    const { error } = await admin.from(table).delete().eq("meeting_id", meetingId);
    if (error) throw new Error(`No se pudo limpiar ${table}: ${error.message}`);
  }

  // Participantes: los que dice la IA más cualquier hablante de la transcripción que haya olvidado.
  const speakerKeys = new Set<string>(extraction.participants.map((p) => p.id));
  for (const seg of transcript?.segments ?? []) speakerKeys.add(seg.speaker);

  const { data: contacts } = await admin.from("contacts").select("id, name, email, role").eq("user_id", userId);
  const contactByName = new Map((contacts ?? []).map((c) => [normalizeName(c.name), c]));

  const participantRows = Array.from(speakerKeys).map((key) => {
    const p = extraction.participants.find((x) => x.id === key);
    const contact = p?.name ? contactByName.get(normalizeName(p.name)) : undefined;
    return {
      meeting_id: meetingId,
      user_id: userId,
      speaker_key: key,
      name: p?.name ?? null,
      role: p?.role ?? null,
      is_user: p?.is_user ?? false,
      contact_id: contact?.id ?? null,
    };
  });

  const { data: participants, error: pErr } = await admin.from("participants").insert(participantRows).select("id, speaker_key, name, contact_id");
  if (pErr) throw new Error(`No se pudieron guardar los participantes: ${pErr.message}`);
  const participantId = new Map((participants ?? []).map((p) => [p.speaker_key, p.id]));

  // Memoria de nombres (regla 12): quien aparece con nombre y no es el usuario, se recuerda.
  for (const p of extraction.participants) {
    if (!p.name || p.is_user) continue;
    const existing = contactByName.get(normalizeName(p.name));
    if (existing) {
      await admin
        .from("contacts")
        .update({ role: existing.role ?? p.role ?? null })
        .eq("id", existing.id);
    } else {
      const { data: created } = await admin
        .from("contacts")
        .insert({ user_id: userId, name: p.name.trim(), role: p.role ?? null })
        .select("id, name, email, role")
        .single();
      if (created) {
        contactByName.set(normalizeName(created.name), created);
        const pid = participantId.get(p.id);
        if (pid) await admin.from("participants").update({ contact_id: created.id }).eq("id", pid);
      }
    }
  }

  // Tareas
  const taskRows = extraction.tasks.map((t, i) => ({
    meeting_id: meetingId,
    user_id: userId,
    text: t.text,
    owner_participant_id: t.owner_id ? (participantId.get(t.owner_id) ?? null) : null,
    due_date: t.due_date,
    date_inferred: t.date_inferred,
    priority: t.priority,
    suggested: t.suggested,
    evidence_quote: t.evidence.quote,
    evidence_ts: t.evidence.timestamp,
    position: i,
  }));
  const { data: tasks, error: tErr } = taskRows.length
    ? await admin.from("tasks").insert(taskRows).select("id, position")
    : { data: [], error: null };
  if (tErr) throw new Error(`No se pudieron guardar las tareas: ${tErr.message}`);
  const taskIdByAi = new Map<string, string>();
  (tasks ?? []).forEach((row) => {
    const ai = extraction.tasks[row.position];
    if (ai) taskIdByAi.set(ai.id, row.id);
  });

  // Decisiones
  if (extraction.decisions.length) {
    const { error } = await admin.from("decisions").insert(
      extraction.decisions.map((d, i) => ({
        meeting_id: meetingId,
        user_id: userId,
        text: d.text,
        decided_by_participant_id: d.decided_by ? (participantId.get(d.decided_by) ?? null) : null,
        involves_money_or_contract: d.involves_money_or_contract,
        evidence_quote: d.evidence.quote,
        evidence_ts: d.evidence.timestamp,
        position: i,
      })),
    );
    if (error) throw new Error(`No se pudieron guardar las decisiones: ${error.message}`);
  }

  // Correos
  if (extraction.emails.length) {
    const { error } = await admin.from("emails").insert(
      extraction.emails.map((e, i) => {
        const participant = e.to_participant_id ? extraction.participants.find((p) => p.id === e.to_participant_id) : null;
        const contact = participant?.name ? contactByName.get(normalizeName(participant.name)) : undefined;
        return {
          meeting_id: meetingId,
          user_id: userId,
          to_participant_id: e.to_participant_id ? (participantId.get(e.to_participant_id) ?? null) : null,
          to_label: e.to_label,
          to_email: contact?.email ?? null,
          subject: e.subject,
          body: e.body,
          original_body: e.body,
          language: e.language,
          related_task_ids: e.related_task_ids.map((id) => taskIdByAi.get(id)).filter((x): x is string => Boolean(x)),
          position: i,
        };
      }),
    );
    if (error) throw new Error(`No se pudieron guardar los correos: ${error.message}`);
  }

  // Dudas
  if (extraction.open_questions.length) {
    const { error } = await admin.from("open_questions").insert(
      extraction.open_questions.map((q, i) => ({
        meeting_id: meetingId,
        user_id: userId,
        text: q.text,
        evidence_quote: q.evidence.quote,
        evidence_ts: q.evidence.timestamp,
        position: i,
      })),
    );
    if (error) throw new Error(`No se pudieron guardar las dudas: ${error.message}`);
  }
}
