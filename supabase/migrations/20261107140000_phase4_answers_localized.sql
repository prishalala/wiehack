-- Phase 4: cache AI answers per language for instant switching
alter table public.questions
  add column if not exists answers_localized jsonb not null default '{}'::jsonb;

comment on column public.questions.answers_localized is 'Map of language code → answer text for instant UI language switching';

-- Keep teacher view in sync (recreate with new column)
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
    created_at
  from public.questions;

grant select on public.questions_teacher_view to anon, authenticated;
