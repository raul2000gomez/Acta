"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditableText } from "./editable-text";
import { markEmail, sendEmailFromApp, updateEmail } from "@/lib/meetings/actions";
import { copyText } from "@/lib/export/download";
import { emailToClipboardText } from "@/lib/export/text";
import { gmailHref, mailtoHref, outlookHref } from "@/lib/email/mailto";
import type { Email, Task } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const STATUS: Record<Email["status"], { label: string; variant: "secondary" | "success" | "outline" } | null> = {
  draft: null,
  copied: { label: "Copiado", variant: "secondary" },
  opened: { label: "Abierto en tu correo", variant: "secondary" },
  sent: { label: "Enviado", variant: "success" },
};

function EmailCard({
  email,
  tasks,
  meetingId,
  canSend,
  hasAccount,
  onNeedEmail,
}: {
  email: Email;
  tasks: Task[];
  meetingId: string;
  canSend: boolean;
  hasAccount: boolean;
  onNeedEmail: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [to, setTo] = useState(email.to_email ?? "");
  const [copied, setCopied] = useState(false);
  const related = tasks.filter((t) => email.related_task_ids.includes(t.id));
  const status = STATUS[email.status];

  function saveTo() {
    const v = to.trim() || null;
    if (v === email.to_email) return;
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("Ese email no parece válido");
      return;
    }
    startTransition(async () => {
      const r = await updateEmail(email.id, meetingId, { to_email: v });
      if (!r.ok) toast.error(r.error);
    });
  }

  async function copy() {
    const ok = await copyText(emailToClipboardText(email));
    if (!ok) {
      toast.error("No se pudo copiar");
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    startTransition(async () => {
      await markEmail(email.id, meetingId, "copied");
    });
  }

  function opened() {
    startTransition(async () => {
      await markEmail(email.id, meetingId, "opened");
    });
  }

  function send() {
    if (!hasAccount) {
      onNeedEmail();
      return;
    }
    startTransition(async () => {
      const r = await sendEmailFromApp(email.id, meetingId);
      if (!r.ok) {
        if (r.error === "signup_required") onNeedEmail();
        else toast.error(r.error);
        return;
      }
      toast.success(`Enviado a ${email.to_email}`);
    });
  }

  const payload = { to: email.to_email, subject: email.subject, body: email.body };

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{email.to_label}</span>
        <input
          type="email"
          inputMode="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={saveTo}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="email del destinatario"
          className={cn(
            "h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:max-w-64",
            !to && "border-dashed",
          )}
        />
        {status && (
          <Badge variant={status.variant} className="ml-auto">
            {status.label}
          </Badge>
        )}
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Asunto</span>
        <EditableText value={email.subject} onSave={async (subject) => updateEmail(email.id, meetingId, { subject })} as="p" className="text-sm font-semibold" />
      </div>

      <div className="flex flex-col gap-1">
        <EditableText
          value={email.body}
          multiline
          onSave={async (body) => updateEmail(email.id, meetingId, { body })}
          as="p"
          className="text-sm leading-relaxed"
          inputClassName="min-h-40 text-sm leading-relaxed"
        />
      </div>

      {related.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Menciona: {related.map((t) => t.text).join(" · ")}
        </p>
      )}

      <footer className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button asChild variant="outline" size="sm" onClick={opened}>
          <a href={gmailHref(payload)} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Gmail
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" onClick={opened}>
          <a href={outlookHref(payload)} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Outlook
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" onClick={opened}>
          <a href={mailtoHref(payload)}>
            <Mail /> Mi correo
          </a>
        </Button>
        {canSend && (
          <Button type="button" size="sm" onClick={send} disabled={pending || !email.to_email} title={!email.to_email ? "Pon el email del destinatario" : undefined} className="ml-auto">
            <Send /> Enviar
          </Button>
        )}
      </footer>
    </article>
  );
}

export function EmailsTab({
  emails,
  tasks,
  meetingId,
  canSend,
  hasAccount,
  onNeedEmail,
}: {
  emails: Email[];
  tasks: Task[];
  meetingId: string;
  canSend: boolean;
  hasAccount: boolean;
  onNeedEmail: () => void;
}) {
  if (emails.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No hace falta ningún correo de seguimiento para esta reunión.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {emails.map((e) => (
        <EmailCard key={e.id} email={e} tasks={tasks} meetingId={meetingId} canSend={canSend} hasAccount={hasAccount} onNeedEmail={onNeedEmail} />
      ))}
    </div>
  );
}
