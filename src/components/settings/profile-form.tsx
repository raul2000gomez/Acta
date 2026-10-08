"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile } from "@/lib/settings/actions";
import type { Profile } from "@/lib/supabase/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  return (
    <form
      className="flex flex-col gap-4"
      onChange={() => setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await updateProfile(fd);
          if (r.ok) {
            toast.success("Guardado");
            setDirty(false);
          } else toast.error(r.error ?? "No se pudo guardar");
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="full_name">Tu nombre</Label>
          <Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} placeholder="Laura Gómez" autoComplete="name" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="company">Agencia</Label>
          <Input id="company" name="company" defaultValue={profile.company ?? ""} placeholder="Inmobiliaria Centro" autoComplete="organization" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} placeholder="600 000 000" autoComplete="tel" inputMode="tel" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="locale">Idioma de tareas y resumen</Label>
          <select id="locale" name="locale" defaultValue={profile.locale} className="border-input h-10 rounded-lg border bg-transparent px-3 text-sm">
            <option value="es">Español</option>
            <option value="ca">Català</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signature">Firma de los correos</Label>
        <Textarea
          id="signature"
          name="signature"
          defaultValue={profile.signature ?? ""}
          placeholder={"Laura Gómez\nInmobiliaria Centro · 600 000 000"}
          className="min-h-20"
        />
        <p className="text-xs text-muted-foreground">Si la dejas vacía, se usa nombre, agencia y teléfono.</p>
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="audio_retention_days">Borrar el audio automáticamente a los</Label>
        <select
          id="audio_retention_days"
          name="audio_retention_days"
          defaultValue={String(profile.audio_retention_days)}
          className="border-input h-10 rounded-lg border bg-transparent px-3 text-sm"
        >
          <option value="7">7 días</option>
          <option value="30">30 días</option>
          <option value="90">90 días</option>
          <option value="365">1 año</option>
        </select>
        <p className="text-xs text-muted-foreground">Las tareas, decisiones y correos se conservan; solo se borra la grabación.</p>
      </div>
      <div>
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
