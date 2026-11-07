-- Phase 2: open language codes + support live misconception analysis

alter table public.students drop constraint if exists students_language_check;
alter table public.questions drop constraint if exists questions_answer_lang_check;

-- Keep language as free-form ISO-ish codes (en, hi, es, zh, …)
comment on column public.students.language is 'Student UI language code (any BCP-47-ish code)';
comment on column public.questions.answer_lang is 'Language code the AI answer was written in';
