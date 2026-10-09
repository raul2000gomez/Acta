/**
 * Vocabulario del sector que la transcripción tiende a confundir («IBI» → «IVI»).
 * Deepgram nova-3 lo acepta como `keyterm` (sin pesos, hasta 100 términos).
 * Para otro sector, cambia esta lista junto con src/lib/ai/sector.ts.
 */
export const SECTOR_KEYTERMS = [
  "IBI",
  "arras",
  "nota simple",
  "nota de encargo",
  "certificado energético",
  "CEE",
  "cédula de habitabilidad",
  "exclusiva",
  "contraoferta",
  "hipoteca",
  "FEIN",
  "tasación",
  "tasador",
  "cargas",
  "ITP",
  "plusvalía",
  "notaría",
  "gestoría",
  "home staging",
  "entrega de llaves",
  "señal",
  "reserva",
  "honorarios",
  "comunidad de propietarios",
];
