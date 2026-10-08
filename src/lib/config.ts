/**
 * Variables del producto (sección 0 del prompt).
 * El nombre es provisional hasta que se elija uno de los tres propuestos en PLAN.md.
 */
export const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "Resumen";

export const SECTOR = "Agencias inmobiliarias (compraventa y alquiler residencial, España)";

/** Reuniones gratis antes de pedir el plan Pro. */
export const FREE_MEETINGS = 3;

/** Límites para quien aún no ha dado su email (usuario anónimo). */
export const ANON_MAX_AUDIO_SECONDS = 30 * 60;
export const ANON_MAX_MEETINGS = 1;

/** Precio del plan Pro, en euros al mes. */
export const PRO_PRICE_EUR = 29;

/** Retención de audio por defecto, en días. */
export const DEFAULT_RETENTION_DAYS = 30;

/** Tamaño máximo de archivo aceptado (500 MB). */
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

export const ACCEPTED_MIME = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "audio/aac",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

export const ACCEPTED_EXTENSIONS = ["mp3", "m4a", "wav", "ogg", "opus", "aac", "flac", "webm", "mp4", "mov", "m4v"];
