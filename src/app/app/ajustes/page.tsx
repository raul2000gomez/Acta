import { ProfileForm } from "@/components/settings/profile-form";
import { BillingCard } from "@/components/settings/billing-card";
import { DangerZone } from "@/components/settings/danger-zone";
import { EmailForm } from "@/components/auth/email-form";
import { SetupNotice } from "@/components/shell/setup-notice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { env, hasSupabase } from "@/lib/env";
import type { Profile } from "@/lib/supabase/types";

// Siempre por usuario: nunca prerenderizar.
export const dynamic = "force-dynamic";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  if (!hasSupabase()) return <SetupNotice />;
  const { pago } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;

  if (user.is_anonymous) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <Card>
          <CardHeader>
            <CardTitle>Primero, tu email</CardTitle>
            <CardDescription>Con él guardamos tus reuniones, te avisamos cuando estén listas y puedes volver desde cualquier dispositivo.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmailForm next="/app/ajustes" autoFocus />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      {pago === "ok" && <p className="rounded-xl bg-success/15 px-4 py-3 text-sm">Pago completado. Ya tienes el plan Pro.</p>}
      {pago === "cancelado" && <p className="rounded-xl bg-muted px-4 py-3 text-sm">Pago cancelado. Sigues en el plan gratis.</p>}

      <Card>
        <CardHeader>
          <CardTitle>Tú y tu firma</CardTitle>
          <CardDescription>Se usan en los correos y para saber cuáles son tus tareas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile as Profile} />
        </CardContent>
      </Card>

      <BillingCard plan={profile.plan} meetingsUsed={profile.meetings_used} configured={Boolean(env.stripeSecretKey && env.stripePriceId)} />

      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>Invitar a compañeros y compartir reuniones llega en la siguiente versión. Mientras tanto, cada persona tiene su cuenta.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>El audio se borra solo a los {profile.audio_retention_days} días. No entrenamos modelos con tus datos. Puedes llevártelo todo o borrarlo todo.</CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
