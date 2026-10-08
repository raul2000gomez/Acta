/** Enlaces para abrir el correo ya relleno en Gmail, Outlook o el cliente por defecto. */

export function mailtoHref(opts: { to?: string | null; subject: string; body: string }) {
  const params = new URLSearchParams();
  params.set("subject", opts.subject);
  params.set("body", opts.body);
  return `mailto:${opts.to ?? ""}?${params.toString().replace(/\+/g, "%20")}`;
}

export function gmailHref(opts: { to?: string | null; subject: string; body: string }) {
  const params = new URLSearchParams({ view: "cm", fs: "1", su: opts.subject, body: opts.body });
  if (opts.to) params.set("to", opts.to);
  return `https://mail.google.com/mail/?${params.toString().replace(/\+/g, "%20")}`;
}

export function outlookHref(opts: { to?: string | null; subject: string; body: string }) {
  const params = new URLSearchParams({ path: "/mail/action/compose", subject: opts.subject, body: opts.body });
  if (opts.to) params.set("to", opts.to);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString().replace(/\+/g, "%20")}`;
}
