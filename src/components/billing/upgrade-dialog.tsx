"use client";

import { useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRO_PRICE_EUR } from "@/lib/config";
import { startCheckout } from "@/lib/billing/actions";
import { toast } from "sonner";

export function UpgradeDialog({ open, message, onOpenChange }: { open: boolean; message: string; onOpenChange: (open: boolean) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan Pro: {PRO_PRICE_EUR} €/mes, sin límite</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Reuniones ilimitadas, de cualquier duración.</li>
          <li>Avisos por email cuando el resultado está listo.</li>
          <li>Cancela cuando quieras desde Ajustes.</li>
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Ahora no
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await startCheckout();
                if (r.url) window.location.href = r.url;
                else toast.error(r.error ?? "No se pudo abrir el pago.");
              })
            }
          >
            {pending ? "Abriendo…" : "Pasar a Pro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
