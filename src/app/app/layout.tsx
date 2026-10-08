import { AppNav } from "@/components/shell/nav";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";

// Siempre por usuario: nunca prerenderizar.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null;
  let pendingTasks = 0;

  if (hasSupabase()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && !user.is_anonymous) email = user.email ?? null;
    if (user) {
      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("done", false);
      pendingTasks = count ?? 0;
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav email={email} pendingTasks={pendingTasks} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-16 pt-5 sm:pt-8">{children}</main>
    </div>
  );
}
