-- Parent portal read access for institution-linked guardians.
-- Completes the intent noted in 20261108100000: parents see published
-- homework/quizzes and grades for students in parent_links.

create or replace function public.is_linked_parent_of(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_links pl
    where pl.parent_id = public.current_person_id() and pl.student_id = p_student_id
  );
$$;

create or replace function public.is_parent_of_course(p_course_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.parent_links pl
    join public.enrollments e on e.student_id = pl.student_id
    where pl.parent_id = public.current_person_id() and e.course_id = p_course_id
  );
$$;

-- Directory: parents can read their linked children's names.
drop policy if exists people_read on public.people;
create policy people_read on public.people for select to authenticated
  using (
    id = public.current_person_id()
    or public.shares_course_with(id)
    or public.is_linked_parent_of(id)
  );

-- Courses / enrollments the child is in.
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to authenticated
  using (
    public.is_course_teacher(id)
    or public.is_enrolled(id)
    or public.is_parent_of_course(id)
  );

drop policy if exists enrollments_read on public.enrollments;
create policy enrollments_read on public.enrollments for select to authenticated
  using (
    student_id = public.current_person_id()
    or public.is_course_teacher(course_id)
    or public.is_linked_parent_of(student_id)
  );

-- Published coursework for linked children.
drop policy if exists homework_parent_read on public.homework;
create policy homework_parent_read on public.homework for select to authenticated
  using (status <> 'draft' and public.is_parent_of_course(course_id));

drop policy if exists quizzes_parent_read on public.quizzes;
create policy quizzes_parent_read on public.quizzes for select to authenticated
  using (status <> 'draft' and public.is_parent_of_course(course_id));

-- Parents can see a child's submission status / released feedback (not draft marks).
drop policy if exists hw_sub_parent_read on public.homework_submissions;
create policy hw_sub_parent_read on public.homework_submissions for select to authenticated
  using (public.is_linked_parent_of(student_id));

drop policy if exists quiz_attempts_parent_read on public.quiz_attempts;
create policy quiz_attempts_parent_read on public.quiz_attempts for select to authenticated
  using (public.is_linked_parent_of(student_id));
