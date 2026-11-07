-- ClassBridge Phase 1 schema
-- Open RLS for hackathon (no auth). Tighten before production.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  subject text not null default '',
  notes text not null default '',
  notes_localized jsonb,
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  created_at timestamptz not null default now(),
  started_at timestamptz
);

create index if not exists sessions_code_idx on public.sessions (code);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  name text not null,
  language text not null default 'en' check (language in ('en', 'hi', 'fr')),
  created_at timestamptz not null default now()
);

create index if not exists students_session_id_idx on public.students (session_id);

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  text text not null,
  detected_language text not null default 'unknown',
  is_romanized boolean not null default false,
  english_gloss text not null default '',
  student_name text,
  answer text,
  answer_lang text check (answer_lang is null or answer_lang in ('en', 'hi', 'fr')),
  is_anonymous boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'analyzed', 'answered')),
  misconception_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists questions_session_id_idx on public.questions (session_id);
create index if not exists questions_created_at_idx on public.questions (created_at desc);

-- ---------------------------------------------------------------------------
-- misconceptions
-- ---------------------------------------------------------------------------
create table if not exists public.misconceptions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  label text not null,
  confidence double precision not null default 0 check (confidence >= 0 and confidence <= 1),
  question_ids uuid[] not null default '{}',
  languages text[] not null default '{}',
  suggested_intervention text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists misconceptions_session_id_idx on public.misconceptions (session_id);

-- questions.misconception_id FK after misconceptions exists
alter table public.questions
  drop constraint if exists questions_misconception_id_fkey;
alter table public.questions
  add constraint questions_misconception_id_fkey
  foreign key (misconception_id) references public.misconceptions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- activities
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  misconception_id uuid references public.misconceptions (id) on delete set null,
  html text not null default '',
  explanation jsonb not null default '{"en":"","hi":"","fr":""}'::jsonb,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists activities_session_id_idx on public.activities (session_id);

-- ---------------------------------------------------------------------------
-- checks (pre/post)
-- ---------------------------------------------------------------------------
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  misconception_id uuid references public.misconceptions (id) on delete set null,
  question jsonb not null default '{"en":"","hi":"","fr":""}'::jsonb,
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null default 0,
  phase text not null check (phase in ('pre', 'post')),
  created_at timestamptz not null default now()
);

create index if not exists checks_session_id_idx on public.checks (session_id);

-- ---------------------------------------------------------------------------
-- check_responses
-- ---------------------------------------------------------------------------
create table if not exists public.check_responses (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  selected_index integer not null,
  correct boolean not null default false,
  created_at timestamptz not null default now(),
  unique (check_id, student_id)
);

create index if not exists check_responses_check_id_idx on public.check_responses (check_id);

-- ---------------------------------------------------------------------------
-- Open RLS (hackathon)
-- ---------------------------------------------------------------------------
alter table public.sessions enable row level security;
alter table public.students enable row level security;
alter table public.questions enable row level security;
alter table public.misconceptions enable row level security;
alter table public.activities enable row level security;
alter table public.checks enable row level security;
alter table public.check_responses enable row level security;

drop policy if exists "sessions_open" on public.sessions;
create policy "sessions_open" on public.sessions for all using (true) with check (true);

drop policy if exists "students_open" on public.students;
create policy "students_open" on public.students for all using (true) with check (true);

drop policy if exists "questions_open" on public.questions;
create policy "questions_open" on public.questions for all using (true) with check (true);

drop policy if exists "misconceptions_open" on public.misconceptions;
create policy "misconceptions_open" on public.misconceptions for all using (true) with check (true);

drop policy if exists "activities_open" on public.activities;
create policy "activities_open" on public.activities for all using (true) with check (true);

drop policy if exists "checks_open" on public.checks;
create policy "checks_open" on public.checks for all using (true) with check (true);

drop policy if exists "check_responses_open" on public.check_responses;
create policy "check_responses_open" on public.check_responses for all using (true) with check (true);

-- Anonymity: never persist identity when is_anonymous
create or replace function public.enforce_question_anonymity()
returns trigger
language plpgsql
as $$
begin
  if new.is_anonymous then
    new.student_id := null;
    new.student_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_anonymity_biu on public.questions;
create trigger questions_anonymity_biu
  before insert or update on public.questions
  for each row execute function public.enforce_question_anonymity();

-- Teacher-safe view (identity stripped for anonymous rows)
create or replace view public.questions_teacher_view as
  select
    id,
    session_id,
    case when is_anonymous then null else student_id end as student_id,
    text,
    detected_language,
    is_romanized,
    english_gloss,
    case when is_anonymous then null else student_name end as student_name,
    answer,
    answer_lang,
    is_anonymous,
    status,
    misconception_id,
    created_at
  from public.questions;

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
grant select on public.questions_teacher_view to anon, authenticated;
