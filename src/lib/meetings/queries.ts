import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Decision, Email, Meeting, OpenQuestion, Participant, Task } from "@/lib/supabase/types";

export type MeetingBundle = {
  meeting: Meeting;
  participants: Participant[];
  tasks: Task[];
  decisions: Decision[];
  emails: Email[];
  questions: OpenQuestion[];
};

export async function getMeetingBundle(supabase: SupabaseClient<Database>, id: string): Promise<MeetingBundle | null> {
  const { data: meeting } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (!meeting) return null;
  const [participants, tasks, decisions, emails, questions] = await Promise.all([
    supabase.from("participants").select("*").eq("meeting_id", id).order("speaker_key"),
    supabase.from("tasks").select("*").eq("meeting_id", id).order("position"),
    supabase.from("decisions").select("*").eq("meeting_id", id).order("position"),
    supabase.from("emails").select("*").eq("meeting_id", id).order("position"),
    supabase.from("open_questions").select("*").eq("meeting_id", id).order("position"),
  ]);
  return {
    meeting: meeting as Meeting,
    participants: (participants.data ?? []) as Participant[],
    tasks: (tasks.data ?? []) as Task[],
    decisions: (decisions.data ?? []) as Decision[],
    emails: (emails.data ?? []) as Email[],
    questions: (questions.data ?? []) as OpenQuestion[],
  };
}
