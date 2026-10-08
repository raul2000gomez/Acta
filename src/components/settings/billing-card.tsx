"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { openBillingPortal, startCheckout } from "@/lib/billing/actions";
import { FREE_MEETINGS, PRO_PRICE_EUR } from "@/lib/config";
import type { Plan } from "@/lib/supabase/types";

export function BillingCard({ plan, meetingsUsed, configured }: { plan: Plan; meetingsUsed: number; configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const go = (fn: () => Promise<{ url?: string; error?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.url) window.location.href = r.url;
      else toast.error(r.error ?? "No se pudo abrir");
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{plan === "pro" ? "Plan Pro" : "Plan gratis"}</CardTitle>
        <CardDescription>
          {plan === "pro"
            ? `Reuniones sin límite por ${PRO_PRICE_EUR} €/mes. Cancela cuando quieras.`
            : `${Math.min(meetingsUsed, FREE_MEETINGS)} de ${FREE_MEETINGS} reuniones gratis usadas. El plan Pro (${PRO_PRICE_EUR} €/mes) no tiene límite.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {plan === "pro" ? (
          <Button variant="outline" disabled={pending || !configured} onClick={() => go(openBillingPortal)}>
            Gestionar suscripción
          </Button>
        ) : (
          <Button disabled={pending || !configured} onClick={() => go(startCheckout)}>
            Pasar a Pro
          </Button>
        )}
        {!configured && <p className="w-full text-xs text-muted-foreground">El pago aún no está configurado en este entorno.</p>}
      </CardContent>
    </Card>
  );
}
