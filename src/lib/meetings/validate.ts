import { ACCEPTED_EXTENSIONS, ACCEPTED_MIME, MAX_FILE_BYTES } from "@/lib/config";

export function extensionOf(filename: string) {
  const m = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function isAcceptedFile(filename: string, mime: string | null | undefined, size: number) {
  if (size <= 0) return { ok: false as const, message: "El archivo está vacío." };
  if (size > MAX_FILE_BYTES) return { ok: false as const, message: "El archivo supera los 500 MB." };
  const ext = extensionOf(filename);
  const mimeOk = mime ? ACCEPTED_MIME.includes(mime.split(";")[0]) || mime.startsWith("audio/") || mime.startsWith("video/") : false;
  const extOk = ACCEPTED_EXTENSIONS.includes(ext);
  if (!mimeOk && !extOk) {
    return { ok: false as const, message: "Formato no reconocido. Acepto mp3, m4a, wav, ogg, opus, mp4, webm y mov." };
  }
  return { ok: true as const, ext: extOk ? ext : "bin" };
}
