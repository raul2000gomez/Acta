import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Todo menos estáticos, imágenes, manifest y el handler de la cola.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|api/inngest|api/stripe/webhook|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|m4a)$).*)",
  ],
};
