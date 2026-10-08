-- Esquema inicial. Todas las tablas llevan user_id y RLS "solo mis filas".
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Perfiles (uno por usuario de auth, incluidos los anónimos)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  company text,
  phone text,
  signature text,
  locale text not null default 'es',
  audio_retention_days integer not null default 30 check (audio_retention_days between 1 and 365),
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  meetings_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user();

-- ---------------------------------------------------------------------------
-- Memoria de nombres (regla 12: el producto recuerda a la gente)
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  role text,
  email text,
  company text,
  times_seen integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_user_idx on public.contacts (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Reuniones
-- ---------------------------------------------------------------------------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  meeting_date date not null default current_date,
  duration_sec integer,
  status text not null default 'uploading'
    check (status in ('uploading', 'uploaded', 'transcribing', 'extracting', 'ready', 'failed')),
  error text,
  audio_path text,
  audio_mime text,
  audio_deleted_at timestamptz,
  source_url text,
  hint text,
  language text,
  summary text,
  quality_warning text,
  transcript jsonb,
  raw_extraction jsonb,
  is_demo boolean not null default false,
  phase_timings jsonb not null default '{}'::jsonb,
  cost_cents integer,
  edits_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_user_created_idx on public.meetings (user_id, created_at desc);
create index meetings_status_idx on public.meetings (status) where status not in ('ready', 'failed');

-- ---------------------------------------------------------------------------
-- Participantes detectados en cada reunión
-- ---------------------------------------------------------------------------
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  speaker_key text not null,
  name text,
  role text,
  is_user boolean not null default false,
  contact_id uuid references public.contacts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index participants_meeting_idx on public.participants (meeting_id);

-- ---------------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  owner_participant_id uuid references public.participants (id) on delete set null,
  due_date date,
  date_inferred boolean not null default false,
  priority text not null default 'normal' check (priority in ('alta', 'normal')),
  suggested boolean not null default false,
  done boolean not null default false,
  evidence_quote text,
  evidence_ts text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_meeting_idx on public.tasks (meeting_id, position);
create index tasks_user_pending_idx on public.tasks (user_id, done, due_date);

-- ---------------------------------------------------------------------------
-- Decisiones
-- ---------------------------------------------------------------------------
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  decided_by_participant_id uuid references public.participants (id) on delete set null,
  involves_money_or_contract boolean not null default false,
  evidence_quote text,
  evidence_ts text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index decisions_meeting_idx on public.decisions (meeting_id, position);

-- ---------------------------------------------------------------------------
-- Correos de seguimiento
-- ---------------------------------------------------------------------------
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  to_participant_id uuid references public.participants (id) on delete set null,
  to_label text not null,
  to_email text,
  subject text not null,
  body text not null,
  original_body text not null,
  language text not null default 'es',
  related_task_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'copied', 'opened', 'sent')),
  sent_unchanged boolean,
  sent_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index emails_meeting_idx on public.emails (meeting_id, position);

-- ---------------------------------------------------------------------------
-- Dudas por confirmar
-- ---------------------------------------------------------------------------
create table public.open_questions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null,
  evidence_quote text,
  evidence_ts text,
  resolved boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index open_questions_meeting_idx on public.open_questions (meeting_id, position);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();
create trigger meetings_touch before update on public.meetings for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger decisions_touch before update on public.decisions for each row execute function public.touch_updated_at();
create trigger emails_touch before update on public.emails for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: cada usuario (anónimo o no) solo ve y toca sus filas
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.meetings enable row level security;
alter table public.participants enable row level security;
alter table public.tasks enable row level security;
alter table public.decisions enable row level security;
alter table public.emails enable row level security;
alter table public.open_questions enable row level security;

create policy "profiles: own" on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "contacts: own" on public.contacts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "meetings: own" on public.meetings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "participants: own" on public.participants
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "tasks: own" on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "decisions: own" on public.decisions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "emails: own" on public.emails
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "open_questions: own" on public.open_questions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "audio", ruta {user_id}/{meeting_id}.{ext}
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', false, 524288000)
on conflict (id) do nothing;

create policy "audio: own read" on storage.objects
  for select to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "audio: own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "audio: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "audio: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Borrar la cuenta de verdad (regla 11). El audio lo borra antes el servidor.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Contador de reuniones usadas (plan gratis)
-- ---------------------------------------------------------------------------
create or replace function public.increment_meetings_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_demo = false then
    update public.profiles set meetings_used = meetings_used + 1 where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger meetings_count after insert on public.meetings
  for each row execute function public.increment_meetings_used();
