/**
 * Hooks de resolución para ejecutar los módulos TypeScript de `src/lib` desde Node, sin Next:
 * resuelve el alias `@/` → `src/` y añade la extensión a los imports sin ella (`./types` → `./types.ts`).
 * Los tipos los quita el propio Node (`--experimental-transform-types`). Lo registra `smoke-real.mjs --sin-app`.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC = pathToFileURL(resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src") + "/").href;
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = SRC + spec.slice(2);
  const isPath = spec.startsWith("file:") || spec.startsWith("./") || spec.startsWith("../") || spec.startsWith("/");
  if (isPath && !/\.[cm]?[jt]sx?$/.test(spec)) {
    const base = spec.startsWith("file:") ? spec : new URL(spec, context.parentURL).href;
    for (const ext of EXTENSIONS) {
      if (existsSync(fileURLToPath(base + ext))) return nextResolve(base + ext, context);
    }
  }
  return nextResolve(spec, context);
}
