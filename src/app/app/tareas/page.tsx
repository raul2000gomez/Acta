import { TaskBoard, type BoardTask } from "@/components/tasks/task-board";
import { SetupNotice } from "@/components/shell/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { participantLabel } from "@/lib/meetings/labels";
import type { Participant } from "@/lib/supabase/types";

// Siempre por usuario: nunca prerenderizar.
export const dynamic = "force-dynamic";

export const metadata = { title: "Tareas" };

export default async function TareasPage() {
  if (!hasSupabase()) return <SetupNotice />;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, text, due_date, priority, done, meeting_id, owner_participant_id, meetings(title, meeting_date), owner:participants!tasks_owner_participant_id_fkey(id, name, is_user, speaker_key)")
    .eq("done", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  const tasks: BoardTask[] = (data ?? []).map((t) => {
    const owner = (t.owner as Pick<Participant, "id" | "name" | "is_user" | "speaker_key"> | null) ?? null;
    const meeting = t.meetings as { title: string | null; meeting_date: string } | null;
    return {
      id: t.id,
      text: t.text,
      due_date: t.due_date,
      priority: t.priority,
      done: t.done,
      meeting_id: t.meeting_id,
      meeting_title: meeting?.title ?? null,
      meeting_date: meeting?.meeting_date ?? "",
      owner_name: owner ? participantLabel(owner as Participant) : null,
      owner_is_user: owner?.is_user ?? false,
      owner_id: owner?.id ?? null,
    };
  });

  return <TaskBoard tasks={tasks} onlyMine={false} />;
}
