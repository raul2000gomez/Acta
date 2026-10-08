# Plan de construcción (una página)

## Nombre

Elegido: **Acta**. Las tres propuestas fueron:

1. **Quedamos** — «Quedamos en que…» es literalmente la primera frase de todo correo de seguimiento. Memorable, muy español, dominio `quedamos.app`.
2. **Acta** — corto, serio, conocido por cualquier gerente. Transmite «esto queda por escrito».
3. **Minuta** — la palabra del sector para el resumen de una reunión. Más formal que Acta.

## Estructura de carpetas

```
src/
  app/
    (marketing)/page.tsx          Landing (una pantalla)
    app/page.tsx                  Subida + lista de reuniones
    app/r/[id]/page.tsx           Resultado (Tareas · Decisiones · Correos)
    app/r/[id]/imprimir/page.tsx  Vista de impresión (PDF de una página)
    app/tareas/page.tsx           Tareas pendientes de todas las reuniones
    app/ajustes/page.tsx          Perfil, firma, retención, exportar/borrar, suscripción
    auth/callback/route.ts        Intercambio del enlace mágico
    api/inngest/route.ts          Handler de la cola de trabajos
    api/upload/route.ts           URL firmada para subir directo a Storage
    api/meetings/route.ts         Crear reunión y lanzar el procesado
    api/meetings/[id]/...         Edición inline, correos, exportaciones, audio firmado
    api/stripe/...                Checkout, portal y webhook
    api/cron/retention/route.ts   Borrado de audio a los N días
  components/
    ui/                           shadcn/ui
    upload/                       Drop zone, grabadora, enlace, progreso
    meeting/                      Cabecera, pestañas, tareas, decisiones, correos, dudas, exportar
  lib/
    supabase/{server,client,admin}.ts
    ai/{extract.ts,schema.ts,prompt.ts,sector.ts}   Motor Claude + esquema + system prompt + bloque de sector
    transcription/{index.ts,deepgram.ts,demo.ts}    Proveedor pluggable
    inngest/{client.ts,functions.ts}
    email/{resend.ts,mailto.ts}
    export/{ics.ts,csv.ts,text.ts}
    demo/                         Reunión de ejemplo (transcripción y extracción enlatadas)
supabase/migrations/              Esquema, RLS, bucket, triggers
```

## Modelo de datos (Postgres, RLS por `user_id` en todas las tablas)

- **profiles** — id (= auth.users), full_name, company, phone, signature, locale, audio_retention_days (30), plan (free|pro), stripe_customer_id, stripe_subscription_id, meetings_used.
- **contacts** — memoria de nombres: user_id, name, role, email, company, times_seen.
- **meetings** — user_id, title, meeting_date, duration_sec, status (uploading|uploaded|transcribing|extracting|ready|failed), error, audio_path, audio_mime, audio_deleted_at, source_url, hint, language, summary, quality_warning, transcript (jsonb), raw_extraction (jsonb), is_demo, phase_timings (jsonb), cost_cents.
- **participants** — meeting_id, speaker_key, name, role, is_user, contact_id.
- **tasks** — meeting_id, user_id, text, owner_participant_id, due_date, date_inferred, priority, suggested, done, evidence_quote, evidence_ts, position.
- **decisions** — meeting_id, text, decided_by_participant_id, involves_money_or_contract, evidence_quote, evidence_ts.
- **emails** — meeting_id, to_participant_id, to_label, to_email, subject, body, original_body, language, related_task_ids, status (draft|copied|opened|sent), sent_unchanged.
- **open_questions** — meeting_id, text, evidence_quote, evidence_ts, resolved.

Storage: bucket privado `audio`, ruta `{user_id}/{meeting_id}.{ext}`, subida directa con URL firmada.

## Las cinco pantallas

1. Landing · 2. Subida y lista · 3. Resultado · 4. Tareas · 5. Ajustes. Móvil como caso principal.

## Orden de construcción

1. Scaffold (Next 16, Tailwind 4, shadcn/ui) y esquema de Supabase.
2. Camino completo con la reunión de ejemplo: subir → cola → transcribir → extraer → mostrar → enviar. Feo pero entero.
3. Pantalla de resultado completa: edición inline, evidencia con reproducción, correos, dudas, exportar.
4. Auth anónima → enlace mágico → vinculación; límites sin cuenta.
5. Tareas globales, ajustes, retención, exportar y borrar todo.
6. Stripe (un plan Pro). Landing. PWA. README con arranque, variables y coste.
7. Repaso contra la sección 11 del prompt.

## Decisiones ya tomadas (se amplían en el README)

- Cola de trabajos: **Inngest** (reintentos por paso, funciona en Vercel, dev server local).
- Transcripción: **Deepgram** por URL firmada (diarización, detección de idioma), con proveedor `demo` para desarrollar sin claves.
- Extracción: **Claude `claude-opus-5-5`** con salidas estructuradas (JSON Schema), caché del system prompt y streaming.
- Primera reunión sin registro: **usuario anónimo de Supabase** que luego se vincula a un email (mismo id, no se pierde nada).
- Fecha y responsable: selector nativo del navegador (en móvil es un toque).
- PDF: vista de impresión con CSS de una página y «Guardar como PDF» del navegador (sin dependencias).
