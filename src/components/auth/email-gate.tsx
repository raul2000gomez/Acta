"use client";

import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailForm } from "./email-form";

/** Se abre solo cuando hace falta: guardar, enviar un correo o procesar la segunda reunión (regla 2). */
export function EmailGate({ open, message, onOpenChange }: { open: boolean; message: string; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Déjanos tu email</DialogTitle>
          <DialogDescription>{message || "Para guardar esta reunión y las siguientes."}</DialogDescription>
        </DialogHeader>
        <EmailForm next={pathname} autoFocus cta="Enviarme el enlace" />
      </DialogContent>
    </Dialog>
  );
}
