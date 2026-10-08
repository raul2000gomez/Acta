import { z } from "zod";

/** Contrato de salida del motor (sección 5 del prompt). */

const Evidence = z.object({
  quote: z.string().describe("Cita literal, 25 palabras como máximo"),
  timestamp: z.string().describe("Minuto y segundo en que se dijo, formato mm:ss"),
});

export const ExtractionSchema = z.object({
  title: z.string().describe("Título corto y concreto de la reunión"),
  summary: z.string().describe("Resumen de 5 frases como máximo"),
  language: z.enum(["es", "ca", "en"]).describe("Idioma principal de la reunión"),
  quality_warning: z
    .string()
    .nullable()
    .describe("Aviso si la transcripción es muy corta, ininteligible o no es una reunión; si no, null"),
  participants: z.array(
    z.object({
      id: z.string().describe("Identificador del hablante, por ejemplo spk_1"),
      name: z.string().nullable().describe("Nombre si se ha podido identificar; si no, null"),
      role: z.string().nullable().describe("Papel en la reunión: comprador, propietario, gestoría…"),
      is_user: z.boolean().describe("true si es el usuario del producto"),
    }),
  ),
  tasks: z.array(
    z.object({
      id: z.string(),
      text: z.string().describe("Verbo + objeto concreto"),
      owner_id: z.string().nullable().describe("id del participante que se comprometió, o null"),
      due_date: z.string().nullable().describe("Fecha absoluta YYYY-MM-DD o null"),
      date_inferred: z.boolean().describe("true si la fecha se dedujo de una expresión relativa"),
      priority: z.enum(["alta", "normal"]),
      suggested: z.boolean().describe("true solo para las obligatorias del sector que nadie dijo"),
      evidence: Evidence,
    }),
  ),
  decisions: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      decided_by: z.string().nullable().describe("id del participante que la tomó, o null"),
      involves_money_or_contract: z.boolean(),
      evidence: Evidence,
    }),
  ),
  emails: z.array(
    z.object({
      id: z.string(),
      to_participant_id: z.string().nullable().describe("id del participante destinatario, o null"),
      to_label: z.string().describe("Etiqueta legible del destinatario, por ejemplo 'Cliente: María Sánchez'"),
      subject: z.string().describe("Asunto concreto: qué y para cuándo"),
      body: z.string().describe("Cuerpo de 150 palabras como máximo, con firma"),
      related_task_ids: z.array(z.string()),
      language: z.enum(["es", "ca", "en"]),
    }),
  ),
  open_questions: z.array(
    z.object({
      text: z.string(),
      evidence: Evidence,
    }),
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
