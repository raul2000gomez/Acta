import type { Extraction } from "@/lib/ai/schema";
import type { Transcript } from "@/lib/supabase/types";

/**
 * Reunión de ejemplo del sector (regla: probar todo el flujo sin subir nada).
 * Captación de un piso en la calle Mayor: la agente (usuario) con los dos propietarios.
 */
export const DEMO_TITLE = "Captación piso calle Mayor · Carmen y Pedro";
export const DEMO_HINT = "Captación del piso de calle Mayor con Carmen y Pedro";

export const DEMO_TRANSCRIPT: Transcript = {
  provider: "demo",
  language: "es",
  duration_sec: 200,
  segments: [
    { speaker: "spk_1", start: 0, end: 11, text: "Bueno, Carmen, Pedro, gracias por recibirme. Como os comenté por teléfono, la idea de hoy es ver el piso, hablar de precio y de cómo trabajaríamos." },
    { speaker: "spk_2", start: 12, end: 19, text: "Perfecto. Nosotros queremos venderlo antes de verano porque nos mudamos a Valencia en julio." },
    { speaker: "spk_1", start: 20, end: 30, text: "Entonces tenemos unos tres meses. Es un plazo razonable para esta zona. El piso son noventa y dos metros, tres habitaciones y la terraza, ¿no?" },
    { speaker: "spk_3", start: 31, end: 39, text: "Noventa y dos construidos, sí. La terraza son doce metros. Y tiene plaza de garaje en el mismo edificio." },
    { speaker: "spk_1", start: 40, end: 51, text: "Eso suma. He mirado cierres de los últimos seis meses en la calle Mayor y alrededores y la horquilla está entre doscientos ochenta y trescientos diez mil." },
    { speaker: "spk_2", start: 52, end: 56, text: "Nosotros habíamos pensado en trescientos veinte." },
    { speaker: "spk_1", start: 57, end: 68, text: "Lo entiendo. Mi recomendación es salir en trescientos cinco mil. Si salimos muy arriba, perdemos las dos primeras semanas, que son las que más visitas traen." },
    { speaker: "spk_3", start: 69, end: 73, text: "¿Y si sale a trescientos cinco y nos ofrecen doscientos noventa?" },
    { speaker: "spk_1", start: 74, end: 79, text: "Negociamos. Pero con ese precio de salida yo creo que cerramos cerca de trescientos." },
    { speaker: "spk_2", start: 80, end: 84, text: "Vale. Salimos en trescientos cinco. Pedro, ¿estás de acuerdo?" },
    { speaker: "spk_3", start: 85, end: 87, text: "Sí, de acuerdo. Trescientos cinco." },
    { speaker: "spk_1", start: 88, end: 99, text: "Perfecto, lo dejo apuntado: precio de salida trescientos cinco mil. Lo siguiente es la exclusiva. Trabajo con exclusiva de tres meses, que es justo vuestro plazo." },
    { speaker: "spk_2", start: 100, end: 103, text: "Tres meses nos parece bien. ¿Y los honorarios?" },
    { speaker: "spk_1", start: 104, end: 112, text: "El tres por ciento más IVA, solo si vendemos. Os lo mando todo por escrito en la nota de encargo para que lo veáis con calma." },
    { speaker: "spk_3", start: 113, end: 118, text: "Vale, pero mándanoslo esta semana, que mi hermano es abogado y quiero que le eche un ojo." },
    { speaker: "spk_1", start: 119, end: 131, text: "Sin problema. Os la envío mañana por la mañana. Para el anuncio necesito algunos documentos: la nota simple, el certificado energético y el último recibo del IBI." },
    { speaker: "spk_2", start: 132, end: 136, text: "El IBI lo tengo. El certificado energético creo que caducó." },
    { speaker: "spk_1", start: 137, end: 146, text: "Si está caducado lo gestiono yo con el técnico, son unos ochenta euros. Pedro, ¿la nota simple la pedís vosotros o la pido yo?" },
    { speaker: "spk_3", start: 147, end: 149, text: "Pídela tú, que sabes cómo va." },
    { speaker: "spk_1", start: 150, end: 159, text: "Hecho. La pido yo esta semana. Y para las fotos, el fotógrafo puede venir el jueves por la tarde. ¿Os viene bien a las cinco?" },
    { speaker: "spk_2", start: 160, end: 164, text: "El jueves a las cinco perfecto. Recogemos un poco la terraza antes." },
    { speaker: "spk_1", start: 165, end: 173, text: "Genial. Última cosa: la cocina tiene esa humedad junto a la ventana. Yo arreglaría eso antes de las fotos, se nota mucho." },
    { speaker: "spk_3", start: 174, end: 179, text: "Eso lo miramos. No te decimos ahora si lo arreglamos o no, depende de lo que nos cueste." },
    { speaker: "spk_1", start: 180, end: 193, text: "De acuerdo, me decís. Entonces resumo: salimos en trescientos cinco, exclusiva de tres meses, os mando la nota de encargo mañana, pido la nota simple y gestiono el certificado, y el jueves a las cinco fotos." },
    { speaker: "spk_2", start: 194, end: 197, text: "Perfecto, Laura. Muchas gracias." },
  ],
};

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Próximo día de la semana (1 = lunes … 7 = domingo) estrictamente posterior a la fecha. */
function nextWeekday(date: string, weekday: number) {
  const d = new Date(`${date}T12:00:00Z`);
  const current = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  let delta = weekday - current;
  if (delta <= 0) delta += 7;
  return addDays(date, delta);
}

/** Extracción enlatada para la reunión de ejemplo (y para desarrollar sin clave de Claude). */
export function demoExtraction(meetingDate: string): Extraction {
  const tomorrow = addDays(meetingDate, 1);
  const friday = nextWeekday(meetingDate, 5);
  const thursday = nextWeekday(meetingDate, 4);

  return {
    title: DEMO_TITLE,
    summary:
      "Captación del piso de Carmen y Pedro en la calle Mayor (92 m², terraza y garaje), que quieren vender antes de julio. Se acuerda salir a 305.000 € con exclusiva de tres meses y honorarios del 3 % más IVA pendientes de ver por escrito. Laura envía mañana la nota de encargo, pide la nota simple y gestiona el certificado energético caducado. Fotos el jueves a las 17:00. Queda por decidir si reparan la humedad de la cocina antes de las fotos.",
    language: "es",
    quality_warning: null,
    participants: [
      { id: "spk_1", name: "Laura", role: "agente", is_user: true },
      { id: "spk_2", name: "Carmen", role: "propietaria", is_user: false },
      { id: "spk_3", name: "Pedro", role: "propietario", is_user: false },
    ],
    tasks: [
      {
        id: "t1",
        text: "Enviar a Carmen y Pedro la nota de encargo (exclusiva 3 meses, 3 % + IVA) para que la revise su abogado",
        owner_id: "spk_1",
        due_date: tomorrow,
        date_inferred: true,
        priority: "alta",
        suggested: false,
        evidence: { quote: "Sin problema. Os la envío mañana por la mañana.", timestamp: "01:59" },
      },
      {
        id: "t2",
        text: "Pedir la nota simple del piso de la calle Mayor",
        owner_id: "spk_1",
        due_date: friday,
        date_inferred: true,
        priority: "normal",
        suggested: false,
        evidence: { quote: "Hecho. La pido yo esta semana.", timestamp: "02:30" },
      },
      {
        id: "t3",
        text: "Gestionar con el técnico un certificado energético nuevo (unos 80 €)",
        owner_id: "spk_1",
        due_date: null,
        date_inferred: false,
        priority: "normal",
        suggested: false,
        evidence: { quote: "Si está caducado lo gestiono yo con el técnico, son unos ochenta euros.", timestamp: "02:17" },
      },
      {
        id: "t4",
        text: "Enviar a Laura el último recibo del IBI",
        owner_id: "spk_2",
        due_date: null,
        date_inferred: false,
        priority: "normal",
        suggested: false,
        evidence: { quote: "El IBI lo tengo.", timestamp: "02:12" },
      },
      {
        id: "t5",
        text: "Confirmar al fotógrafo la sesión del jueves a las 17:00 en la calle Mayor",
        owner_id: "spk_1",
        due_date: thursday,
        date_inferred: true,
        priority: "normal",
        suggested: false,
        evidence: { quote: "el fotógrafo puede venir el jueves por la tarde. ¿Os viene bien a las cinco?", timestamp: "02:30" },
      },
      {
        id: "t6",
        text: "Decidir si reparan la humedad de la cocina antes de las fotos",
        owner_id: "spk_3",
        due_date: thursday,
        date_inferred: true,
        priority: "normal",
        suggested: false,
        evidence: { quote: "Eso lo miramos. No te decimos ahora si lo arreglamos o no", timestamp: "02:54" },
      },
    ],
    decisions: [
      {
        id: "d1",
        text: "Precio de salida: 305.000 €",
        decided_by: "spk_2",
        involves_money_or_contract: true,
        evidence: { quote: "Vale. Salimos en trescientos cinco. Pedro, ¿estás de acuerdo?", timestamp: "01:20" },
      },
      {
        id: "d2",
        text: "Exclusiva de tres meses",
        decided_by: "spk_2",
        involves_money_or_contract: true,
        evidence: { quote: "Tres meses nos parece bien.", timestamp: "01:40" },
      },
      {
        id: "d3",
        text: "Laura pide la nota simple y gestiona el certificado energético",
        decided_by: "spk_3",
        involves_money_or_contract: false,
        evidence: { quote: "Pídela tú, que sabes cómo va.", timestamp: "02:27" },
      },
      {
        id: "d4",
        text: "Sesión de fotos el jueves a las 17:00",
        decided_by: "spk_2",
        involves_money_or_contract: false,
        evidence: { quote: "El jueves a las cinco perfecto. Recogemos un poco la terraza antes.", timestamp: "02:40" },
      },
    ],
    emails: [
      {
        id: "e1",
        to_participant_id: "spk_2",
        to_label: "Propietarios: Carmen y Pedro",
        subject: "Lo acordado hoy: salida a 305.000 €, nota de encargo mañana y fotos el jueves",
        body: `Hola Carmen, hola Pedro:

Gracias por la reunión de hoy. Os dejo por escrito lo que hemos acordado:

• Precio de salida: 305.000 €.
• Exclusiva de tres meses, honorarios del 3 % + IVA solo si vendemos.
• Mañana por la mañana os envío la nota de encargo para que la revise vuestro abogado.
• Yo pido la nota simple esta semana y gestiono el certificado energético nuevo (unos 80 €).
• Fotos el jueves a las 17:00.

Para el anuncio solo me falta el último recibo del IBI; cuando podáis, me lo mandáis por aquí.

¿Me confirmáis antes del jueves si vais a reparar la humedad de la cocina? Así le digo al fotógrafo cómo enfocar esa parte.

Un saludo,
Laura`,
        related_task_ids: ["t1", "t2", "t3", "t4", "t6"],
        language: "es",
      },
      {
        id: "e2",
        to_participant_id: null,
        to_label: "Fotógrafo",
        subject: "Sesión de fotos jueves 17:00, piso en calle Mayor",
        body: `Hola:

Te confirmo sesión para el jueves a las 17:00 en el piso de la calle Mayor: 92 m², tres habitaciones, terraza de 12 m² y plaza de garaje.

Los propietarios estarán en casa. Puede que haya una humedad junto a la ventana de la cocina sin reparar; te aviso el mismo jueves por la mañana.

¿Me confirmas que te cuadra la hora?

Gracias,
Laura`,
        related_task_ids: ["t5"],
        language: "es",
      },
    ],
    open_questions: [
      {
        text: "¿Reparan la humedad de la cocina antes de las fotos del jueves? Pedro lo deja pendiente de lo que cueste.",
        evidence: { quote: "No te decimos ahora si lo arreglamos o no, depende de lo que nos cueste.", timestamp: "02:54" },
      },
      {
        text: "Honorarios del 3 % + IVA: mencionados por Laura, pendientes de aceptación por escrito en la nota de encargo.",
        evidence: { quote: "El tres por ciento más IVA, solo si vendemos.", timestamp: "01:44" },
      },
    ],
  };
}
