-- P0: save-first question pipeline + teacher-only operations.
--
-- 1) questions.translation_status / translation_error so a question is stored
--    before any AI call and a failed translation is visible (never lost).
-- 2) session_secrets holds a hashed teacher token per session. Only the
--    service role (Edge Functions) can read it.
-- 3) Browser (anon) clients become read-only on teacher-owned tables; writes go
--    through Edge Functions that validate the teacher token.

alter table public.questions
  add column if not exists translation_status text not null default 'pending',
  add column if not exists translation_error text;

alter table public.questions drop constraint if exists questions_translation_status_check;
alter table public.questions
  add constraint questions_translation_status_check
  check (translation_status in ('pending', 'done', 'not_needed', 'failed'));

-- Rows created by the old pipeline already went through the AI call.
update public.questions
  set translation_status = case when coalesce(english_gloss, '') = '' then 'failed' else 'done' end
  where translation_status = 'pending' and created_at < now();

comment on column public.questions.text is 'Original question exactly as the student typed it. Never overwritten.';
comment on column public.questions.english_gloss is 'English translation of the question (translated_text_en).';
comment on column public.questions.translation_status is 'pending | done | not_needed (already English) | failed';

drop view if exists public.questions_teacher_view;
create view public.questions_teacher_view as
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
    answers_localized,
    is_anonymous,
    status,
    misconception_id,
    created_at,
    translation_status,
    translation_error
  from public.questions;

grant select on public.questions_teacher_view to anon, authenticated;

-- Teacher token (SHA-256 hex). No policies => no anon/authenticated access.
create table if not exists public.session_secrets (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  teacher_token_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.session_secrets enable row level security;
revoke all on public.session_secrets from anon, authenticated;

-- Teacher-owned tables: browser can read, only Edge Functions (service role) write.
revoke insert, update, delete on public.sessions from anon, authenticated;
revoke insert, update, delete on public.questions from anon, authenticated;
revoke insert, update, delete on public.misconceptions from anon, authenticated;
revoke insert, update, delete on public.activities from anon, authenticated;
revoke insert, update, delete on public.checks from anon, authenticated;

-- Students may join (insert) but not edit or remove participants.
revoke update, delete on public.students from anon, authenticated;

-- check_responses keeps insert/update for the quiz upsert (P2 hardening later).
revoke delete on public.check_responses from anon, authenticated;
