import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/config";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  fromName?: string;
};

export function canSendEmail() {
  return Boolean(env.resendApiKey && env.emailFrom);
}

/**
 * Envía un correo con Resend. Si no hay claves, no falla: devuelve skipped
 * para que la interfaz ofrezca «Copiar» y «Abrir en Gmail / Outlook».
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string | null; skipped: boolean }> {
  if (!canSendEmail()) return { id: null, skipped: true };
  const resend = new Resend(env.resendApiKey);
  const from = input.fromName ? `${input.fromName} vía ${PRODUCT_NAME} <${env.emailFrom}>` : `${PRODUCT_NAME} <${env.emailFrom}>`;
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    replyTo: input.replyTo,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id ?? null, skipped: false };
}
