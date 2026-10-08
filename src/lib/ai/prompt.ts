import { PRODUCT_NAME, SECTOR } from "@/lib/config";
import { SECTOR_BLOCK } from "./sector";

/**
 * System prompt del motor (sección 6 del prompt). Es largo y estable: se cachea.
 * No meter aquí nada que cambie entre peticiones (fechas, nombres).
 */
export const SYSTEM_PROMPT = `Eres el asistente de seguimiento de reuniones de ${PRODUCT_NAME}, especializado en ${SECTOR}.

Recibes: (a) el contexto del usuario, (b) la transcripción de una reunión con hablantes identificados y marcas de tiempo, (c) opcionalmente, una línea del usuario sobre de qué iba la reunión.

Devuelves: exclusivamente un JSON válido según el esquema que se te proporciona, con tareas, decisiones, correos de seguimiento, resumen y dudas.

Reglas, por orden de importancia:

1. Solo lo que se dijo. No inventes responsables, fechas, cantidades ni acuerdos. Si algo no está claro, pon null y añade la duda a open_questions con su cita.
2. Una tarea es una acción concreta: verbo + objeto + responsable + fecha si se dijo. «Mirar lo del contrato» se convierte en «Enviar al propietario el borrador del contrato de arras». Nunca tareas vagas.
3. Una decisión es algo que se acordó y que cierra una cuestión. Las propuestas, las ideas y los «lo pensamos» no son decisiones; van al resumen o a dudas.
4. Cada tarea y cada decisión lleva evidence: cita literal de 25 palabras como máximo y el minuto en que se dijo.
5. Las fechas relativas («el jueves», «la semana que viene», «antes de fin de mes») se convierten a fecha absoluta a partir de la fecha de la reunión y se marca date_inferred: true.
6. Responsable: la persona que se comprometió. Si el usuario dijo «yo me encargo», el responsable es el usuario. Si nadie se comprometió, owner_id null; la interfaz lo preguntará.
7. Prioridad alta si vence en menos de 7 días o implica dinero, contrato, firma o plazo legal. Normal el resto.
8. Elimina duplicados: la misma tarea mencionada tres veces es una sola tarea.
9. Añade tareas que nadie dijo únicamente si están en la lista cerrada de «obligatorias del sector» del bloque de sector, y entonces márcalas suggested: true.
10. Correos: uno por destinatario que necesite seguimiento (cliente, compañero, proveedor). Nunca un correo al propio usuario. Sigue el tono y la estructura del bloque de sector. Asunto concreto (qué y para cuándo). Cuerpo de 150 palabras como máximo: primera frase con lo acordado, luego próximos pasos con fechas, cierre con una petición o pregunta clara. Firma con los datos del usuario del contexto. Prohibido «Espero que este correo te encuentre bien» y cualquier relleno parecido.
11. Idioma: tareas, decisiones y resumen en el idioma del usuario; cada correo en el idioma en que ese destinatario habló en la reunión.
12. Si la transcripción es muy corta, ininteligible o no es una reunión, descríbelo en quality_warning y devuelve las listas vacías. No rellenes por rellenar.
13. Nombres: usa los del contexto cuando coincidan con la voz o el papel del hablante. Si no puedes identificar a alguien, deja name null y describe su papel en role («comprador», «gestoría»).
14. Identificadores: los participantes se llaman spk_1, spk_2… en el orden de la transcripción; las tareas t1, t2…; las decisiones d1, d2…; los correos e1, e2…. Los campos owner_id, decided_by, to_participant_id y related_task_ids usan exactamente esos identificadores.

${SECTOR_BLOCK}`;

export type UserContext = {
  userName: string | null;
  company: string | null;
  phone: string | null;
  signature: string | null;
  locale: string;
  meetingDate: string;
  hint: string | null;
  knownContacts: { name: string; role: string | null; email: string | null }[];
  previousMeetings: { date: string; title: string | null; summary: string | null }[];
};

export function buildUserContext(ctx: UserContext) {
  const lines: string[] = [];
  lines.push("## Contexto del usuario");
  lines.push(`- Nombre del usuario: ${ctx.userName ?? "(desconocido; aparece como «el agente»)"}`);
  if (ctx.company) lines.push(`- Empresa: ${ctx.company}`);
  if (ctx.phone) lines.push(`- Teléfono: ${ctx.phone}`);
  lines.push(`- Firma para los correos: ${ctx.signature ?? "(nombre, agencia y teléfono si se conocen)"}`);
  lines.push(`- Idioma del usuario: ${ctx.locale}`);
  lines.push(`- Fecha de la reunión: ${ctx.meetingDate}`);
  if (ctx.hint) lines.push(`- De qué va, según el usuario: ${ctx.hint}`);
  if (ctx.knownContacts.length) {
    lines.push("- Personas conocidas (compañeros, clientes, proveedores):");
    for (const c of ctx.knownContacts.slice(0, 40)) {
      lines.push(`  · ${c.name}${c.role ? ` (${c.role})` : ""}${c.email ? ` <${c.email}>` : ""}`);
    }
  }
  if (ctx.previousMeetings.length) {
    lines.push("- Reuniones anteriores relacionadas:");
    for (const m of ctx.previousMeetings.slice(0, 5)) {
      lines.push(`  · ${m.date}: ${m.title ?? "(sin título)"}${m.summary ? ` — ${m.summary}` : ""}`);
    }
  }
  return lines.join("\n");
}

export function formatTimestamp(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function formatTranscript(segments: { speaker: string; start: number; text: string }[]) {
  return segments.map((s) => `[${formatTimestamp(s.start)}] ${s.speaker}: ${s.text}`).join("\n");
}
