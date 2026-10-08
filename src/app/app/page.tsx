import { UploadSection } from "@/components/upload/upload-section";
import { MeetingList, type MeetingListItem } from "@/components/upload/meeting-list";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import { SetupNotice } from "@/components/shell/setup-notice";

// Siempre por usuario: nunca prerenderizar.
export const dynamic = "force-dynamic";

export const metadata = { title: "Reuniones" };

export default async function AppHome() {
  if (!hasSupabase()) return <SetupNotice />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let meetings: MeetingListItem[] = [];
  if (user) {
    const { data } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, duration_sec, status, is_demo, tasks(done), participants(name, is_user)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    meetings = (data ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      meeting_date: m.meeting_date,
      duration_sec: m.duration_sec,
      status: m.status,
      is_demo: m.is_demo,
      pending_tasks: (m.tasks as { done: boolean }[]).filter((t) => !t.done).length,
      participants: (m.participants as { name: string | null; is_user: boolean }[])
        .filter((p) => p.name && !p.is_user)
        .map((p) => p.name as string),
    }));
  }

  const hasAccount = Boolean(user && !user.is_anonymous);
  const first = meetings.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        {first && (
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">De la reunión a las tareas, las decisiones y los correos</h1>
            <p className="mt-1 text-muted-foreground">Antes de que te sirvas un café. Sin configurar nada.</p>
          </div>
        )}
        <UploadSection hasAccount={hasAccount} compact={!first} />
      </section>
      <MeetingList meetings={meetings} />
    </div>
  );
}
