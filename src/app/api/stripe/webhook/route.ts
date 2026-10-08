import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/** Stripe avisa aquí de pagos y cambios de suscripción; actualizamos profiles.plan. */
export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !env.stripeWebhookSecret) return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Sin firma" }, { status: 400 });
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Firma inválida: ${err instanceof Error ? err.message : ""}` }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.user_id ?? session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (userId) {
        await admin
          .from("profiles")
          .update({ plan: "pro", stripe_customer_id: customerId ?? null, stripe_subscription_id: subscriptionId ?? null })
          .eq("id", userId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
      const userId = sub.metadata?.user_id;
      const query = admin.from("profiles").update({
        plan: active && event.type !== "customer.subscription.deleted" ? "pro" : "free",
        stripe_subscription_id: event.type === "customer.subscription.deleted" ? null : sub.id,
      });
      if (userId) await query.eq("id", userId);
      else await query.eq("stripe_customer_id", customerId);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
