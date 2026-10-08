import { PRODUCT_NAME } from "@/lib/config";

/** Se muestra cuando faltan las variables de Supabase: mejor un aviso claro que una pantalla rota. */
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border bg-card p-6 text-sm">
      <h1 className="text-lg font-semibold">Falta configurar {PRODUCT_NAME}</h1>
      <p className="mt-2 text-muted-foreground">
        No encuentro las variables de Supabase. Copia <code className="rounded bg-muted px-1">.env.example</code> a{" "}
        <code className="rounded bg-muted px-1">.env.local</code>, rellena <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
        <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, y reinicia el servidor. El README explica el resto.
      </p>
    </div>
  );
}
