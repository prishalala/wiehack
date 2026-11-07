-- Institution accounts, courses and coursework.
--
-- Accounts are issued by the institution: a person can use ClassBridge only if their
-- uni/org email is in public.people (the institution directory). Sign-in itself is
-- Supabase Auth; this table decides the role (teacher / student / parent) and enrollments.
-- There is no self sign-up and no join-by-code.
--
-- Parent portal (later): reads grades where publish_state = 'published' and published
-- homework for students linked in parent_links.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Directory
-- ---------------------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  full_name text not null,
  role text not null check (role in ('teacher', 'student', 'parent')),
  preferred_language text not null default 'en',
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  subject text not null,
  grade text not null default '',
  teacher_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, student_id)
);

create table if not exists public.parent_links (
  parent_id uuid not null references public.people (id) on delete cascade,
  student_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

-- Live sessions belong to a course; participants link to their directory account.
alter table public.sessions add column if not exists course_id uuid references public.courses (id) on delete set null;
alter table public.students add column if not exists person_id uuid references public.people (id) on delete set null;
create index if not exists sessions_course_id_idx on public.sessions (course_id);
create unique index if not exists students_session_person_uidx on public.students (session_id, person_id) where person_id is not null;

-- ---------------------------------------------------------------------------
-- Coursework
-- ---------------------------------------------------------------------------
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  subject text not null default '',
  topic text not null default '',
  description text not null default '',
  instructions text not null default '',
  due_at timestamptz not null,
  total_marks numeric not null default 0 check (total_marks >= 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  tasks jsonb not null default '[]'::jsonb,
  attachment_name text,
  attachment_file_id text, -- browser-local PDF id (fileStore); Supabase Storage later
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists homework_course_id_idx on public.homework (course_id);

create table if not exists public.homework_submissions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework (id) on delete cascade,
  student_id uuid not null references public.people (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('missing', 'submitted', 'graded', 'returned')),
  submitted_at timestamptz,
  marks numeric,
  feedback text,
  grade_state text not null default 'draft' check (grade_state in ('draft', 'published')),
  unique (homework_id, student_id)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null default 'quiz' check (kind in ('quiz', 'test')),
  title text not null,
  subject text not null default '',
  topic text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  available_from timestamptz,
  due_at timestamptz,
  -- Questions WITHOUT answers (students can read this).
  questions jsonb not null default '[]'::jsonb,
  attachment_name text,
  attachment_file_id text, -- browser-local PDF id (fileStore); Supabase Storage later
  created_at timestamptz not null default now()
);
create index if not exists quizzes_course_id_idx on public.quizzes (course_id);

-- Answer key kept apart so students can never read it: { "<questionId>": <correctIndex> }.
create table if not exists public.quiz_answer_keys (
  quiz_id uuid primary key references public.quizzes (id) on delete cascade,
  answer_key jsonb not null default '{}'::jsonb
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  student_id uuid not null references public.people (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  auto_score numeric,
  teacher_score numeric,
  feedback text,
  grade_state text not null default 'draft' check (grade_state in ('draft', 'published')),
  submitted_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);

-- One row per graded item; only 'published' rows are visible to students and parents.
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.people (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  source text not null check (source in ('homework', 'quiz', 'test')),
  source_id uuid not null,
  title text not null,
  marks numeric not null,
  total_marks numeric not null,
  feedback text,
  publish_state text not null default 'draft' check (publish_state in ('draft', 'published')),
  topic text,
  updated_at timestamptz not null default now(),
  unique (source, source_id, student_id)
);
create index if not exists grades_student_id_idx on public.grades (student_id);

-- ---------------------------------------------------------------------------
-- Access helpers (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_person_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.people where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_course_teacher(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses c where c.id = p_course_id and c.teacher_id = public.current_person_id())
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e where e.course_id = p_course_id and e.student_id = public.current_person_id())
$$;

create or replace function public.shares_course_with(p_person_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e join public.courses c on c.id = e.course_id
    where (e.student_id = p_person_id and c.teacher_id = public.current_person_id())
       or (c.teacher_id = p_person_id and e.student_id = public.current_person_id())
  )
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.people enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.parent_links enable row level security;
alter table public.homework enable row level security;
alter table public.homework_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.grades enable row level security;

-- Signed-in accounts only; anonymous browser clients get nothing here.
revoke all on public.people, public.courses, public.enrollments, public.parent_links, public.homework,
  public.homework_submissions, public.quizzes, public.quiz_answer_keys, public.quiz_attempts, public.grades
  from anon;
grant select on public.people, public.courses, public.enrollments, public.parent_links, public.homework,
  public.homework_submissions, public.quizzes, public.quiz_answer_keys, public.quiz_attempts, public.grades
  to authenticated;
-- Directory, courses and rosters are institution-managed (no app writes).
revoke insert, update, delete on public.people, public.courses, public.enrollments, public.parent_links from authenticated;
-- Submissions, attempts and grades are written only through the functions below.
revoke insert, update, delete on public.homework_submissions, public.quiz_attempts, public.grades from authenticated;
grant insert, update, delete on public.homework, public.quizzes, public.quiz_answer_keys to authenticated;

drop policy if exists people_read on public.people;
create policy people_read on public.people for select to authenticated
  using (id = public.current_person_id() or public.shares_course_with(id));

drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to authenticated
  using (public.is_course_teacher(id) or public.is_enrolled(id));

drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments for select to authenticated
  using (student_id = public.current_person_id() or public.is_course_teacher(course_id));

drop policy if exists parent_links_read on public.parent_links;
create policy parent_links_read on public.parent_links for select to authenticated
  using (parent_id = public.current_person_id() or student_id = public.current_person_id());

drop policy if exists homework_teacher on public.homework;
create policy homework_teacher on public.homework for all to authenticated
  using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id));
drop policy if exists homework_student_read on public.homework;
create policy homework_student_read on public.homework for select to authenticated
  using (status <> 'draft' and public.is_enrolled(course_id));

drop policy if exists hw_sub_read on public.homework_submissions;
create policy hw_sub_read on public.homework_submissions for select to authenticated
  using (
    student_id = public.current_person_id()
    or exists (select 1 from public.homework h where h.id = homework_id and public.is_course_teacher(h.course_id))
  );

drop policy if exists quizzes_teacher on public.quizzes;
create policy quizzes_teacher on public.quizzes for all to authenticated
  using (public.is_course_teacher(course_id)) with check (public.is_course_teacher(course_id));
drop policy if exists quizzes_student_read on public.quizzes;
create policy quizzes_student_read on public.quizzes for select to authenticated
  using (status <> 'draft' and public.is_enrolled(course_id));

drop policy if exists quiz_keys_teacher on public.quiz_answer_keys;
create policy quiz_keys_teacher on public.quiz_answer_keys for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.is_course_teacher(q.course_id)))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and public.is_course_teacher(q.course_id)));

drop policy if exists quiz_attempts_read on public.quiz_attempts;
create policy quiz_attempts_read on public.quiz_attempts for select to authenticated
  using (
    student_id = public.current_person_id()
    or exists (select 1 from public.quizzes q where q.id = quiz_id and public.is_course_teacher(q.course_id))
  );

drop policy if exists grades_read on public.grades;
create policy grades_read on public.grades for select to authenticated
  using (
    public.is_course_teacher(course_id)
    or (publish_state = 'published' and student_id = public.current_person_id())
    or (publish_state = 'published' and exists (
      select 1 from public.parent_links pl where pl.student_id = grades.student_id and pl.parent_id = public.current_person_id()
    ))
  );

-- ---------------------------------------------------------------------------
-- Write functions
-- ---------------------------------------------------------------------------

-- Student submits (or re-submits before grading) homework answers.
create or replace function public.submit_homework(p_homework_id uuid, p_answers jsonb)
returns public.homework_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_person_id();
  v_hw public.homework;
  v_row public.homework_submissions;
begin
  select * into v_hw from public.homework where id = p_homework_id;
  if v_hw.id is null or v_hw.status <> 'published' then raise exception 'Homework is not open for submission'; end if;
  if v_me is null or not public.is_enrolled(v_hw.course_id) then raise exception 'You are not enrolled in this course'; end if;

  insert into public.homework_submissions (homework_id, student_id, answers, status, submitted_at)
  values (p_homework_id, v_me, coalesce(p_answers, '{}'::jsonb), 'submitted', now())
  on conflict (homework_id, student_id) do update
    set answers = excluded.answers, submitted_at = now()
    where public.homework_submissions.status = 'submitted'
  returning * into v_row;

  if v_row.id is null then raise exception 'This homework has already been graded'; end if;
  return v_row;
end;
$$;

-- Teacher saves a homework grade; publish = release to student and parents.
create or replace function public.grade_homework(p_submission_id uuid, p_marks numeric, p_feedback text, p_publish boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sub public.homework_submissions;
  v_hw public.homework;
  v_state text := case when p_publish then 'published' else 'draft' end;
begin
  select * into v_sub from public.homework_submissions where id = p_submission_id;
  select * into v_hw from public.homework where id = v_sub.homework_id;
  if v_hw.id is null or not public.is_course_teacher(v_hw.course_id) then raise exception 'Not your course'; end if;
  if p_marks < 0 or p_marks > v_hw.total_marks then raise exception 'Marks must be between 0 and %', v_hw.total_marks; end if;

  update public.homework_submissions
    set marks = p_marks, feedback = p_feedback, status = 'graded', grade_state = v_state
    where id = p_submission_id;

  insert into public.grades (student_id, course_id, source, source_id, title, marks, total_marks, feedback, publish_state, topic, updated_at)
  values (v_sub.student_id, v_hw.course_id, 'homework', v_hw.id, v_hw.title, p_marks, v_hw.total_marks, p_feedback, v_state, nullif(v_hw.topic, ''), now())
  on conflict (source, source_id, student_id) do update
    set marks = excluded.marks, total_marks = excluded.total_marks, feedback = excluded.feedback,
        publish_state = excluded.publish_state, title = excluded.title, updated_at = now();
end;
$$;

-- Student submits a quiz once; multiple-choice questions are auto-marked from the hidden key.
create or replace function public.submit_quiz(p_quiz_id uuid, p_answers jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_person_id();
  v_quiz public.quizzes;
  v_key jsonb;
  v_q jsonb;
  v_score numeric := 0;
  v_auto_total numeric := 0;
  v_total numeric := 0;
  v_correct jsonb := '{}'::jsonb;
  v_needs_review boolean := false;
  v_row public.quiz_attempts;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if v_quiz.id is null or v_quiz.status <> 'published' then raise exception 'Quiz is not open'; end if;
  if v_me is null or not public.is_enrolled(v_quiz.course_id) then raise exception 'You are not enrolled in this course'; end if;
  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz_id and student_id = v_me) then
    raise exception 'You have already submitted this quiz';
  end if;

  select coalesce(answer_key, '{}'::jsonb) into v_key from public.quiz_answer_keys where quiz_id = p_quiz_id;
  v_key := coalesce(v_key, '{}'::jsonb);

  for v_q in select * from jsonb_array_elements(v_quiz.questions) loop
    v_total := v_total + coalesce((v_q ->> 'marks')::numeric, 0);
    if v_q ->> 'type' = 'multiple_choice' and v_key ? (v_q ->> 'id') then
      v_auto_total := v_auto_total + coalesce((v_q ->> 'marks')::numeric, 0);
      if (p_answers ->> (v_q ->> 'id')) is not null
         and (p_answers ->> (v_q ->> 'id'))::text = (v_key ->> (v_q ->> 'id'))::text then
        v_score := v_score + coalesce((v_q ->> 'marks')::numeric, 0);
        v_correct := v_correct || jsonb_build_object(v_q ->> 'id', true);
      else
        v_correct := v_correct || jsonb_build_object(v_q ->> 'id', false);
      end if;
    else
      v_needs_review := true;
    end if;
  end loop;

  insert into public.quiz_attempts (quiz_id, student_id, answers, auto_score)
  values (p_quiz_id, v_me, coalesce(p_answers, '{}'::jsonb), v_score)
  returning * into v_row;

  insert into public.grades (student_id, course_id, source, source_id, title, marks, total_marks, publish_state, topic)
  values (v_me, v_quiz.course_id, case when v_quiz.kind = 'test' then 'test' else 'quiz' end, v_quiz.id, v_quiz.title,
          v_score, v_total, 'draft', nullif(v_quiz.topic, ''))
  on conflict (source, source_id, student_id) do nothing;

  return jsonb_build_object(
    'attempt_id', v_row.id,
    'auto_score', v_score,
    'auto_total', v_auto_total,
    'total', v_total,
    'correct', v_correct,
    'needs_review', v_needs_review
  );
end;
$$;

-- Teacher releases every quiz grade for one quiz to students and parents.
create or replace function public.publish_quiz_grades(p_quiz_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_quiz public.quizzes;
  v_n integer;
begin
  select * into v_quiz from public.quizzes where id = p_quiz_id;
  if v_quiz.id is null or not public.is_course_teacher(v_quiz.course_id) then raise exception 'Not your course'; end if;
  update public.quiz_attempts set grade_state = 'published' where quiz_id = p_quiz_id;
  update public.grades
    set publish_state = 'published',
        marks = coalesce((select coalesce(a.teacher_score, a.auto_score) from public.quiz_attempts a
                          where a.quiz_id = p_quiz_id and a.student_id = grades.student_id), marks),
        updated_at = now()
    where source in ('quiz', 'test') and source_id = p_quiz_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Enrolled student joins (or re-joins) a course's live session; one participant row per account.
create or replace function public.join_live_session(p_session_id uuid, p_language text)
returns public.students
language plpgsql security definer set search_path = public as $$
declare
  v_me public.people;
  v_session public.sessions;
  v_row public.students;
begin
  select * into v_me from public.people where id = public.current_person_id();
  if v_me.id is null or v_me.role <> 'student' then raise exception 'Sign in with your student account'; end if;
  select * into v_session from public.sessions where id = p_session_id;
  if v_session.id is null then raise exception 'Live lesson not found'; end if;
  if v_session.status = 'ended' then raise exception 'This lesson has ended'; end if;
  if v_session.course_id is null or not public.is_enrolled(v_session.course_id) then
    raise exception 'You are not enrolled in this course';
  end if;

  select * into v_row from public.students where session_id = p_session_id and person_id = v_me.id;
  if v_row.id is null then
    insert into public.students (session_id, name, language, person_id)
    values (p_session_id, v_me.full_name, coalesce(nullif(p_language, ''), v_me.preferred_language), v_me.id)
    returning * into v_row;
  end if;
  return v_row;
end;
$$;

revoke all on function public.submit_homework(uuid, jsonb), public.grade_homework(uuid, numeric, text, boolean),
  public.submit_quiz(uuid, jsonb), public.publish_quiz_grades(uuid), public.join_live_session(uuid, text)
  from public, anon;
grant execute on function public.submit_homework(uuid, jsonb), public.grade_homework(uuid, numeric, text, boolean),
  public.submit_quiz(uuid, jsonb), public.publish_quiz_grades(uuid), public.join_live_session(uuid, text)
  to authenticated;

-- Students now join only through join_live_session (no anonymous/code joins).
revoke insert on public.students from anon, authenticated;

-- Deleting homework or a quiz removes its grades (grades.source_id is not a real FK).
create or replace function public.delete_source_grades()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'homework' then
    delete from public.grades where source = 'homework' and source_id = old.id;
  else
    delete from public.grades where source in ('quiz', 'test') and source_id = old.id;
  end if;
  return old;
end;
$$;
drop trigger if exists homework_delete_grades on public.homework;
create trigger homework_delete_grades after delete on public.homework
  for each row execute function public.delete_source_grades();
drop trigger if exists quizzes_delete_grades on public.quizzes;
create trigger quizzes_delete_grades after delete on public.quizzes
  for each row execute function public.delete_source_grades();

-- ---------------------------------------------------------------------------
-- Prototype institution data. Create matching users in Supabase Auth
-- (Dashboard → Authentication → Users → Add user) to sign in.
-- ---------------------------------------------------------------------------
insert into public.people (email, full_name, role, preferred_language) values
  ('alex.morgan@classbridge-demo.edu', 'Alex Morgan', 'teacher', 'en'),
  ('aanya.patel@classbridge-demo.edu', 'Aanya Patel', 'student', 'hi'),
  ('lucas.martin@classbridge-demo.edu', 'Lucas Martin', 'student', 'fr'),
  ('mei.chen@classbridge-demo.edu', 'Mei Chen', 'student', 'en'),
  ('parent.patel@classbridge-demo.edu', 'Ravi Patel', 'parent', 'en')
on conflict (email) do nothing;

insert into public.courses (code, name, subject, grade, teacher_id)
select v.code, v.name, v.subject, v.grade, p.id
from (values
  ('MATH-5A', 'Grade 5A Mathematics', 'Mathematics', '5'),
  ('SCI-5A', 'Grade 5A Science', 'Science', '5')
) as v(code, name, subject, grade)
join public.people p on p.email = 'alex.morgan@classbridge-demo.edu'
on conflict (code) do nothing;

insert into public.enrollments (course_id, student_id)
select c.id, p.id
from public.courses c
join public.people p on p.email in ('aanya.patel@classbridge-demo.edu', 'lucas.martin@classbridge-demo.edu', 'mei.chen@classbridge-demo.edu')
where c.code = 'MATH-5A'
   or (c.code = 'SCI-5A' and p.email in ('aanya.patel@classbridge-demo.edu', 'lucas.martin@classbridge-demo.edu'))
on conflict do nothing;

insert into public.parent_links (parent_id, student_id)
select par.id, kid.id
from public.people par, public.people kid
where par.email = 'parent.patel@classbridge-demo.edu' and kid.email = 'aanya.patel@classbridge-demo.edu'
on conflict do nothing;
