# Acta

Micro-SaaS que convierte la grabación de una reunión en **tareas, decisiones y correos de seguimiento**, redactados para un sector concreto (de serie: agencias inmobiliarias en España). Pensado para que el seguimiento completo cueste menos de tres minutos de atención.

- `PROMPT.md`: el prompt maestro con el que se ha construido (ley de fricción cero, flujo, contrato JSON, system prompt y bloque de sector).
- `PLAN.md`: nombres propuestos, estructura, modelo de datos y orden de construcción.

## Cómo arrancarlo en local

1. **Supabase.** Crea un proyecto en [supabase.com](https://supabase.com). En *Authentication › Sign In / Providers* activa **Anonymous sign-ins** y deja **Email** activo (enlace mágico). En *SQL Editor* ejecuta `supabase/migrations/0001_init.sql` (crea tablas, RLS, el bucket privado `audio` y los triggers). Si usas la CLI: `supabase db push`.
2. **Variables.** `cp .env.example .env.local` y rellena al menos las de Supabase. Sin `ANTHROPIC_API_KEY` ni `DEEPGRAM_API_KEY` la app funciona con la **reunión de ejemplo** (transcripción y extracción enlatadas), suficiente para ver todo el flujo.
3. **Instalar y arrancar.**
   ```bash
   npm install
   npm run dev
   ```
4. **Cola de trabajos.** En otra terminal: `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`. Si no la levantas, la app lo detecta y procesa en línea (o fuerza `PROCESS_INLINE=true`).
5. Abre `http://localhost:3000/app`, pulsa «Probar con una reunión de ejemplo» o suelta un audio.

### Producción (Vercel)

- Importa el repo en Vercel y copia las variables de `.env.example`.
- Inngest: instala la integración de Vercel o pon `INNGEST_EVENT_KEY` y `INNGEST_SIGNING_KEY`; sincroniza la app en el panel de Inngest apuntando a `/api/inngest`.
- Stripe: crea un producto con precio mensual (29 €) y copia `STRIPE_PRICE_ID`; añade un webhook a `/api/stripe/webhook` con los eventos `checkout.session.completed`, `customer.subscription.updated` y `customer.subscription.deleted`.
- Resend: verifica el dominio de `EMAIL_FROM`.
- El cron de `vercel.json` llama a `/api/cron/retention` cada noche con `CRON_SECRET` para borrar el audio caducado.
- En Supabase › Authentication › URL Configuration añade `https://tudominio/auth/callback` a *Redirect URLs*.


## Prueba con audio real (un comando)

Con las claves en `.env.local` (o en el entorno):

```bash
npm run smoke:real                      # por la app: necesita la app arrancada y Supabase
npm run smoke:real -- --sin-app         # el motor directo (Deepgram → Claude), sin app ni Supabase
npm run smoke:real -- --audio mi.m4a    # usa tu propia grabación (vale con los dos modos)
```

El script sintetiza cada intervención de la reunión de ejemplo con una voz distinta de Deepgram (una por hablante), las une con ffmpeg y guarda el guion con los tiempos reales. Después:

- **Por la app** (por defecto) crea la reunión por la misma API que usa el navegador (sesión anónima, URL firmada, arranque), espera a que esté lista y vuelca tareas, decisiones, correos, dudas, tiempos por fase, minutos por hora de audio, porcentaje de tareas con responsable y coste de la extracción.
- **`--sin-app`** ejecuta los módulos de `src/lib` directamente desde Node (Deepgram con el audio en el cuerpo de la petición y la extracción con Claude), sin servidor ni base de datos. Imprime el mismo informe más la comparación con el guion: tasa de error por palabra (con y sin cifras) y acierto de la diarización. Sin `ANTHROPIC_API_KEY` mide solo la transcripción y sale con código 3 (prueba parcial). Es el modo para CI y para entornos sin Supabase.

Necesita `ffmpeg` en el PATH. Las voces se pueden forzar con `TTS_VOICES="voz1,voz2,voz3"`. El audio y el guion quedan en `scratch/` (ignorado por git); con `--sin-app` también `scratch/ultima-extraccion.json`. Códigos de salida: 0 todo bien, 1 error, 2 la reunión falló, 3 parcial.

### Última medida (9 oct 2026, `--sin-app`, sesión en la nube)

Reunión de ejemplo sintetizada: 3 voces (`aura-2-celeste-es`, `aura-2-diana-es`, `aura-2-sirio-es`), 25 intervenciones, 2 min 54 s, 1,2 MB de MP3.

| Medida | Resultado |
|---|---|
| Transcripción (Deepgram nova-3, diarización + detección de idioma) | 1,0 s · idioma `es` · 25 intervenciones, las mismas que el guion |
| Hablantes | 3 de 3 detectados · 99,3 % del habla asignada al hablante correcto |
| Error por palabra | 11,7 % en bruto (casi todo cifras: «trescientos cinco mil» → «305000») · 2,5 % sin cifras (10 de 401) con el vocabulario del sector como `keyterm`; 3,0 % sin él |
| Fallos reales | «lo entiendo» → «no entiendo», «que le eche un ojo» → «que haya hecho 1», «junto» → «junta». «IBI» → «IVI» desapareció al añadir el vocabulario del sector |
| Minutos por hora de audio (solo transcripción) | 0,3–0,4 (objetivo total < 2) |
| Extracción con Claude | Pendiente: el entorno no tenía `ANTHROPIC_API_KEY`. El mismo comando la mide en cuanto esté la clave. |
| Por la app | Pendiente: `NEXT_PUBLIC_SUPABASE_URL` del entorno era la URL de ejemplo de la guía, no un proyecto real. |

Lecturas: la diarización es sólida con voces distintas y 0,6 s de silencio entre turnos. Los términos del sector se corrigen con `keyterm` (`src/lib/transcription/keyterms.ts`); quedan confusiones «lo/no» y cifras abreviadas («salimos en 305» por 305.000 €), y para eso el system prompt le dice al extractor cómo leer cifras abreviadas y que lleve a dudas lo que sea ambiguo por un error de transcripción. Las cifras llegan al modelo como números, que es lo que queremos para precios y plazos.

En una sesión de Claude Code en la nube, el `fetch` de Node no usa el proxy del entorno por sí solo: ejecuta `NODE_USE_ENV_PROXY=1 npm run smoke:real -- --sin-app`. En un ordenador normal no hace falta.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente de Supabase (acepta también `NEXT_PUBLIC_SUPABASE_ANON_KEY`). |
| `SUPABASE_SECRET_KEY` | Worker, webhooks y cron (acepta también `SUPABASE_SERVICE_ROLE_KEY`). |
| `ANTHROPIC_API_KEY` | Extracción con Claude. `EXTRACTION_MODEL` cambia el modelo. |
| `DEEPGRAM_API_KEY` | Transcripción con diarización. `DEEPGRAM_MODEL` cambia el modelo. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Cola en producción. `PROCESS_INLINE=true` la desactiva. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Enviar correos desde la app y avisos de «tu reunión está lista». |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | Plan Pro. |
| `CRON_SECRET` | Protege el cron de retención. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PRODUCT_NAME` | URL pública y nombre del producto (por defecto: Acta). |

## Coste por reunión (una hora de audio)

| Concepto | Coste aprox. |
|---|---|
| Transcripción (Deepgram nova-3, por URL) | 0,20 – 0,40 € |
| Extracción (`claude-opus-5-5`, ~12.000 tokens de entrada + ~3.000 de salida, system prompt cacheado) | ≈ 0,10 $ |
| Extracción con `claude-sonnet-5-5` | ≈ 0,05 $ |
| Storage, correo, cola | céntimos |

Con el plan Pro a 29 €/mes y 40 reuniones de una hora, el coste variable ronda los 15–20 €. La app guarda en `meetings.cost_cents` el coste estimado de cada extracción y en `phase_timings` el tiempo de cada fase.

## Cómo está hecho

- **Next.js 16** (App Router, Turbopack), **Tailwind 4**, componentes al estilo shadcn/ui sobre Radix.
- **Supabase**: Postgres con RLS en todas las tablas, Storage privado con subida directa por URL firmada, Auth con usuario anónimo que luego se vincula a un email (mismo id: no se pierde nada).
- **Inngest** como cola con reintentos por paso; si no está disponible, el procesado corre en el mismo servidor tras responder (`after()`), para que nunca se quede un audio sin procesar.
- **Deepgram** por URL firmada (diarización, detección de idioma es/ca/en). Proveedor `demo` para desarrollar sin claves.
- **Claude** (`claude-opus-5-5`) con salidas estructuradas (JSON Schema), caché del system prompt y streaming. El system prompt y el bloque de sector están en `src/lib/ai/`.
- **Resend** para enviar; `mailto:`, Gmail y Outlook sin integración.
- **Stripe** Checkout + portal de cliente + webhook, un solo plan.

Carpetas clave: `src/lib/ai` (motor), `src/lib/pipeline` (pasos), `src/lib/transcription` (proveedores), `src/components/meeting` (pantalla de resultado), `supabase/migrations` (esquema).

## Decisiones tomadas

- **Cache Components de Next 16 desactivado.** Toda la app es dinámica por usuario (cookies en cada página); el modelo de caché nuevo añadía complejidad sin beneficio.
- **Sin `next/font/google`.** Fuente del sistema: más rápida y el build no depende de red.
- **Componentes de UI escritos a mano** en el estilo de shadcn/ui (el registro de shadcn no era accesible desde el entorno de construcción); misma API y mismos primitivos de Radix.
- **Usuario anónimo de Supabase** para la primera reunión sin registro; límite de 30 minutos de audio y una reunión por dispositivo. Al dar el email se vincula con `updateUser`; si el email ya tiene cuenta, se entra en ella (los datos anónimos no se fusionan en v1).
- **Enlaces (Drive, Zoom, Meet, Teams):** en v1 se acepta cualquier enlace a un archivo descargable (los de Google Drive compartidos se convierten solos). Las integraciones OAuth con Zoom/Meet/Teams quedan fuera.
- **Reconocer voces entre reuniones** no está en v1: los nombres se recuerdan por contexto (contactos conocidos se pasan al modelo) y por el nombre que el usuario pone a «Hablante 2».
- **Fecha y responsable con selectores nativos** del navegador: en el móvil es un toque y no hay dependencia de calendario.
- **PDF = vista de impresión** con CSS de una página y «Guardar como PDF» del navegador; sin librerías.
- **Reintento automático**: los pasos fallidos se reintentan en la cola; los errores que no tiene sentido reintentar (archivo no válido, enlace a una web) marcan la reunión como fallida con mensaje claro y un botón de reintentar. El audio nunca se borra por un fallo.
- **Un solo plan de pago** (Pro). El plan Equipo de las variables queda para cuando exista la función de equipo.
- **Equipo (invitar por email)** aplazado a la siguiente versión; en Ajustes se dice tal cual.
- **La reunión de ejemplo no tiene audio** (no se puede sintetizar aquí una voz real); las citas se muestran pero no se reproducen. Con una grabación real todo el flujo de evidencia funciona.
- **Vocabulario del sector en la transcripción**: nova-3 recibe los términos de `keyterms.ts` como `keyterm`; si un modelo o idioma no lo admite, se repite la petición sin ellos. `DEEPGRAM_KEYTERMS=off` lo desactiva.
- **Fallbacks de refusal de la API de Claude** no activados (es una cabecera beta que no se ha podido probar aquí); un rechazo del modelo marca la reunión como fallida con el motivo.

## Repaso contra la sección 11 del prompt

| Criterio | Estado |
|---|---|
| Comercial con prisa: subir y enviar un correo en < 3 min sin instrucciones | Diseñado para ello; falta la prueba con una persona real del sector. |
| Cero campos obligatorios antes del resultado | Cumplido. Solo el campo opcional «¿De qué va?». |
| < 2 min por hora de audio | Transcripción medida: 0,4 min por hora (ver «Última medida»). La extracción se mide con el mismo comando cuando haya `ANTHROPIC_API_KEY`. |
| ≥ 80 % de tareas con responsable, ≥ 70 % de correos sin editar | Se mide (`edits_count`, `emails.sent_unchanged`); sin datos reales todavía. |
| Cada tarea y decisión con cita y minuto, reproducible | Cumplido (con audio real). |
| Móvil: grabar, subir y enviar sin pellizcar; Lighthouse ≥ 90 | Diseñado móvil primero; Lighthouse pendiente de medir en despliegue. |
| Un fallo nunca pierde el audio; reintento y aviso claro | Cumplido. |
| Borrar cuenta borra audio, transcripciones y datos | Cumplido (Storage + `delete_my_account` en cascada). |
| Audio de ejemplo para probar sin subir nada | Cumplido (sin grabación real, ver decisiones). |

## Pendiente

- Vídeo de 20 segundos del flujo real en la landing (hoy hay tres pasos ilustrados) y frases de prueba social reales.
- Ejecutar `npm run smoke:real -- --sin-app` con `ANTHROPIC_API_KEY` para medir la extracción (tiempo, coste, % de tareas con responsable), y `npm run smoke:real` por la app con un Supabase real; después ajustar `estimateProcessingSeconds` con las medidas.
- Reunión de ejemplo con grabación real.
- Equipo e integraciones de calendario (solo .ics en v1).
