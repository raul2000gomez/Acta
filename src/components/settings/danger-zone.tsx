"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteAccount, signOutAndGoHome } from "@/lib/settings/actions";

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline">
        <a href="/api/export" download>
          Exportar todo (JSON)
        </a>
      </Button>
      <Button variant="outline" onClick={() => startTransition(() => signOutAndGoHome())} disabled={pending}>
        Cerrar sesión
      </Button>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Borrar mi cuenta
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar la cuenta de verdad</DialogTitle>
            <DialogDescription>
              Se borran todas las grabaciones, transcripciones, tareas, decisiones, correos y contactos. No hay copia. Escribe BORRAR para confirmar.
            </DialogDescription>
          </DialogHeader>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="BORRAR" autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirm !== "BORRAR" || pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteAccount();
                  if (r && !r.ok) toast.error(r.error ?? "No se pudo borrar");
                })
              }
            >
              {pending ? "Borrando…" : "Borrar todo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
