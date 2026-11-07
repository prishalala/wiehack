/**
 * Student portal data — Supabase, scoped by RLS to the signed-in student's enrollments.
 * Students never see quiz answer keys or unreleased grades.
 */
import type { Grade, HomeworkAssignment, QuizAssessment, SchoolClass } from "@/types/teacherPortal";
import type { Session } from "@/types";
import { getSupabase } from "@/lib/supabase";
import { courseFromRow, homeworkFromRow, quizFromRow } from "@/services/teacherPortalData";

const db = () => getSupabase("student");

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export type StudentCourse = SchoolClass & {
  teacherName: string;
  /** Live (or about-to-start) lesson students can join right now. */
  liveSession: { id: string; title: string; status: Session["status"] } | null;
};

export type MyHomework = HomeworkAssignment & {
  submission: { status: string; answers: Record<string, string>; submittedAt?: string; marks?: number; feedback?: string; released: boolean } | null;
};

export type MyQuiz = QuizAssessment & {
  attempt: { autoScore: number | null; submittedAt: string; released: boolean } | null;
};

export async function listMyCourses(): Promise<StudentCourse[]> {
  const courses = check(
    await db().from("courses").select("id, code, name, subject, grade, teacher_id, people!courses_teacher_id_fkey(full_name)").order("name"),
  ) as unknown as Array<{ id: string; code: string; name: string; subject: string; grade: string; teacher_id: string; people: { full_name: string } | null }>;
  if (!courses.length) return [];

  const sessions = check(
    await db()
      .from("sessions")
      .select("id, title, status, course_id, created_at")
      .in("course_id", courses.map((c) => c.id))
      .eq("status", "live")
      .order("created_at", { ascending: false }),
  ) as Array<{ id: string; title: string; status: Session["status"]; course_id: string }>;

  return courses.map((c) => {
    const live = sessions.find((s) => s.course_id === c.id);
    return {
      ...courseFromRow({ ...c, enrollments: [] }),
      teacherName: c.people?.full_name ?? "",
      liveSession: live ? { id: live.id, title: live.title, status: live.status } : null,
    };
  });
}

export async function getMyCourse(courseId: string): Promise<StudentCourse | null> {
  return (await listMyCourses()).find((c) => c.id === courseId) ?? null;
}

export async function listMyHomework(courseId: string): Promise<MyHomework[]> {
  const hw = check(await db().from("homework").select("*").eq("course_id", courseId).neq("status", "draft").order("due_at")) as Parameters<typeof homeworkFromRow>[0][];
  const subs = hw.length
    ? (check(await db().from("homework_submissions").select("*").in("homework_id", hw.map((h) => h.id))) as Array<{
        homework_id: string; status: string; answers: Record<string, string>; submitted_at: string | null;
        marks: number | null; feedback: string | null; grade_state: string;
      }>)
    : [];
  return hw.map((row) => {
    const s = subs.find((x) => x.homework_id === row.id);
    const released = s?.grade_state === "published";
    return {
      ...homeworkFromRow(row),
      submission: s
        ? {
            status: s.status,
            answers: s.answers ?? {},
            released,
            ...(s.submitted_at ? { submittedAt: s.submitted_at } : {}),
            // Marks/feedback only once the teacher releases them.
            ...(released && s.marks != null ? { marks: Number(s.marks) } : {}),
            ...(released && s.feedback ? { feedback: s.feedback } : {}),
          }
        : null,
    };
  });
}

export async function submitHomework(homeworkId: string, answers: Record<string, string>): Promise<void> {
  check(await db().rpc("submit_homework", { p_homework_id: homeworkId, p_answers: answers }));
}

export async function listMyQuizzes(courseId: string): Promise<MyQuiz[]> {
  const quizzes = check(await db().from("quizzes").select("*").eq("course_id", courseId).neq("status", "draft").order("created_at", { ascending: false })) as Parameters<typeof quizFromRow>[0][];
  const attempts = quizzes.length
    ? (check(await db().from("quiz_attempts").select("quiz_id, auto_score, submitted_at, grade_state").in("quiz_id", quizzes.map((q) => q.id))) as Array<{
        quiz_id: string; auto_score: number | null; submitted_at: string; grade_state: string;
      }>)
    : [];
  return quizzes.map((row) => {
    const a = attempts.find((x) => x.quiz_id === row.id);
    return {
      ...quizFromRow(row),
      attempt: a ? { autoScore: a.auto_score != null ? Number(a.auto_score) : null, submittedAt: a.submitted_at, released: a.grade_state === "published" } : null,
    };
  });
}

export type QuizResult = {
  autoScore: number;
  autoTotal: number;
  total: number;
  correct: Record<string, boolean>;
  needsReview: boolean;
};

export async function submitQuiz(quizId: string, answers: Record<string, string | number>): Promise<QuizResult> {
  const r = check(await db().rpc("submit_quiz", { p_quiz_id: quizId, p_answers: answers })) as {
    auto_score: number; auto_total: number; total: number; correct: Record<string, boolean>; needs_review: boolean;
  };
  return { autoScore: Number(r.auto_score), autoTotal: Number(r.auto_total), total: Number(r.total), correct: r.correct ?? {}, needsReview: r.needs_review };
}

/** Released grades only (RLS hides drafts from students). */
export async function listMyGrades(courseId: string): Promise<Grade[]> {
  const rows = check(await db().from("grades").select("*").eq("course_id", courseId).order("updated_at", { ascending: false })) as Array<{
    id: string; student_id: string; course_id: string; source: Grade["source"]; source_id: string; title: string;
    marks: number; total_marks: number; feedback: string | null; publish_state: Grade["publishState"]; topic: string | null; updated_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id, studentId: r.student_id, classId: r.course_id, source: r.source, sourceId: r.source_id, title: r.title,
    marks: Number(r.marks), totalMarks: Number(r.total_marks), publishState: r.publish_state, updatedAt: r.updated_at,
    ...(r.feedback ? { feedback: r.feedback } : {}),
    ...(r.topic ? { topic: r.topic } : {}),
  }));
}
