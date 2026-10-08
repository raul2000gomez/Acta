import Link from "next/link";
import { Mic } from "lucide-react";
import { EmailForm } from "@/components/auth/email-form";
import { PRODUCT_NAME } from "@/lib/config";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Mic className="size-4" />
        </span>
        {PRODUCT_NAME}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escribe tu email y te mandamos un enlace. Si es tu primera vez, se crea la cuenta sola.</p>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">El enlace no ha funcionado: {error}. Pide otro.</p>}
      <EmailForm next={next} autoFocus />
      <p className="text-xs text-muted-foreground">
        ¿Solo quieres probar? <Link href="/app" className="underline underline-offset-4">Sube una reunión sin registrarte</Link>.
      </p>
    </main>
  );
}
