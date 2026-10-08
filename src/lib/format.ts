/** Formato de fechas, duraciones y textos en español de España. */

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-ES", opts).format(d);
}

export function formatDateLong(iso: string | null | undefined) {
  return formatDate(iso, { weekday: "long", day: "numeric", month: "long" });
}

/** «hoy», «mañana», «lunes 14 oct», «vencida hace 2 días»… */
export function relativeDay(iso: string | null | undefined, today = new Date()) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff < -1) return `hace ${-diff} días`;
  if (diff < 7) return formatDate(iso, { weekday: "long" });
  return formatDate(iso, { day: "numeric", month: "short" });
}

export function todayISO(date = new Date()) {
  const tz = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

/** Estimación honesta del tiempo de procesado para una duración de audio. */
export function estimateProcessingSeconds(durationSec: number | null | undefined) {
  const d = durationSec ?? 1800;
  return Math.round(25 + d * 0.035);
}

export function formatEstimate(seconds: number) {
  if (seconds < 50) return "menos de un minuto";
  const min = Math.max(1, Math.round(seconds / 60));
  return min === 1 ? "un minuto" : `unos ${min} minutos`;
}

export function pluralize(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}
