"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestEmailLink } from "@/lib/auth/actions";

/** Un campo, un botón, sin contraseñas. Reutilizado en /entrar y en la puerta de email. */
export function EmailForm({ next, autoFocus, cta = "Enviarme el enlace" }: { next?: string; autoFocus?: boolean; cta?: string }) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await requestEmailLink(email, next);
          setResult(r);
        });
      }}
    >
      {result?.ok ? (
        <p className="rounded-lg bg-accent px-3 py-2 text-sm">{result.message}</p>
      ) : (
        <>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="tu@agencia.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={autoFocus}
          />
          <Button type="submit" disabled={pending || !email}>
            {pending ? "Enviando…" : cta}
          </Button>
          {result && !result.ok && <p className="text-sm text-destructive">{result.message}</p>}
          <p className="text-xs text-muted-foreground">Sin contraseñas: te mandamos un enlace y listo.</p>
        </>
      )}
    </form>
  );
}
