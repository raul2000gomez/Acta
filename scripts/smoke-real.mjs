#!/usr/bin/env node
/**
 * Prueba de punta a punta con audio real, por la misma API que usa el navegador.
 *
 *   1. Sintetiza la reunión de ejemplo con voces de Deepgram (una por hablante) y la une con ffmpeg,
 *      o usa el archivo que le pases con --audio ruta.mp3.
 *   2. Crea la reunión (sesión anónima), sube el audio a Storage por URL firmada y arranca el procesado.
 *   3. Espera a que esté lista mostrando las fases, y vuelca tareas, decisiones, correos, tiempos y coste.
 *
 * Requiere la app arrancada (npm run dev o npm start) y las claves en .env.local o en el entorno.
 *
 *   node scripts/smoke-real.mjs [--app http://localhost:3000] [--audio archivo] [--hint "de qué va"]
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const APP = (opt("--app", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")).replace(/\/$/, "");
const AUDIO = opt("--audio", null);
const HINT = opt("--hint", "Captación del piso de calle Mayor con Carmen y Pedro");
const DG = process.env.DEEPGRAM_API_KEY;

const missing = ["NEXT_PUBLIC_SUPABASE_URL", "DEEPGRAM_API_KEY", "ANTHROPIC_API_KEY"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables: ${missing.join(", ")} (en .env.local o en el entorno).`);
  process.exit(1);
}

const log = (msg) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);

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
    const res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=linear16&sample_rate=24000&container=wav`, {
      method: "POST",
      headers: { Authorization: `Token ${DG}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) return { model, audio: Buffer.from(await res.arrayBuffer()) };
    lastErr = `${model}: ${res.status} ${(await res.text()).slice(0, 200)}`;
  }
  throw new Error(`Ninguna voz válida. Último error: ${lastErr}`);
}

async function synthesizeMeeting(outDir) {
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "reunion-ejemplo.mp3");
  if (existsSync(out)) {
    log(`Audio ya sintetizado: ${out}`);
    return out;
  }
  log("Sintetizando la reunión de ejemplo con voces de Deepgram…");
  const chosen = {};
  const parts = [];
  for (let i = 0; i < SEGMENTS.length; i++) {
    const [spk, text] = SEGMENTS[i];
    const voices = chosen[spk] ? [chosen[spk]] : VOICE_CANDIDATES[spk];
    const { model, audio } = await speak(text, voices);
    chosen[spk] = model;
    const file = resolve(outDir, `seg-${String(i).padStart(2, "0")}.wav`);
    writeFileSync(file, audio);
    parts.push(file);
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  log(`Voces: ${Object.entries(chosen).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  // 0,6 s de silencio entre intervenciones para que la diarización respire.
  const silence = resolve(outDir, "silence.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.6", silence]);
  const list = resolve(outDir, "concat.txt");
  writeFileSync(list, parts.flatMap((p) => [`file '${p}'`, `file '${silence}'`]).join("\n"));
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c:a", "libmp3lame", "-q:a", "4", out]);
  } catch {
    const wav = out.replace(/\.mp3$/, ".wav");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", wav]);
    return wav;
  }
  return out;
}

function probeDuration(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim();
    return Number(out) || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- 2. la API, con cookies
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

async function main() {
  const scratch = resolve("scratch");
  const audioPath = AUDIO ? resolve(AUDIO) : await synthesizeMeeting(scratch);
  const file = readFileSync(audioPath);
  const durationSec = probeDuration(audioPath);
  const mime = audioPath.endsWith(".wav") ? "audio/wav" : audioPath.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
  log(`Audio: ${audioPath} (${(file.length / 1024 / 1024).toFixed(1)} MB, ${durationSec ? Math.round(durationSec) : "?"} s)`);

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

  const b = await api(`/api/meetings/${prep.meetingId}/json`);
  const { meeting, participants, tasks, decisions, emails, questions } = b;
  const name = (id) => {
    const p = participants.find((x) => x.id === id);
    return p ? (p.name ?? `Hablante ${p.speaker_key.replace("spk_", "")}`) : "¿?";
  };

  console.log(`\n== ${meeting.title} ==`);
  console.log(meeting.summary);
  console.log(`\nParticipantes: ${participants.map((p) => `${p.name ?? p.speaker_key}${p.is_user ? " (tú)" : ""}${p.role ? ` · ${p.role}` : ""}`).join(", ")}`);
  console.log(`\nTAREAS (${tasks.length})`);
  for (const t of tasks) console.log(`  [${t.priority === "alta" ? "!" : " "}] ${t.text} — ${name(t.owner_participant_id)}${t.due_date ? ` — ${t.due_date}` : ""}  («${t.evidence_quote}», ${t.evidence_ts})`);
  console.log(`\nDECISIONES (${decisions.length})`);
  for (const d of decisions) console.log(`  • ${d.text} — ${name(d.decided_by_participant_id)} (${d.evidence_ts})`);
  console.log(`\nCORREOS (${emails.length})`);
  for (const e of emails) console.log(`  → ${e.to_label}: ${e.subject}\n${e.body.split("\n").map((l) => "      " + l).join("\n")}\n`);
  if (questions.length) {
    console.log(`DUDAS (${questions.length})`);
    for (const q of questions) console.log(`  ? ${q.text}`);
  }

  const timings = meeting.phase_timings ?? {};
  const withOwner = tasks.filter((t) => t.owner_participant_id).length;
  const hours = (durationSec ?? 0) / 3600;
  console.log(`\n== Medidas ==`);
  console.log(`  subida: ${((tUpload - t0) / 1000).toFixed(1)} s · transcripción: ${((timings.transcribe ?? 0) / 1000).toFixed(1)} s · extracción: ${((timings.extract ?? 0) / 1000).toFixed(1)} s · total: ${((tEnd - t0) / 1000).toFixed(1)} s`);
  if (hours > 0) console.log(`  equivale a ${((tEnd - t0) / 1000 / hours / 60).toFixed(1)} min por hora de audio (objetivo < 2)`);
  console.log(`  tareas con responsable: ${tasks.length ? Math.round((withOwner / tasks.length) * 100) : 0} % (objetivo ≥ 80 %)`);
  console.log(`  coste extracción: ${meeting.cost_cents != null ? (meeting.cost_cents / 100).toFixed(2) + " $" : "n/d"} · idioma: ${meeting.language}`);
  console.log(`\nAbre ${APP}/app/r/${meeting.id} con el mismo navegador que la cookie, o inicia sesión y revisa la reunión.`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
