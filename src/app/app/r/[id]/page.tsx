import { notFound } from "next/navigation";
import { MeetingView } from "@/components/meeting/meeting-view";
import { Processing } from "@/components/meeting/processing";
import { SetupNotice } from "@/components/shell/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { getMeetingBundle } from "@/lib/meetings/queries";
import { hasSupabase } from "@/lib/env";
import { canSendEmail } from "@/lib/email/resend";

// Siempre por usuario: nunca prerenderizar.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabase()) return { title: "Reunión" };
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("meetings").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Reunión" };
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabase()) return <SetupNotice />;
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const bundle = await getMeetingBundle(supabase, id);
  if (!bundle) notFound();

  const hasAccount = Boolean(user && !user.is_anonymous);
  const { meeting } = bundle;

  if (meeting.status !== "ready") {
    return (
      <Processing
        meetingId={meeting.id}
        hasAccount={hasAccount}
        initial={{ status: meeting.status, error: meeting.error, duration_sec: meeting.duration_sec, title: meeting.title }}
      />
    );
  }

  let retentionDays: number | undefined;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("audio_retention_days").eq("id", user.id).maybeSingle();
    retentionDays = profile?.audio_retention_days;
  }

  return <MeetingView bundle={bundle} hasAccount={hasAccount} canSend={canSendEmail()} retentionDays={retentionDays} />;
}
