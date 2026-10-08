import { CloudUpload, ListChecks, Send } from "lucide-react";

/**
 * Sustituye al vídeo de 20 segundos hasta que exista una grabación real del flujo
 * (ver README › Pendiente). Tres pasos, sin más.
 */
export function HowItWorks() {
  const steps = [
    { icon: CloudUpload, title: "Suelta el audio", text: "Archivo, enlace o «Grabar ahora». 10 segundos." },
    { icon: ListChecks, title: "Revisa en una pantalla", text: "Tareas · Decisiones · Correos. Todo se edita en el sitio." },
    { icon: Send, title: "Envía", text: "Copiar, abrir en Gmail u Outlook, o enviar desde aquí. 30 segundos." },
  ];
  return (
    <section className="mx-auto w-full max-w-5xl px-4">
      <ol className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-3 sm:p-6">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="flex gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div>
              <p className="font-semibold">
                {i + 1}. {title}
              </p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
