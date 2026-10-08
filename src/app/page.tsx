import Link from "next/link";
import { ArrowRight, CheckSquare, Gavel, Mail, Mic, ShieldCheck, Smartphone, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FREE_MEETINGS, PRODUCT_NAME, PRO_PRICE_EUR } from "@/lib/config";
import { HowItWorks } from "@/components/marketing/how-it-works";

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Mic className="size-4" />
          </span>
          {PRODUCT_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/entrar">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/app">Probar gratis</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 pb-12 pt-10 text-center sm:pt-16">
        <p className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">Para agencias inmobiliarias</p>
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Subes la grabación de la reunión. Antes del café tienes las tareas, las decisiones y los correos listos.
        </h1>
        <p className="max-w-2xl text-balance text-lg text-muted-foreground">
          Redactados como los escribiría alguien que lleva años en inmobiliaria. Sin configurar nada, sin aprender una herramienta nueva.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/app">
              Prueba con tu última reunión <ArrowRight />
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">Sin registro para la primera. Sin contraseñas, nunca.</span>
        </div>
      </section>

      <HowItWorks />

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-12 sm:grid-cols-3">
        {[
          { icon: Timer, title: "Menos de 3 minutos de tu atención", text: "Dos minutos por hora de reunión para procesarla, y lo que tardes en pulsar «Enviar»." },
          { icon: ShieldCheck, title: "Cada tarea con su prueba", text: "Cada tarea y decisión lleva la frase literal y el minuto. Pulsas y escuchas ese fragmento." },
          { icon: Smartphone, title: "Grabas al salir, desde el móvil", text: "O subes la nota de voz de WhatsApp. Botones grandes, nada que configurar." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl border bg-card p-5">
            <Icon className="size-5 text-primary" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: CheckSquare, label: "Tareas", text: "«Enviar la nota de encargo a Carmen y Pedro» — Laura — mañana — alta" },
            { icon: Gavel, label: "Decisiones", text: "«Precio de salida: 305.000 €» — lo decidió Carmen — 01:20" },
            { icon: Mail, label: "Correos", text: "Asunto: Lo acordado hoy: salida a 305.000 €, nota de encargo mañana y fotos el jueves" },
          ].map(({ icon: Icon, label, text }) => (
            <div key={label} className="rounded-xl border border-dashed bg-background p-4 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="size-3.5" /> {label}
              </p>
              <p className="mt-2 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Fragmentos reales de la reunión de ejemplo que puedes probar sin subir nada.</p>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground">Precio</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight">
            {PRO_PRICE_EUR} €<span className="text-base font-normal text-muted-foreground">/mes</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Reuniones sin límite. Las {FREE_MEETINGS} primeras, gratis. Cancela cuando quieras.</p>
          <Button asChild size="lg" className="mt-5 w-full">
            <Link href="/app">Empezar gratis</Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-4 py-8 text-center text-xs text-muted-foreground">
        El audio se borra automáticamente a los 30 días. No entrenamos modelos con tus datos. Exporta o borra todo con un clic.
      </footer>
    </main>
  );
}
