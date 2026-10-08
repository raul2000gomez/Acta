"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/billing/stripe";
import type { Profile } from "@/lib/supabase/types";

const ProfileSchema = z.object({
  full_name: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  signature: z.string().max(600).optional(),
  locale: z.enum(["es", "ca", "en"]).optional(),
  audio_retention_days: z.coerce.number().int().min(1).max(365).optional(),
});

export async function updateProfile(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ProfileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión" };
  const d = parsed.data;
  const text = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);
  const patch: Partial<Profile> = {
    full_name: text(d.full_name),
    company: text(d.company),
    phone: text(d.phone),
    signature: text(d.signature),
    locale: d.locale,
    audio_retention_days: d.audio_retention_days,
  };
  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/ajustes");
  return { ok: true };
}

/** Borra de verdad (regla 11): audio, transcripciones, datos y la cuenta. */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sin sesión" };

  const { data: files } = await supabase.storage.from("audio").list(user.id, { limit: 1000 });
  if (files?.length) await supabase.storage.from("audio").remove(files.map((f) => `${user.id}/${f.name}`));

  const { data: profile } = await supabase.from("profiles").select("stripe_subscription_id").eq("id", user.id).maybeSingle();
  const stripe = getStripe();
  if (stripe && profile?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch {
      // Se cancela a mano desde Stripe si falla; no bloquea el borrado.
    }
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  redirect("/");
}

export async function signOutAndGoHome() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
