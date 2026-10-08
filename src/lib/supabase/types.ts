/** Tipos de la base de datos. Mantener en sincronía con supabase/migrations. */

export type MeetingStatus = "uploading" | "uploaded" | "transcribing" | "extracting" | "ready" | "failed";
export type Plan = "free" | "pro";
export type Priority = "alta" | "normal";
export type EmailStatus = "draft" | "copied" | "opened" | "sent";

export type TranscriptSegment = { speaker: string; start: number; end: number; text: string };
export type Transcript = {
  provider: string;
  language: string | null;
  duration_sec: number | null;
  segments: TranscriptSegment[];
};

export type PhaseTimings = Partial<Record<"upload" | "transcribe" | "extract" | "persist", number>> & {
  started_at?: string;
  finished_at?: string;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
  phone: string | null;
  signature: string | null;
  locale: string;
  audio_retention_days: number;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  meetings_used: number;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  email: string | null;
  company: string | null;
  times_seen: number;
  created_at: string;
  updated_at: string;
};

export type Meeting = {
  id: string;
  user_id: string;
  title: string | null;
  meeting_date: string;
  duration_sec: number | null;
  status: MeetingStatus;
  error: string | null;
  audio_path: string | null;
  audio_mime: string | null;
  audio_deleted_at: string | null;
  source_url: string | null;
  hint: string | null;
  language: string | null;
  summary: string | null;
  quality_warning: string | null;
  transcript: Transcript | null;
  raw_extraction: unknown | null;
  is_demo: boolean;
  phase_timings: PhaseTimings;
  cost_cents: number | null;
  edits_count: number;
  created_at: string;
  updated_at: string;
};

export type Participant = {
  id: string;
  meeting_id: string;
  user_id: string;
  speaker_key: string;
  name: string | null;
  role: string | null;
  is_user: boolean;
  contact_id: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  meeting_id: string;
  user_id: string;
  text: string;
  owner_participant_id: string | null;
  due_date: string | null;
  date_inferred: boolean;
  priority: Priority;
  suggested: boolean;
  done: boolean;
  evidence_quote: string | null;
  evidence_ts: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Decision = {
  id: string;
  meeting_id: string;
  user_id: string;
  text: string;
  decided_by_participant_id: string | null;
  involves_money_or_contract: boolean;
  evidence_quote: string | null;
  evidence_ts: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type Email = {
  id: string;
  meeting_id: string;
  user_id: string;
  to_participant_id: string | null;
  to_label: string;
  to_email: string | null;
  subject: string;
  body: string;
  original_body: string;
  language: string;
  related_task_ids: string[];
  status: EmailStatus;
  sent_unchanged: boolean | null;
  sent_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type OpenQuestion = {
  id: string;
  meeting_id: string;
  user_id: string;
  text: string;
  evidence_quote: string | null;
  evidence_ts: string | null;
  resolved: boolean;
  position: number;
  created_at: string;
};

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Required extends keyof Row = never, Rels extends Rel[] = []> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: Rels;
};

type ToMeeting = { foreignKeyName: string; columns: ["meeting_id"]; isOneToOne: false; referencedRelation: "meetings"; referencedColumns: ["id"] };
type ToParticipant<Col extends string> = {
  foreignKeyName: string;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: "participants";
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, "id">;
      contacts: Table<Contact, "user_id" | "name">;
      meetings: Table<Meeting, "user_id">;
      participants: Table<
        Participant,
        "meeting_id" | "user_id" | "speaker_key",
        [
          { foreignKeyName: "participants_meeting_id_fkey"; columns: ["meeting_id"]; isOneToOne: false; referencedRelation: "meetings"; referencedColumns: ["id"] },
          { foreignKeyName: "participants_contact_id_fkey"; columns: ["contact_id"]; isOneToOne: false; referencedRelation: "contacts"; referencedColumns: ["id"] },
        ]
      >;
      tasks: Table<
        Task,
        "meeting_id" | "user_id" | "text",
        [
          { foreignKeyName: "tasks_meeting_id_fkey" } & ToMeeting,
          { foreignKeyName: "tasks_owner_participant_id_fkey" } & ToParticipant<"owner_participant_id">,
        ]
      >;
      decisions: Table<
        Decision,
        "meeting_id" | "user_id" | "text",
        [
          { foreignKeyName: "decisions_meeting_id_fkey" } & ToMeeting,
          { foreignKeyName: "decisions_decided_by_participant_id_fkey" } & ToParticipant<"decided_by_participant_id">,
        ]
      >;
      emails: Table<
        Email,
        "meeting_id" | "user_id" | "to_label" | "subject" | "body" | "original_body",
        [
          { foreignKeyName: "emails_meeting_id_fkey" } & ToMeeting,
          { foreignKeyName: "emails_to_participant_id_fkey" } & ToParticipant<"to_participant_id">,
        ]
      >;
      open_questions: Table<OpenQuestion, "meeting_id" | "user_id" | "text", [{ foreignKeyName: "open_questions_meeting_id_fkey" } & ToMeeting]>;
    };
    Views: Record<string, never>;
    Functions: {
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
