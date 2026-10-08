"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getStripe } from "./stripe";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : env.appUrl;
}

/** Abre Stripe Checkout para el plan Pro. Un solo plan en v1. */
export async function startCheckout(): Promise<{ url?: string; error?: string }> {
  const stripe = getStripe();
  if (!stripe || !env.stripePriceId) return { error: "El pago aún no está configurado (STRIPE_SECRET_KEY, STRIPE_PRICE_ID)." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sin sesión" };
  if (user.is_anonymous || !user.email) return { error: "signup_required" };

  const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const base = await origin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.stripePriceId, quantity: 1 }],
    success_url: `${base}/app/ajustes?pago=ok`,
    cancel_url: `${base}/app/ajustes?pago=cancelado`,
    allow_promotion_codes: true,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    locale: "es",
  });
  return { url: session.url ?? undefined };
}

/** Portal de cliente de Stripe: cambiar tarjeta, ver facturas, cancelar. */
export async function openBillingPortal(): Promise<{ url?: string; error?: string }> {
  const stripe = getStripe();
  if (!stripe) return { error: "El pago aún no está configurado." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sin sesión" };
  const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).maybeSingle();
  if (!profile?.stripe_customer_id) return { error: "Aún no tienes suscripción." };
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${await origin()}/app/ajustes`,
  });
  return { url: session.url };
}
