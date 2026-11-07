/**
 * Teacher portal data — Supabase (RLS scopes everything to the signed-in teacher's courses).
 * Courses and rosters come from the institution; teachers create homework and quizzes,
 * grade them, and publish grades (published grades are what students and parents see).
 * PDF attachments stay in this browser (IndexedDB) until Supabase Storage is wired up.
 */
import type {
  AssessmentQuestion,
  DashboardSummary,
  Grade,
  HomeworkAssignment,
  HomeworkSubmission,
  MisconceptionInsight,
  QuizAssessment,
  QuizAttempt,
  SchoolClass,
  TopicPerformance,
} from "@/types/teacherPortal";
import { savePdfFile } from "@/lib/fileStore";
import { getSupabase } from "@/lib/supabase";

const db = () => getSupabase("teacher");

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------------------------------------------------------------------------
// Change notifications (pages re-fetch on writes and every 10s while open)
// ---------------------------------------------------------------------------
const listeners = new Set<() => void>();
let poll: number | null = null;
function notify() {
  listeners.forEach((l) => l());
}

export function subscribeTeacherPortal(cb: () => void) {
  listeners.add(cb);
  if (typeof window !== "undefined" && poll === null) poll = window.setInterval(notify, 10000);
  return () => {
    listeners.delete(cb);
    if (!listeners.size && poll !== null) {
      window.clearInterval(poll);
      poll = null;
    }
  };
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
type CourseRow = {
  id: string; code: string; name: string; subject: string; grade: string; teacher_id: string;
  enrollments?: Array<{ student_id: string; people: { id: string; full_name: string; email: string } | null }>;
};
type HomeworkRow = {
  id: string; course_id: string; title: string; subject: string; topic: string; description: string;
  instructions: string; due_at: string; total_marks: number; status: HomeworkAssignment["status"];
  tasks: HomeworkAssignment["tasks"]; attachment_name: string | null; attachment_file_id: string | null;
  created_at: string; updated_at: string;
};
type QuizRow = {
  id: string; course_id: string; kind: QuizAssessment["kind"]; title: string; subject: string; topic: string;
  status: QuizAssessment["status"]; available_from: string | null; due_at: string | null;
  questions: AssessmentQuestion[]; attachment_name: string | null; attachment_file_id: string | null; created_at: string;
  quiz_answer_keys?: { answer_key: Record<string, number> } | Array<{ answer_key: Record<string, number> }> | null;
};

export function courseFromRow(r: CourseRow): SchoolClass {
  const roster = (r.enrollments ?? [])
    .map((e) => e.people)
    .filter((p): p is { id: string; full_name: string; email: string } => Boolean(p))
    .map((p) => ({ id: p.id, fullName: p.full_name, email: p.email }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  return {
    id: r.id, code: r.code, name: r.name, subject: r.subject, grade: r.grade, teacherId: r.teacher_id,
    studentIds: roster.map((s) => s.id), roster,
  };
}

export function homeworkFromRow(r: HomeworkRow): HomeworkAssignment {
  return {
    id: r.id, classId: r.course_id, title: r.title, subject: r.subject, topic: r.topic, description: r.description,
    instructions: r.instructions, dueAt: r.due_at, totalMarks: Number(r.total_marks), status: r.status,
    tasks: r.tasks ?? [], createdAt: r.created_at, updatedAt: r.updated_at,
    ...(r.attachment_name ? { attachmentName: r.attachment_name } : {}),
    ...(r.attachment_file_id ? { attachmentFileId: r.attachment_file_id } : {}),
  };
}

export function quizFromRow(r: QuizRow): QuizAssessment {
  const keyRow = Array.isArray(r.quiz_answer_keys) ? r.quiz_answer_keys[0] : r.quiz_answer_keys;
  const key = keyRow?.answer_key ?? {};
  return {
    id: r.id, classId: r.course_id, kind: r.kind, title: r.title, subject: r.subject, topic: r.topic, status: r.status,
    questions: (r.questions ?? []).map((q) => {
      const correctIndex = key[q.id];
      return correctIndex != null ? { ...q, correctIndex } : q;
    }),
    createdAt: r.created_at,
    ...(r.available_from ? { availableFrom: r.available_from } : {}),
    ...(r.due_at ? { dueAt: r.due_at } : {}),
    ...(r.attachment_name ? { attachmentName: r.attachment_name } : {}),
    ...(r.attachment_file_id ? { attachmentFileId: r.attachment_file_id } : {}),
  };
}

// ---------------------------------------------------------------------------
// Courses (institution-managed, read-only here)
// ---------------------------------------------------------------------------
async function myTeacherId(): Promise<string> {
  const { data } = await db().auth.getSession();
  const email = data.session?.user.email?.toLowerCase();
  if (!email) throw new Error("Sign in again to continue.");
  const row = check(await db().from("people").select("id").eq("email", email).maybeSingle()) as { id: string } | null;
  if (!row) throw new Error("Your account isn't in the institution directory.");
  return row.id;
}

export async function listClasses(): Promise<SchoolClass[]> {
  const teacherId = await myTeacherId();
  const rows = check(
    await db()
      .from("courses")
      .select("id, code, name, subject, grade, teacher_id, enrollments(student_id, people(id, full_name, email))")
      .eq("teacher_id", teacherId)
      .order("name"),
  ) as unknown as CourseRow[];
  return rows.map(courseFromRow);
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------
export async function listHomework(filters?: { classId?: string }): Promise<HomeworkAssignment[]> {
  let q = db().from("homework").select("*").order("due_at", { ascending: true });
  if (filters?.classId) q = q.eq("course_id", filters.classId);
  return (check(await q) as HomeworkRow[]).map(homeworkFromRow);
}

export async function getHomework(id: string): Promise<HomeworkAssignment | null> {
  const row = check(await db().from("homework").select("*").eq("id", id).maybeSingle()) as HomeworkRow | null;
  return row ? homeworkFromRow(row) : null;
}

export async function createHomework(input: {
  classId: string;
  title: string;
  subject: string;
  topic: string;
  description: string;
  instructions: string;
  dueAt: string;
  totalMarks: number;
  status: HomeworkAssignment["status"];
  tasks: HomeworkAssignment["tasks"];
  pdf?: File | null;
}): Promise<HomeworkAssignment> {
  const meta = input.pdf ? await savePdfFile(input.pdf) : null;
  const row = check(
    await db()
      .from("homework")
      .insert({
        course_id: input.classId,
        title: input.title.trim(),
        subject: input.subject.trim(),
        topic: input.topic.trim(),
        description: input.description.trim(),
        instructions: input.instructions.trim(),
        due_at: new Date(input.dueAt).toISOString(),
        total_marks: input.totalMarks,
        status: input.status,
        tasks: input.tasks,
        attachment_name: meta?.name ?? null,
        attachment_file_id: meta?.id ?? null,
      })
      .select("*")
      .single(),
  ) as HomeworkRow;
  notify();
  return homeworkFromRow(row);
}

export async function deleteHomework(id: string): Promise<void> {
  // Its submissions cascade; a DB trigger removes its grades so nothing stale reaches students/parents.
  check(await db().from("homework").delete().eq("id", id));
  notify();
}

export async function listHomeworkSubmissions(assignmentId: string): Promise<HomeworkSubmission[]> {
  const rows = check(
    await db()
      .from("homework_submissions")
      .select("*, people(full_name)")
      .eq("homework_id", assignmentId)
      .order("submitted_at", { ascending: true }),
  ) as Array<{
    id: string; homework_id: string; student_id: string; status: HomeworkSubmission["status"];
    answers: Record<string, string>; submitted_at: string | null; marks: number | null; feedback: string | null;
    grade_state: HomeworkSubmission["gradeState"]; people: { full_name: string } | null;
  }>;
  return rows.map((r) => ({
    id: r.id, assignmentId: r.homework_id, studentId: r.student_id, studentName: r.people?.full_name ?? "Student",
    status: r.status, answers: r.answers ?? {}, gradeState: r.grade_state,
    ...(r.submitted_at ? { submittedAt: r.submitted_at } : {}),
    ...(r.marks != null ? { marks: Number(r.marks) } : {}),
    ...(r.feedback ? { feedback: r.feedback } : {}),
  }));
}

/** Saves a grade; publish = release it to the student (and their parents). */
export async function saveHomeworkGrade(input: {
  submissionId: string;
  marks: number;
  feedback: string;
  publish: boolean;
}): Promise<void> {
  check(
    await db().rpc("grade_homework", {
      p_submission_id: input.submissionId,
      p_marks: input.marks,
      p_feedback: input.feedback,
      p_publish: input.publish,
    }),
  );
  notify();
}

// ---------------------------------------------------------------------------
// Quizzes & tests
// ---------------------------------------------------------------------------
export async function listQuizzes(filters?: { classId?: string }): Promise<QuizAssessment[]> {
  let q = db().from("quizzes").select("*, quiz_answer_keys(answer_key)").order("created_at", { ascending: false });
  if (filters?.classId) q = q.eq("course_id", filters.classId);
  return (check(await q) as QuizRow[]).map(quizFromRow);
}

export async function createQuiz(input: Omit<QuizAssessment, "id" | "createdAt"> & { pdf?: File | null }): Promise<QuizAssessment> {
  const meta = input.pdf ? await savePdfFile(input.pdf) : null;
  // Answers go to the teacher-only key table; students only ever read `questions`.
  const answerKey: Record<string, number> = {};
  const publicQuestions = input.questions.map(({ correctIndex, ...q }) => {
    if (q.type === "multiple_choice" && correctIndex != null) answerKey[q.id] = correctIndex;
    return q;
  });
  const row = check(
    await db()
      .from("quizzes")
      .insert({
        course_id: input.classId,
        kind: input.kind,
        title: input.title,
        subject: input.subject,
        topic: input.topic,
        status: input.status,
        available_from: input.availableFrom ?? null,
        due_at: input.dueAt ?? null,
        questions: publicQuestions,
        attachment_name: meta?.name ?? null,
        attachment_file_id: meta?.id ?? null,
      })
      .select("*")
      .single(),
  ) as QuizRow;
  const keyRes = await db().from("quiz_answer_keys").insert({ quiz_id: row.id, answer_key: answerKey });
  if (keyRes.error) {
    await db().from("quizzes").delete().eq("id", row.id);
    throw new Error(`Could not save answer key: ${keyRes.error.message}`);
  }
  notify();
  return quizFromRow({ ...row, quiz_answer_keys: { answer_key: answerKey } });
}

export async function listQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
  const rows = check(
    await db().from("quiz_attempts").select("*, people(full_name)").eq("quiz_id", quizId).order("submitted_at"),
  ) as Array<{
    id: string; quiz_id: string; student_id: string; answers: Record<string, string | number>;
    auto_score: number | null; teacher_score: number | null; feedback: string | null;
    grade_state: QuizAttempt["gradeState"]; submitted_at: string; people: { full_name: string } | null;
  }>;
  return rows.map((r) => ({
    id: r.id, quizId: r.quiz_id, studentId: r.student_id, studentName: r.people?.full_name ?? "Student",
    answers: r.answers ?? {}, gradeState: r.grade_state, submittedAt: r.submitted_at,
    ...(r.auto_score != null ? { autoScore: Number(r.auto_score) } : {}),
    ...(r.teacher_score != null ? { teacherScore: Number(r.teacher_score) } : {}),
    ...(r.feedback ? { feedback: r.feedback } : {}),
  }));
}

/** Release every grade for this quiz to students and parents. Returns rows published. */
export async function publishQuizGrades(quizId: string): Promise<number> {
  const n = check(await db().rpc("publish_quiz_grades", { p_quiz_id: quizId })) as number;
  notify();
  return n ?? 0;
}

// ---------------------------------------------------------------------------
// Performance (computed from real attempts only — nothing fabricated)
// ---------------------------------------------------------------------------
async function allAttempts(quizIds: string[]): Promise<QuizAttempt[]> {
  if (!quizIds.length) return [];
  const rows = check(await db().from("quiz_attempts").select("quiz_id, student_id, answers, auto_score, teacher_score").in("quiz_id", quizIds)) as Array<{
    quiz_id: string; student_id: string; answers: Record<string, string | number>; auto_score: number | null; teacher_score: number | null;
  }>;
  return rows.map((r) => ({
    id: "", quizId: r.quiz_id, studentId: r.student_id, studentName: "", answers: r.answers ?? {}, gradeState: "draft",
    submittedAt: "",
    ...(r.auto_score != null ? { autoScore: Number(r.auto_score) } : {}),
    ...(r.teacher_score != null ? { teacherScore: Number(r.teacher_score) } : {}),
  }));
}

export async function listTopicPerformance(classId?: string): Promise<TopicPerformance[]> {
  const quizzes = await listQuizzes(classId ? { classId } : undefined);
  const attempts = await allAttempts(quizzes.map((q) => q.id));
  const byTopic = new Map<string, TopicPerformance>();

  for (const quiz of quizzes) {
    const quizAttempts = attempts.filter((a) => a.quizId === quiz.id);
    for (const q of quiz.questions) {
      if (q.type !== "multiple_choice" || q.correctIndex == null) continue;
      const topic = q.topic?.trim() || quiz.topic || "General";
      const answered = quizAttempts.filter((a) => a.answers[q.id] !== undefined);
      if (!answered.length) continue;
      const correct = answered.filter((a) => Number(a.answers[q.id]) === q.correctIndex).length;
      const key = `${quiz.classId}:${topic}`;
      const prev = byTopic.get(key);
      const total = (prev?.total ?? 0) + answered.length;
      const correctSum = (prev?.correct ?? 0) + correct;
      const pct = total ? correctSum / total : 0;
      byTopic.set(key, {
        topic,
        subject: quiz.subject,
        classId: quiz.classId,
        correct: correctSum,
        total,
        source: quiz.kind === "test" ? "test" : "quiz",
        strength: pct >= 0.75 ? "strong" : pct <= 0.45 ? "attention" : "neutral",
        evidence: `${correctSum} of ${total} correct on “${topic}” across assessments.`,
      });
    }
  }
  return [...byTopic.values()];
}

export async function listAssessmentInsights(): Promise<MisconceptionInsight[]> {
  const topics = await listTopicPerformance();
  return topics
    .filter((t) => t.strength === "attention")
    .map((t) => ({
      id: `ins-${t.classId}-${t.topic}`,
      topic: t.topic,
      source: t.source,
      title: `Low performance on ${t.topic}`,
      explanation: t.evidence,
      affected: t.total - t.correct,
      total: t.total,
      evidence: [t.evidence],
      recommendedAction: "Review this topic with a mini-lesson or targeted homework.",
      classId: t.classId,
      subject: t.subject,
      aiInterpretation: false,
    }));
}

/** All grades for a student in this teacher's courses (draft and published). */
export async function listGradesForStudent(studentId: string): Promise<Grade[]> {
  const rows = check(await db().from("grades").select("*").eq("student_id", studentId).order("updated_at", { ascending: false })) as Array<{
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

// ---------------------------------------------------------------------------
// Lesson-plan PDFs for live sessions (browser-local)
// ---------------------------------------------------------------------------
const DOCS_KEY = "classbridge:session-docs:v1";
type SessionDocs = Record<string, { lessonPlanFileId: string; lessonPlanName: string }>;

function readDocs(): SessionDocs {
  try {
    return JSON.parse(window.localStorage.getItem(DOCS_KEY) ?? "{}") as SessionDocs;
  } catch {
    return {};
  }
}

export async function setSessionLessonPlan(sessionId: string, pdf: File): Promise<{ fileId: string; name: string }> {
  if (!sessionId) throw new Error("Create a session before attaching a lesson plan.");
  const meta = await savePdfFile(pdf);
  try {
    window.localStorage.setItem(DOCS_KEY, JSON.stringify({ ...readDocs(), [sessionId]: { lessonPlanFileId: meta.id, lessonPlanName: meta.name } }));
  } catch {
    /* storage unavailable */
  }
  return { fileId: meta.id, name: meta.name };
}

export async function getSessionLessonPlan(sessionId: string): Promise<{ lessonPlanFileId: string; lessonPlanName: string } | null> {
  if (!sessionId || typeof window === "undefined") return null;
  return readDocs()[sessionId] ?? null;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardAssessmentSummary(_liveStudentCount: number): Promise<DashboardSummary> {
  const [classes, homework, quizzes] = await Promise.all([listClasses(), listHomework(), listQuizzes()]);
  const hwIds = homework.map((h) => h.id);
  const pending = hwIds.length
    ? (check(await db().from("homework_submissions").select("id").in("homework_id", hwIds).eq("status", "submitted")) as unknown[]).length
    : 0;
  const attempts = await allAttempts(quizzes.map((q) => q.id));
  const quizById = new Map(quizzes.map((q) => [q.id, q]));
  let sumPct = 0;
  let n = 0;
  for (const a of attempts) {
    const total = quizById.get(a.quizId)?.questions.reduce((x, q) => x + q.marks, 0) ?? 0;
    const score = a.teacherScore ?? a.autoScore;
    if (!total || score == null) continue;
    sumPct += (score / total) * 100;
    n += 1;
  }
  const topics = await listTopicPerformance();
  return {
    totalStudents: new Set(classes.flatMap((c) => c.studentIds)).size,
    activeClasses: classes.length,
    homeworkAssigned: homework.filter((h) => h.status === "published").length,
    pendingSubmissions: pending,
    averageQuizPerformance: n ? Math.round(sumPct / n) : null,
    studentsNeedingSupport: topics.filter((t) => t.strength === "attention").length,
  };
}
