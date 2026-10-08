import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Todo lo del usuario en un JSON (sin el audio, que se descarga desde cada reunión). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });

  const [profile, contacts, meetings, participants, tasks, decisions, emails, questions] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("contacts").select("*").eq("user_id", user.id),
    supabase.from("meetings").select("*").eq("user_id", user.id),
    supabase.from("participants").select("*").eq("user_id", user.id),
    supabase.from("tasks").select("*").eq("user_id", user.id),
    supabase.from("decisions").select("*").eq("user_id", user.id),
    supabase.from("emails").select("*").eq("user_id", user.id),
    supabase.from("open_questions").select("*").eq("user_id", user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    contacts: contacts.data ?? [],
    meetings: meetings.data ?? [],
    participants: participants.data ?? [],
    tasks: tasks.data ?? [],
    decisions: decisions.data ?? [],
    emails: emails.data ?? [],
    open_questions: questions.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
