"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import type { EmailStatus, Priority } from "@/lib/supabase/types";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function client() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sin sesión");
  return { supabase, user };
}

/** Cada edición cuenta (señal de calidad de la extracción). */
async function countEdit(meetingId: string) {
  const { supabase } = await client();
  const { data } = await supabase.from("meetings").select("edits_count").eq("id", meetingId).maybeSingle();
  if (data) await supabase.from("meetings").update({ edits_count: (data.edits_count ?? 0) + 1 }).eq("id", meetingId);
}

function revalidate(meetingId: string) {
  revalidatePath(`/app/r/${meetingId}`);
  revalidatePath("/app/tareas");
  revalidatePath("/app");
}

// ---------------------------------------------------------------------------
// Reunión
// ---------------------------------------------------------------------------
const MeetingPatch = z.object({
  title: z.string().max(200).optional(),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function updateMeeting(meetingId: string, patch: z.infer<typeof MeetingPatch>): Promise<Result> {
  const parsed = MeetingPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { supabase } = await client();
  const { error } = await supabase.from("meetings").update(parsed.data).eq("id", meetingId);
  if (error) return { ok: false, error: error.message };
  revalidate(meetingId);
  return { ok: true };
}

export async function deleteMeeting(meetingId: string): Promise<Result> {
  const { supabase } = await client();
  const { data: meeting } = await supabase.from("meetings").select("audio_path").eq("id", meetingId).maybeSingle();
  if (meeting?.audio_path) await supabase.storage.from("audio").remove([meeting.audio_path]);
  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app");
  revalidatePath("/app/tareas");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Participantes (y memoria de nombres)
// ---------------------------------------------------------------------------
export async function renameParticipant(participantId: string, meetingId: string, name: string, role?: string | null): Promise<Result> {
  const clean = name.trim().slice(0, 120);
  const { supabase, user } = await client();
  const { data: participant } = await supabase.from("participants").select("id, is_user, contact_id").eq("id", participantId).maybeSingle();
  if (!participant) return { ok: false, error: "Participante no encontrado" };

  let contactId = participant.contact_id;
  if (clean && !participant.is_user) {
    const { data: existing } = await supabase.from("contacts").select("id").eq("user_id", user.id).ilike("name", clean).maybeSingle();
    if (existing) contactId = existing.id;
    else {
      const { data: created } = await supabase.from("contacts").insert({ user_id: user.id, name: clean, role: role ?? null }).select("id").single();
      contactId = created?.id ?? null;
    }
  }
  const { error } = await supabase
    .from("participants")
    .update({ name: clean || null, role: role === undefined ? undefined : role, contact_id: contactId })
    .eq("id", participantId);
  if (error) return { ok: false, error: error.message };
  await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

export async function setParticipantIsUser(participantId: string, meetingId: string): Promise<Result> {
  const { supabase } = await client();
  await supabase.from("participants").update({ is_user: false }).eq("meeting_id", meetingId);
  const { error } = await supabase.from("participants").update({ is_user: true }).eq("id", participantId);
  if (error) return { ok: false, error: error.message };
  revalidate(meetingId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------
const TaskPatch = z.object({
  text: z.string().min(1).max(500).optional(),
  owner_participant_id: z.string().uuid().nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priority: z.enum(["alta", "normal"]).optional(),
  done: z.boolean().optional(),
  suggested: z.boolean().optional(),
});

export async function updateTask(taskId: string, meetingId: string, patch: z.infer<typeof TaskPatch>): Promise<Result> {
  const parsed = TaskPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { supabase } = await client();
  const data = { ...parsed.data, ...(parsed.data.due_date !== undefined ? { date_inferred: false } : {}) };
  const { error } = await supabase.from("tasks").update(data).eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  if (parsed.data.done === undefined) await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

export async function addTask(meetingId: string, text: string, ownerParticipantId?: string | null): Promise<Result<{ id: string }>> {
  const clean = text.trim().slice(0, 500);
  if (!clean) return { ok: false, error: "Escribe la tarea" };
  const { supabase, user } = await client();
  const { data: last } = await supabase.from("tasks").select("position").eq("meeting_id", meetingId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("tasks")
    .insert({ meeting_id: meetingId, user_id: user.id, text: clean, owner_participant_id: ownerParticipantId ?? null, position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo crear" };
  await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true, data: { id: data.id } };
}

export async function deleteTask(taskId: string, meetingId: string): Promise<Result> {
  const { supabase } = await client();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

export async function toggleTaskDone(taskId: string, done: boolean): Promise<Result> {
  const { supabase } = await client();
  const { data, error } = await supabase.from("tasks").update({ done }).eq("id", taskId).select("meeting_id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "No se pudo actualizar" };
  revalidate(data.meeting_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Decisiones
// ---------------------------------------------------------------------------
export async function updateDecision(decisionId: string, meetingId: string, text: string): Promise<Result> {
  const clean = text.trim().slice(0, 500);
  if (!clean) return { ok: false, error: "La decisión no puede quedar vacía" };
  const { supabase } = await client();
  const { error } = await supabase.from("decisions").update({ text: clean }).eq("id", decisionId);
  if (error) return { ok: false, error: error.message };
  await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

export async function deleteDecision(decisionId: string, meetingId: string): Promise<Result> {
  const { supabase } = await client();
  const { error } = await supabase.from("decisions").delete().eq("id", decisionId);
  if (error) return { ok: false, error: error.message };
  await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

export async function addDecision(meetingId: string, text: string): Promise<Result> {
  const clean = text.trim().slice(0, 500);
  if (!clean) return { ok: false, error: "Escribe la decisión" };
  const { supabase, user } = await client();
  const { data: last } = await supabase.from("decisions").select("position").eq("meeting_id", meetingId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("decisions").insert({ meeting_id: meetingId, user_id: user.id, text: clean, position: (last?.position ?? -1) + 1 });
  if (error) return { ok: false, error: error.message };
  await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Correos
// ---------------------------------------------------------------------------
const EmailPatch = z.object({
  subject: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(5000).optional(),
  to_email: z.string().email().nullable().optional(),
});

export async function updateEmail(emailId: string, meetingId: string, patch: z.infer<typeof EmailPatch>): Promise<Result> {
  const parsed = EmailPatch.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const { supabase, user } = await client();
  const { data: email } = await supabase.from("emails").select("to_participant_id").eq("id", emailId).maybeSingle();
  const { error } = await supabase.from("emails").update(parsed.data).eq("id", emailId);
  if (error) return { ok: false, error: error.message };
  // Memoria: si se pone un email a un participante con nombre, se guarda en el contacto.
  if (parsed.data.to_email && email?.to_participant_id) {
    const { data: p } = await supabase.from("participants").select("contact_id").eq("id", email.to_participant_id).maybeSingle();
    if (p?.contact_id) await supabase.from("contacts").update({ email: parsed.data.to_email }).eq("id", p.contact_id).eq("user_id", user.id);
  }
  if (parsed.data.to_email === undefined) await countEdit(meetingId);
  revalidate(meetingId);
  return { ok: true };
}

/** Marca el correo como copiado, abierto o enviado y registra si salió sin cambios. */
export async function markEmail(emailId: string, meetingId: string, status: Exclude<EmailStatus, "draft">): Promise<Result> {
  const { supabase } = await client();
  const { data: email } = await supabase.from("emails").select("body, original_body, status").eq("id", emailId).maybeSingle();
  if (!email) return { ok: false, error: "Correo no encontrado" };
  const rank: Record<EmailStatus, number> = { draft: 0, copied: 1, opened: 2, sent: 3 };
  const next = rank[status] >= rank[email.status] ? status : email.status;
  const { error } = await supabase
    .from("emails")
    .update({ status: next, sent_unchanged: email.body.trim() === email.original_body.trim(), sent_at: status === "sent" ? new Date().toISOString() : undefined })
    .eq("id", emailId);
  if (error) return { ok: false, error: error.message };
  revalidate(meetingId);
  return { ok: true };
}

export async function sendEmailFromApp(emailId: string, meetingId: string): Promise<Result> {
  const { supabase, user } = await client();
  if (user.is_anonymous) return { ok: false, error: "signup_required" };
  const { data: email } = await supabase.from("emails").select("to_email, subject, body").eq("id", emailId).maybeSingle();
  if (!email) return { ok: false, error: "Correo no encontrado" };
  if (!email.to_email) return { ok: false, error: "Pon el email del destinatario" };
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
  try {
    const { skipped } = await sendEmail({
      to: email.to_email,
      subject: email.subject,
      text: email.body,
      replyTo: profile?.email ?? user.email ?? undefined,
      fromName: profile?.full_name ?? undefined,
    });
    if (skipped) return { ok: false, error: "El envío directo no está configurado. Usa «Copiar» o «Abrir en Gmail»." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo enviar" };
  }
  return markEmail(emailId, meetingId, "sent");
}

// ---------------------------------------------------------------------------
// Dudas
// ---------------------------------------------------------------------------
export async function resolveQuestion(questionId: string, meetingId: string, resolved: boolean): Promise<Result> {
  const { supabase } = await client();
  const { error } = await supabase.from("open_questions").update({ resolved }).eq("id", questionId);
  if (error) return { ok: false, error: error.message };
  revalidate(meetingId);
  return { ok: true };
}

export type { Priority };
