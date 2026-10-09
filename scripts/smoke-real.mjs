#!/usr/bin/env node
/**
 * Prueba de punta a punta con audio real.
 *
 *   1. Sintetiza la reunión de ejemplo con voces de Deepgram (una por hablante) y la une con ffmpeg,
 *      o usa el archivo que le pases con --audio ruta.mp3.
 *   2. La procesa:
 *      - Por la app (por defecto): la misma API que usa el navegador (sesión anónima, URL firmada,
 *        arranque, espera). Requiere la app arrancada (npm run dev o npm start) y Supabase.
 *      - Con --sin-app: el motor directo (Deepgram → Claude) usando los módulos de src/lib, sin
 *        servidor ni base de datos. Sirve para medir transcripción y extracción donde no hay
 *        Supabase (CI, un portátil, un sandbox). Sin ANTHROPIC_API_KEY mide solo la transcripción.
 *   3. Vuelca tareas, decisiones, correos, dudas, tiempos por fase, minutos por hora de audio,
 *      porcentaje de tareas con responsable y coste. Con el audio sintetizado, además compara la
 *      transcripción con el guion (tasa de error por palabra y acierto de diarización).
 *
 * Claves en .env.local o en el entorno. Necesita ffmpeg en el PATH.
 *
 *   node scripts/smoke-real.mjs [--app http://localhost:3000] [--audio archivo] [--hint "de qué va"] [--sin-app]
 *
 * Códigos de salida: 0 todo bien · 1 error · 2 la reunión falló · 3 prueba parcial (sin extracción).
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

// ---------------------------------------------------------------- entorno
function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadDotEnv(resolve(".env.local"));
loadDotEnv(resolve(".env"));

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const SIN_APP = args.includes("--sin-app");
const APP = (opt("--app", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")).replace(/\/$/, "");
const AUDIO = opt("--audio", null);
const HINT = opt("--hint", "Captación del piso de calle Mayor con Carmen y Pedro");
const DG = process.env.DEEPGRAM_API_KEY;

// Los módulos de src/lib son TypeScript: Node los ejecuta con estas opciones (ver scripts/ts-hooks.mjs).
// `react-server` hace que `import "server-only"` no proteste fuera de Next.
const NODE_FLAGS = [
  "--experimental-transform-types",
  "--conditions=react-server",
  "--disable-warning=ExperimentalWarning",
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
];
if (SIN_APP && !process.execArgv.includes("--conditions=react-server")) {
  const r = spawnSync(process.execPath, [...NODE_FLAGS, ...process.argv.slice(1)], { stdio: "inherit" });
  process.exit(r.status ?? 1);
}

const required = SIN_APP ? ["DEEPGRAM_API_KEY"] : ["NEXT_PUBLIC_SUPABASE_URL", "DEEPGRAM_API_KEY"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(", ")} (en .env.local o en el entorno).`);
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("⚠ Sin ANTHROPIC_API_KEY en este entorno: se mide la transcripción y el recorrido; la extracción será la de demostración si la app tampoco tiene la clave.");
}

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

// ---------------------------------------------------------------- 1. audio real
const SEGMENTS = [
  ["spk_1", "Bueno, Carmen, Pedro, gracias por recibirme. Como os comenté por teléfono, la idea de hoy es ver el piso, hablar de precio y de cómo trabajaríamos."],
  ["spk_2", "Perfecto. Nosotros queremos venderlo antes de verano porque nos mudamos a Valencia en julio."],
  ["spk_1", "Entonces tenemos unos tres meses. Es un plazo razonable para esta zona. El piso son noventa y dos metros, tres habitaciones y la terraza, ¿no?"],
  ["spk_3", "Noventa y dos construidos, sí. La terraza son doce metros. Y tiene plaza de garaje en el mismo edificio."],
  ["spk_1", "Eso suma. He mirado cierres de los últimos seis meses en la calle Mayor y alrededores y la horquilla está entre doscientos ochenta y trescientos diez mil."],
  ["spk_2", "Nosotros habíamos pensado en trescientos veinte."],
  ["spk_1", "Lo entiendo. Mi recomendación es salir en trescientos cinco mil. Si salimos muy arriba, perdemos las dos primeras semanas, que son las que más visitas traen."],
  ["spk_3", "¿Y si sale a trescientos cinco y nos ofrecen doscientos noventa?"],
  ["spk_1", "Negociamos. Pero con ese precio de salida yo creo que cerramos cerca de trescientos."],
  ["spk_2", "Vale. Salimos en trescientos cinco. Pedro, ¿estás de acuerdo?"],
  ["spk_3", "Sí, de acuerdo. Trescientos cinco."],
  ["spk_1", "Perfecto, lo dejo apuntado: precio de salida trescientos cinco mil. Lo siguiente es la exclusiva. Trabajo con exclusiva de tres meses, que es justo vuestro plazo."],
  ["spk_2", "Tres meses nos parece bien. ¿Y los honorarios?"],
  ["spk_1", "El tres por ciento más IVA, solo si vendemos. Os lo mando todo por escrito en la nota de encargo para que lo veáis con calma."],
  ["spk_3", "Vale, pero mándanoslo esta semana, que mi hermano es abogado y quiero que le eche un ojo."],
  ["spk_1", "Sin problema. Os la envío mañana por la mañana. Para el anuncio necesito algunos documentos: la nota simple, el certificado energético y el último recibo del IBI."],
  ["spk_2", "El IBI lo tengo. El certificado energético creo que caducó."],
  ["spk_1", "Si está caducado lo gestiono yo con el técnico, son unos ochenta euros. Pedro, ¿la nota simple la pedís vosotros o la pido yo?"],
  ["spk_3", "Pídela tú, que sabes cómo va."],
  ["spk_1", "Hecho. La pido yo esta semana. Y para las fotos, el fotógrafo puede venir el jueves por la tarde. ¿Os viene bien a las cinco?"],
  ["spk_2", "El jueves a las cinco perfecto. Recogemos un poco la terraza antes."],
  ["spk_1", "Genial. Última cosa: la cocina tiene esa humedad junto a la ventana. Yo arreglaría eso antes de las fotos, se nota mucho."],
  ["spk_3", "Eso lo miramos. No te decimos ahora si lo arreglamos o no, depende de lo que nos cueste."],
  ["spk_1", "De acuerdo, me decís. Entonces resumo: salimos en trescientos cinco, exclusiva de tres meses, os mando la nota de encargo mañana, pido la nota simple y gestiono el certificado, y el jueves a las cinco fotos."],
  ["spk_2", "Perfecto, Laura. Muchas gracias."],
];
const SILENCE_SEC = 0.6;

// Voces en español de Aura-2; se puede forzar con TTS_VOICES="voz1,voz2,voz3".
const VOICE_CANDIDATES = {
  spk_1: ["aura-2-celeste-es", "aura-2-carina-es", "aura-2-estrella-es"],
  spk_2: ["aura-2-diana-es", "aura-2-selena-es", "aura-2-aquila-es"],
  spk_3: ["aura-2-sirio-es", "aura-2-nestor-es", "aura-2-javier-es"],
};
if (process.env.TTS_VOICES) {
  const [a, b, c] = process.env.TTS_VOICES.split(",").map((s) => s.trim());
  if (a) VOICE_CANDIDATES.spk_1 = [a];
  if (b) VOICE_CANDIDATES.spk_2 = [b];
  if (c) VOICE_CANDIDATES.spk_3 = [c];
}

async function speak(text, voices) {
  let lastErr = "";
  for (const model of voices) {
    // Hasta tres intentos por voz: los cortes de red puntuales no deben tirar la síntesis entera.
    for (let attempt = 1; attempt <= 3; attempt++) {
      let res;
      try {
        res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=24000&container=wav`, {
          method: "POST",
          headers: { Authorization: `Token ${DG}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      } catch (err) {
        lastErr = `${model}: ${err.message}`;
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      if (res.ok) return { model, audio: Buffer.from(await res.arrayBuffer()) };
      lastErr = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      break; // 4xx distinto de 429: la voz no vale, probar la siguiente
    }
  }
  throw new Error(`Ninguna voz válida. Último error: ${lastErr}`);
}

function probeDuration(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
    return Number(out) || null;
  } catch {
    return null;
  }
}

/** Guion con tiempos reales de cada intervención, para medir la transcripción. */
function referencePath(audio) {
  return audio.replace(/\.(mp3|wav)$/, ".guion.json");
}

async function synthesizeMeeting(outDir) {
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "reunion-ejemplo.mp3");
  const wavOut = out.replace(/\.mp3$/, ".wav");
  for (const f of [out, wavOut]) {
    if (existsSync(f)) {
      log(`Audio ya sintetizado: ${f}`);
      return f;
    }
  }
  log("Sintetizando la reunión de ejemplo con voces de Deepgram…");
  const vocesFile = resolve(outDir, "voces.json");
  const chosen = existsSync(vocesFile) ? JSON.parse(readFileSync(vocesFile, "utf8")) : {};
  const parts = [];
  const reference = [];
  let cursor = 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [spk, text] = SEGMENTS[i];
    const file = resolve(outDir, `seg-${String(i).padStart(2, "0")}.wav`);
    // Los segmentos ya sintetizados se reutilizan: si una ejecución se corta, la siguiente continúa.
    if (!existsSync(file) || !chosen[spk]) {
      const voices = chosen[spk] ? [chosen[spk]] : VOICE_CANDIDATES[spk];
      const { model, audio } = await speak(text, voices);
      chosen[spk] = model;
      writeFileSync(file, audio);
      writeFileSync(vocesFile, JSON.stringify(chosen));
    }
    parts.push(file);
    const dur = probeDuration(file) ?? 0;
    reference.push({ speaker: spk, start: cursor, end: cursor + dur, text });
    cursor += dur + SILENCE_SEC;
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  log(`Voces: ${Object.entries(chosen).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  // Silencio entre intervenciones para que la diarización respire.
  const silence = resolve(outDir, "silence.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", String(SILENCE_SEC), silence]);
  const list = resolve(outDir, "concat.txt");
  writeFileSync(list, parts.flatMap((p) => [`file '${p}'`, `file '${silence}'`]).join("\n"));
  let result = out;
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "libmp3lame", "-q:a", "4", out]);
  } catch {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", wavOut]);
    result = wavOut;
  }
  writeFileSync(referencePath(result), JSON.stringify({ voices: chosen, segments: reference }, null, 2));
  return result;
}

// ---------------------------------------------------------------- medidas de transcripción
function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Deepgram escribe las cantidades con cifras («trescientos cinco mil» → «305000»); para medir solo el
// reconocimiento, una segunda tasa quita los numerales del guion y los dígitos de la transcripción.
const NUMERALS = new Set(
  "cero dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiuno veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve treinta cuarenta cincuenta sesenta setenta ochenta noventa cien ciento cientos doscientos doscientas trescientos trescientas cuatrocientos quinientos seiscientos setecientos ochocientos novecientos mil millon millones".split(" "),
);
const isNumeral = (w) => NUMERALS.has(w) || /^[0-9]+$/.test(w);

/** Tasa de error por palabra (Levenshtein sobre palabras) y los primeros cambios para verlos. */
function wordErrorRate(refText, hypText, { ignoreNumbers = false } = {}) {
  const drop = (w) => ignoreNumbers && isNumeral(w);
  const ref = normalizeWords(refText).filter((w) => !drop(w));
  const hyp = normalizeWords(hypText).filter((w) => !drop(w));
  const n = ref.length;
  const m = hyp.length;
  const d = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
    }
  }
  // Recorrido inverso para listar las diferencias.
  const edits = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1] && d[i][j] === d[i - 1][j - 1]) {
      i--;
      j--;
    } else if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) {
      edits.unshift(`${ref[i - 1]}→${hyp[j - 1]}`);
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      edits.unshift(`−${ref[i - 1]}`);
      i--;
    } else {
      edits.unshift(`+${hyp[j - 1]}`);
      j--;
    }
  }
  return { wer: n ? d[n][m] / n : 0, errors: d[n][m], words: n, edits };
}

/** Acierto de diarización: tiempo de habla asignado al hablante correcto, con la mejor correspondencia. */
function diarizationAccuracy(reference, segments) {
  const overlap = {};
  let total = 0;
  for (const h of segments) {
    for (const r of reference) {
      const o = Math.max(0, Math.min(h.end, r.end) - Math.max(h.start, r.start));
      if (o <= 0) continue;
      overlap[h.speaker] ??= {};
      overlap[h.speaker][r.speaker] = (overlap[h.speaker][r.speaker] ?? 0) + o;
      total += o;
    }
  }
  let correct = 0;
  const mapping = {};
  for (const [hyp, byRef] of Object.entries(overlap)) {
    const [best, t] = Object.entries(byRef).sort((a, b) => b[1] - a[1])[0];
    mapping[hyp] = best;
    correct += t;
  }
  const detected = Object.keys(overlap).length;
  const expected = new Set(reference.map((r) => r.speaker)).size;
  return { accuracy: total ? correct / total : 0, detected, expected, mapping };
}

// ---------------------------------------------------------------- informe común a los dos modos
function printReport(r) {
  console.log(`\n== ${r.title} ==`);
  console.log(r.summary);
  if (r.qualityWarning) console.log(`\nAviso de calidad: ${r.qualityWarning}`);
  console.log(`\nParticipantes: ${r.participants.map((p) => `${p.name ?? p.key}${p.isUser ? " (tú)" : ""}${p.role ? ` · ${p.role}` : ""}`).join(", ")}`);
  console.log(`\nTAREAS (${r.tasks.length})`);
  for (const t of r.tasks) {
    console.log(`  [${t.priority === "alta" ? "!" : " "}] ${t.text} — ${t.owner}${t.due ? ` — ${t.due}${t.dateInferred ? " (deducida)" : ""}` : ""}${t.suggested ? " (sugerida)" : ""}  («${t.quote}», ${t.ts})`);
  }
  console.log(`\nDECISIONES (${r.decisions.length})`);
  for (const d of r.decisions) console.log(`  • ${d.text} — ${d.by} (${d.ts})`);
  console.log(`\nCORREOS (${r.emails.length})`);
  for (const e of r.emails) console.log(`  → ${e.to}: ${e.subject}\n${e.body.split("\n").map((l) => "      " + l).join("\n")}\n`);
  if (r.questions.length) {
    console.log(`DUDAS (${r.questions.length})`);
    for (const q of r.questions) console.log(`  ? ${q.text}`);
  }

  const withOwner = r.tasks.filter((t) => t.hasOwner).length;
  const hours = (r.durationSec ?? 0) / 3600;
  console.log(`\n== Medidas ==`);
  console.log(
    `  ${r.timings.upload != null ? `subida: ${secs(r.timings.upload)} · ` : ""}transcripción: ${secs(r.timings.transcribe ?? 0)} · extracción: ${secs(r.timings.extract ?? 0)} · total: ${secs(r.timings.total)}`,
  );
  if (hours > 0) console.log(`  equivale a ${(r.timings.total / 1000 / hours / 60).toFixed(1)} min por hora de audio (objetivo < 2)`);
  console.log(`  tareas con responsable: ${r.tasks.length ? Math.round((withOwner / r.tasks.length) * 100) : 0} % (objetivo ≥ 80 %)`);
  console.log(`  coste extracción: ${r.costCents != null ? (r.costCents / 100).toFixed(2) + " $" : "n/d"}${r.model ? ` (${r.model})` : ""} · idioma: ${r.language}`);
}

function reportFromExtraction(x, meta) {
  const name = (id) => {
    const p = x.participants.find((p) => p.id === id);
    return p ? (p.name ?? `Hablante ${p.id.replace("spk_", "")}`) : "¿?";
  };
  return {
    title: x.title,
    summary: x.summary,
    qualityWarning: x.quality_warning,
    participants: x.participants.map((p) => ({ key: p.id, name: p.name, role: p.role, isUser: p.is_user })),
    tasks: x.tasks.map((t) => ({ ...t, owner: name(t.owner_id), hasOwner: Boolean(t.owner_id), due: t.due_date, dateInferred: t.date_inferred, quote: t.evidence.quote, ts: t.evidence.timestamp })),
    decisions: x.decisions.map((d) => ({ text: d.text, by: name(d.decided_by), ts: d.evidence.timestamp })),
    emails: x.emails.map((e) => ({ to: e.to_label, subject: e.subject, body: e.body })),
    questions: x.open_questions,
    language: x.language,
    ...meta,
  };
}

function reportFromBundle(b, meta) {
  const { meeting, participants, tasks, decisions, emails, questions } = b;
  const name = (id) => {
    const p = participants.find((x) => x.id === id);
    return p ? (p.name ?? `Hablante ${p.speaker_key.replace("spk_", "")}`) : "¿?";
  };
  return {
    title: meeting.title,
    summary: meeting.summary,
    qualityWarning: meeting.quality_warning,
    participants: participants.map((p) => ({ key: p.speaker_key, name: p.name, role: p.role, isUser: p.is_user })),
    tasks: tasks.map((t) => ({ ...t, owner: name(t.owner_participant_id), hasOwner: Boolean(t.owner_participant_id), due: t.due_date, dateInferred: t.date_inferred, quote: t.evidence_quote, ts: t.evidence_ts })),
    decisions: decisions.map((d) => ({ text: d.text, by: name(d.decided_by_participant_id), ts: d.evidence_ts })),
    emails: emails.map((e) => ({ to: e.to_label, subject: e.subject, body: e.body })),
    questions,
    language: meeting.language,
    costCents: meeting.cost_cents,
    ...meta,
  };
}

// ---------------------------------------------------------------- 2a. la API, con cookies
const jar = new Map();
function cookieHeader() {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
async function api(path, init = {}) {
  const res = await fetch(`${APP}${path}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: cookieHeader() } });
  storeCookies(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* no JSON */
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${json?.error ?? text.slice(0, 200)}`);
  return json;
}

async function runThroughApp({ audioPath, file, mime, durationSec }) {
  const t0 = Date.now();
  const prep = await api("/api/meetings/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: audioPath.split("/").pop(), mime, size: file.length, durationSec, hint: HINT }),
  });
  log(`Reunión creada ${prep.meetingId}. Subiendo…`);

  const up = await fetch(prep.signedUrl, { method: "PUT", headers: { "Content-Type": mime, "x-upsert": "true" }, body: file });
  if (!up.ok) throw new Error(`Subida → ${up.status}: ${(await up.text()).slice(0, 200)}`);
  const tUpload = Date.now();

  const start = await api(`/api/meetings/${prep.meetingId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationSec }),
  });
  log(`Procesado lanzado vía ${start.via}.`);

  let last = "";
  const deadline = Date.now() + 10 * 60 * 1000;
  let status;
  while (Date.now() < deadline) {
    status = await api(`/api/meetings/${prep.meetingId}/status`);
    if (status.status !== last) {
      log(`estado: ${status.status}`);
      last = status.status;
    }
    if (status.status === "ready" || status.status === "failed") break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  const tEnd = Date.now();
  if (!status || status.status !== "ready") {
    console.error(`\n✗ La reunión no quedó lista: ${status?.status} ${status?.error ?? ""}`);
    process.exit(2);
  }

  const bundle = await api(`/api/meetings/${prep.meetingId}/json`);
  const timings = bundle.meeting.phase_timings ?? {};
  printReport(
    reportFromBundle(bundle, {
      durationSec,
      timings: { upload: tUpload - t0, transcribe: timings.transcribe, extract: timings.extract, total: tEnd - t0 },
    }),
  );
  const model = bundle.meeting.extraction_model ?? "?";
  console.log(`\nModelo de extracción: ${model}`);
  if (model === "demo") {
    console.log("⚠ La app no tiene ANTHROPIC_API_KEY: las tareas y decisiones de arriba son las de demostración, no salen del audio. Ponle la clave y repite para medir a Claude.");
  }
  console.log(`\nAbre ${APP}/app/r/${bundle.meeting.id} con el mismo navegador que la cookie, o inicia sesión y revisa la reunión.`);
}

// ---------------------------------------------------------------- 2b. el motor directo, sin app
async function runEngine({ audioPath, file, mime, durationSec }) {
  const { register } = await import("node:module");
  register("./ts-hooks.mjs", import.meta.url);
  const { deepgramProvider } = await import("../src/lib/transcription/deepgram.ts");
  const { extract, canExtract, EXTRACTION_MODEL } = await import("../src/lib/ai/extract.ts");
  const { formatTranscript } = await import("../src/lib/ai/prompt.ts");
  const { todayISO } = await import("../src/lib/format.ts");

  const t0 = Date.now();
  log("Transcribiendo con Deepgram (diarización, detección de idioma)…");
  const transcript = await deepgramProvider.transcribe({ bytes: file, mime });
  const tTranscribe = Date.now() - t0;
  log(`Transcripción: ${transcript.segments.length} intervenciones, idioma ${transcript.language ?? "?"}, ${transcript.duration_sec ?? "?"} s, en ${secs(tTranscribe)}.`);
  console.log(formatTranscript(transcript.segments).split("\n").map((l) => "    " + l).join("\n"));

  const refFile = referencePath(audioPath);
  if (existsSync(refFile)) {
    const reference = JSON.parse(readFileSync(refFile, "utf8")).segments;
    const refText = reference.map((s) => s.text).join(" ");
    const hypText = transcript.segments.map((s) => s.text).join(" ");
    const w = wordErrorRate(refText, hypText);
    const wn = wordErrorRate(refText, hypText, { ignoreNumbers: true });
    const d = diarizationAccuracy(reference, transcript.segments);
    console.log(`\n== Transcripción frente al guion ==`);
    console.log(`  error por palabra: ${(w.wer * 100).toFixed(1)} % (${w.errors} de ${w.words}; «noventa y dos»→«92» cuenta como error) · sin cifras: ${(wn.wer * 100).toFixed(1)} % (${wn.errors} de ${wn.words})`);
    if (wn.edits.length) console.log(`  cambios (sin cifras): ${wn.edits.slice(0, 20).join(", ")}${wn.edits.length > 20 ? ", …" : ""}`);
    console.log(`  hablantes detectados: ${d.detected} de ${d.expected} · habla asignada al hablante correcto: ${(d.accuracy * 100).toFixed(1)} %`);
    console.log(`  correspondencia: ${Object.entries(d.mapping).map(([h, r]) => `${h}→${r}`).join(", ")}`);
  }

  if (!canExtract()) {
    console.log(`\n⚠ Extracción omitida: falta ANTHROPIC_API_KEY. Con la clave, este mismo comando ejecuta Claude (${EXTRACTION_MODEL}) y mide la extracción.`);
    console.log(`  Medidas: transcripción ${secs(tTranscribe)}${durationSec ? ` · ${(tTranscribe / 1000 / (durationSec / 3600) / 60).toFixed(1)} min por hora de audio` : ""}`);
    process.exit(3);
  }

  log(`Extrayendo con Claude (${EXTRACTION_MODEL})…`);
  const t1 = Date.now();
  // Mismo contexto que tiene la app para un usuario anónimo: sin nombre, sin firma, sin contactos.
  const result = await extract({
    context: { userName: null, company: null, phone: null, signature: null, locale: "es", meetingDate: todayISO(), hint: HINT, knownContacts: [], previousMeetings: [] },
    segments: transcript.segments,
    isDemo: false,
  });
  const tExtract = Date.now() - t1;
  log(`Extracción en ${secs(tExtract)} (${result.usage ? `${result.usage.input} tokens de entrada, ${result.usage.output} de salida, ${result.usage.cacheRead} leídos de caché` : "sin datos de uso"}).`);
  mkdirSync(resolve("scratch"), { recursive: true });
  const dump = resolve("scratch", "ultima-extraccion.json");
  writeFileSync(dump, JSON.stringify({ transcript, ...result }, null, 2));

  printReport(
    reportFromExtraction(result.extraction, {
      durationSec: durationSec ?? transcript.duration_sec,
      timings: { transcribe: tTranscribe, extract: tExtract, total: Date.now() - t0 },
      costCents: result.costCents,
      model: result.model,
    }),
  );
  console.log(`\nSin app no se guarda nada en Supabase; la extracción completa está en ${dump}.`);
}

async function main() {
  const scratch = resolve("scratch");
  const audioPath = AUDIO ? resolve(AUDIO) : await synthesizeMeeting(scratch);
  const file = readFileSync(audioPath);
  const durationSec = probeDuration(audioPath);
  const mime = audioPath.endsWith(".wav") ? "audio/wav" : audioPath.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
  log(`Audio: ${audioPath} (${(file.length / 1024 / 1024).toFixed(1)} MB, ${durationSec ? Math.round(durationSec) : "?"} s)`);

  const input = { audioPath, file, mime, durationSec };
  if (SIN_APP) await runEngine(input);
  else await runThroughApp(input);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
