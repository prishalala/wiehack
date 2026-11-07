/**
 * Real API layer. Sessions/students/questions/misconceptions via Supabase + Edge Functions.
 */
import type {
  Activity,
  Check,
  CheckResponse,
  ClassroomSession,
  Lang,
  Localized,
  Misconception,
  Question,
  Session,
  Student,
  StudentQuestion,
  UiMisconception,
} from "@/types";
import { misconceptionToUi, questionToUi, sessionToUi, studentToUi } from "@/types";
import { getSupabase, invokeFunction } from "@/lib/supabase";
import { languageLabel } from "@/lib/languages";
import {
  getSessionId,
  getState,
  getTeacherToken,
  rememberMyQuestionId,
  setSessionId,
  setState,
  setStudentId,
  setTeacherToken,
} from "@/lib/store";
import { lessonContent, type ExplanationLevel } from "@/i18n";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]!).join("");
}

function emptySession(): ClassroomSession {
  return {
    id: "",
    title: "No session yet",
    subject: "",
    notes: "",
    notesLocalized: null,
    joinCode: "------",
    status: "draft",
    createdAt: Date.now(),
  };
}

async function loadSessionBundle(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  const [sessionRes, studentsRes, questionsRes, miscRes, actRes, checkRes] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
    supabase.from("students").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
    supabase
      .from("questions_teacher_view")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false }),
    supabase.from("misconceptions").select("*").eq("session_id", sessionId).order("confidence", { ascending: false }),
    supabase.from("activities").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }),
    supabase.from("checks").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
  ]);

  if (sessionRes.error) throw new Error(sessionRes.error.message);
  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);
  if (miscRes.error) throw new Error(miscRes.error.message);
  if (actRes.error) throw new Error(actRes.error.message);
  if (checkRes.error) throw new Error(checkRes.error.message);

  const session = sessionRes.data as Session | null;
  const students = (studentsRes.data ?? []) as Student[];
  const questions = (questionsRes.data ?? []) as Question[];
  const misconceptions = ((miscRes.data ?? []) as Misconception[]).map(misconceptionToUi);
  const activities = (actRes.data ?? []) as Activity[];
  const checks = (checkRes.data ?? []) as Check[];

  let checkResponses: CheckResponse[] = [];
  const checkIds = checks.map((c) => c.id);
  if (checkIds.length) {
    const { data: respData, error: respErr } = await supabase
      .from("check_responses")
      .select("*")
      .in("check_id", checkIds);
    if (respErr) throw new Error(respErr.message);
    checkResponses = (respData ?? []) as CheckResponse[];
  }

  setState((s) => ({
    ...s,
    session: session ? sessionToUi(session) : emptySession(),
    students: students.map(studentToUi),
    questions: questions.map(questionToUi),
    misconceptions,
    activities,
    checks,
    checkResponses,
    quizResponses: [],
  }));
}

export async function refreshSession(): Promise<void> {
  const id = getSessionId() || getState().session.id;
  if (!id) return;
  await loadSessionBundle(id);
}

function activeSessionId(): string {
  const id = getSessionId() || getState().session.id;
  if (!id) throw new Error("No active session");
  return id;
}

/** Header proving this browser created the session (validated server-side). */
function teacherHeaders(sessionId: string): Record<string, string> {
  const token = getTeacherToken(sessionId);
  if (!token) {
    throw new Error("Teacher key not found in this browser. Open the session from the browser that created it, or create a new session.");
  }
  return { "x-teacher-token": token };
}

export async function createSession(input: {
  title: string;
  subject: string;
  notes: string;
}): Promise<ClassroomSession> {
  // Server generates the join code + teacher key; key is returned once and kept in this browser.
  const res = await invokeFunction<{ session: Session; teacher_token: string }>("teacher-session", {
    action: "create",
    title: input.title,
    subject: input.subject,
    notes: input.notes,
  });
  let created = res.session;
  setTeacherToken(created.id, res.teacher_token);

  // Best-effort: also get a clean English version via AI (no-op if already English)
  if (input.notes.trim()) {
    try {
      const result = await invokeFunction<{ notes_localized: Localized }>("translate-lesson", {
        session_id: created.id,
        notes: input.notes,
        target_langs: ["en"],
      });
      created = { ...created, notes_localized: result.notes_localized };
    } catch (err) {
      console.warn("translate-lesson failed; using raw notes as en", err);
    }
  }

  setSessionId(created.id);
  setState((s) => ({
    ...s,
    session: sessionToUi(created!),
    students: [],
    questions: [],
    misconceptions: [],
    activities: [],
    checks: [],
    checkResponses: [],
    quizResponses: [],
  }));
  return sessionToUi(created);
}

export async function setSessionStatus(status: ClassroomSession["status"]): Promise<void> {
  const sessionId = activeSessionId();
  const res = await invokeFunction<{ session: Session }>(
    "teacher-session",
    { action: "set_status", session_id: sessionId, status },
    teacherHeaders(sessionId),
  );
  setState((s) => ({ ...s, session: sessionToUi(res.session) }));
}

export class JoinError extends Error {}

export async function joinSession(input: {
  code: string;
  name: string;
  language: Lang;
}): Promise<{ id: string; name: string; language: Lang; joinedAt: number }> {
  const supabase = getSupabase();
  const code = input.code.trim().toUpperCase();
  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (error) throw new JoinError(error.message);
  if (!session) throw new JoinError("No classroom found with that code.");
  if ((session as Session).status === "ended") throw new JoinError("This session has ended.");

  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      session_id: (session as Session).id,
      name: input.name.trim(),
      language: input.language,
    })
    .select("*")
    .single();

  if (studentError || !student) throw new JoinError(studentError?.message ?? "Could not join.");

  const uiStudent = studentToUi(student as Student);
  setSessionId((session as Session).id);
  setStudentId(uiStudent.id);
  setState((s) => ({
    ...s,
    session: sessionToUi(session as Session),
    students: [...s.students.filter((st) => st.id !== uiStudent.id), uiStudent],
  }));
  await loadSessionBundle((session as Session).id);
  // Prefetch lesson in the student's language
  void ensureLessonTranslation(input.language).catch(() => {});
  return uiStudent;
}

/** Translate + cache lesson notes for a language code if missing. Instant if cached. */
export async function ensureLessonTranslation(lang: Lang): Promise<Localized> {
  const session = getState().session;
  if (!session.id) return session.notesLocalized ?? {};
  const existing = session.notesLocalized ?? {};
  if (existing[lang]?.trim()) return existing;

  const result = await invokeFunction<{ notes_localized: Localized }>("translate-lesson", {
    session_id: session.id,
    notes: session.notes,
    target_lang: lang,
  });

  setState((s) => ({
    ...s,
    session: { ...s.session, notesLocalized: result.notes_localized },
  }));
  return result.notes_localized;
}

/** Display answer in the student's language if cached; otherwise original. */
export function answerForLang(q: StudentQuestion, lang: Lang): string | undefined {
  const cached = q.answersLocalized?.[lang];
  if (cached?.trim()) return cached;
  if (q.answerLang === lang || !q.answerLang) return q.answer;
  return q.answer;
}

export function answerNeedsTranslate(q: StudentQuestion, lang: Lang): boolean {
  if (!q.answer?.trim()) return false;
  if (q.answersLocalized?.[lang]?.trim()) return false;
  if (!q.answerLang) return false;
  return q.answerLang !== lang;
}

/** Translate an existing AI answer into target_lang and cache on the question row. */
export async function translateAnswer(questionId: string, targetLang: Lang): Promise<string> {
  const result = await invokeFunction<{ text: string; answers_localized: Localized }>("translate-answer", {
    question_id: questionId,
    target_lang: targetLang,
    target_lang_label: languageLabel(targetLang),
  });
  setState((s) => ({
    ...s,
    questions: s.questions.map((q) =>
      q.id === questionId
        ? { ...q, answersLocalized: result.answers_localized }
        : q,
    ),
  }));
  return result.text;
}

export async function submitQuestion(input: {
  studentId: string;
  studentName: string;
  text: string;
  isAnonymous?: boolean;
  language?: Lang;
}): Promise<StudentQuestion> {
  const sessionId = getSessionId() || getState().session.id;
  if (!sessionId) throw new Error("No active session");

  const lang = input.language ?? getState().students.find((s) => s.id === input.studentId)?.language ?? "en";
  const isAnonymous = Boolean(input.isAnonymous);

  if (!input.text.trim()) throw new Error("Question cannot be empty.");

  // The original text is stored first; translation/answer failures come back as flags, not errors.
  const result = await invokeFunction<{
    question: Question;
    translation_error: string | null;
    answer_error: string | null;
  }>("process-question", {
    session_id: sessionId,
    text: input.text,
    student_language: lang,
    student_language_label: languageLabel(lang),
    student_id: isAnonymous ? null : input.studentId,
    student_name: isAnonymous ? null : input.studentName,
    is_anonymous: isAnonymous,
  });

  const ui = questionToUi(result.question);
  rememberMyQuestionId(ui.id);
  setState((s) => ({ ...s, questions: [ui, ...s.questions.filter((q) => q.id !== ui.id)] }));
  return ui;
}

/** translateQuestionToEnglish: (re)run detection + English translation for a stored question. */
export async function translateQuestionToEnglish(questionId: string): Promise<StudentQuestion> {
  const sessionId = activeSessionId();
  const result = await invokeFunction<{ question: Question; translation_error: string | null }>(
    "translate-question",
    { question_id: questionId, session_id: sessionId },
  );
  const ui = questionToUi(result.question);
  setState((s) => ({ ...s, questions: s.questions.map((q) => (q.id === ui.id ? ui : q)) }));
  if (result.translation_error) throw new Error("Translation is still unavailable. Try again shortly.");
  return ui;
}

export async function markAnswered(questionId: string): Promise<void> {
  const sessionId = activeSessionId();
  await invokeFunction(
    "teacher-session",
    { action: "mark_answered", session_id: sessionId, question_id: questionId },
    teacherHeaders(sessionId),
  );
  setState((s) => ({
    ...s,
    questions: s.questions.map((q) => (q.id === questionId ? { ...q, status: "answered" as const } : q)),
  }));
}

export async function getSessionQuestions(): Promise<StudentQuestion[]> {
  const sessionId = getSessionId() || getState().session.id;
  if (!sessionId) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("questions_teacher_view")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const questions = ((data ?? []) as Question[]).map(questionToUi);
  setState((s) => ({ ...s, questions }));
  return questions;
}

export async function getMisconceptions(): Promise<UiMisconception[]> {
  const sessionId = getSessionId() || getState().session.id;
  if (!sessionId) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("misconceptions")
    .select("*")
    .eq("session_id", sessionId)
    .order("confidence", { ascending: false });
  if (error) throw new Error(error.message);
  const misconceptions = ((data ?? []) as Misconception[]).map(misconceptionToUi);
  setState((s) => ({ ...s, misconceptions }));
  return misconceptions;
}

/** Run AI misconception clustering for the active session. */
export async function analyzeMisconceptions(sessionId?: string): Promise<{
  misconceptions: UiMisconception[];
  unclustered: string[];
}> {
  const id = sessionId || getSessionId() || getState().session.id;
  if (!id) throw new Error("No active session");

  const result = await invokeFunction<{
    misconceptions: Misconception[];
    unclustered: string[];
  }>("analyze-misconceptions", { session_id: id }, teacherHeaders(id));

  const misconceptions = (result.misconceptions ?? []).map(misconceptionToUi);
  setState((s) => ({ ...s, misconceptions }));
  await loadSessionBundle(id);
  return { misconceptions: getState().misconceptions, unclustered: result.unclustered ?? [] };
}

export async function generateExplanation(input: {
  lang: Lang;
  level: ExplanationLevel;
  fail?: boolean;
}): Promise<string[]> {
  if (input.fail) throw new Error("Explanation service unavailable");
  const sessionId = getSessionId() || getState().session.id;
  const result = await invokeFunction<{ lines: string[] }>("explain-simpler", {
    session_id: sessionId || undefined,
    notes: getState().session.notes,
    language: input.lang,
    language_label: languageLabel(input.lang),
    level: input.level,
  });
  return result.lines;
}

export async function getLessonTranslation(lang: Lang) {
  try {
    const loc = await ensureLessonTranslation(lang);
    if (loc[lang]) {
      return {
        topic: getState().session.title,
        sections: [{ heading: "Lesson notes", body: loc[lang]! }],
      };
    }
  } catch {
    /* fall through */
  }
  return lessonContent["en"]!;
}

/** Generate (or return existing) AI interactive activity for a misconception. */
export async function generateMiniLesson(misconceptionId: string, opts?: { regenerate?: boolean }): Promise<Activity> {
  const sessionId = getSessionId() || getState().session.id;
  if (!opts?.regenerate) {
    const existing = getState().activities.find((a) => a.misconception_id === misconceptionId);
    if (existing) return existing;
  }

  const result = await invokeFunction<{ activity: Activity }>(
    "generate-activity",
    {
      misconception_id: misconceptionId,
      session_id: sessionId || undefined,
      regenerate: Boolean(opts?.regenerate),
      langs: ["en", "hi", "fr", "es", "ar"],
    },
    teacherHeaders(sessionId),
  );

  // Also generate pre/post checks (best-effort)
  try {
    await generateCheck(misconceptionId);
  } catch (err) {
    console.warn("generate-check failed", err);
  }

  if (sessionId) await loadSessionBundle(sessionId);
  return result.activity;
}

export async function regenerateActivity(misconceptionId: string): Promise<Activity> {
  return generateMiniLesson(misconceptionId, { regenerate: true });
}

export async function generateCheck(misconceptionId: string): Promise<{ pre: Check | null; post: Check | null }> {
  const sessionId = getSessionId() || getState().session.id;
  const result = await invokeFunction<{ pre: Check | null; post: Check | null; checks: Check[] }>(
    "generate-check",
    {
      misconception_id: misconceptionId,
      session_id: sessionId || undefined,
      langs: ["en", "hi", "fr", "es", "ar"],
    },
    teacherHeaders(sessionId),
  );
  if (sessionId) await loadSessionBundle(sessionId);
  return { pre: result.pre, post: result.post };
}

export async function shareActivity(activityId: string): Promise<void> {
  const sessionId = activeSessionId();
  await invokeFunction(
    "teacher-session",
    { action: "share_activity", session_id: sessionId, activity_id: activityId },
    teacherHeaders(sessionId),
  );
  setState((s) => ({
    ...s,
    activities: s.activities.map((a) => (a.id === activityId ? { ...a, shared: true } : a)),
  }));
}

export async function submitCheckResponse(input: {
  checkId: string;
  studentId: string;
  selectedIndex: number;
}): Promise<CheckResponse> {
  const check = getState().checks.find((c) => c.id === input.checkId);
  if (!check) throw new Error("Check not found");
  const correct = input.selectedIndex === check.correct_index;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("check_responses")
    .upsert(
      {
        check_id: input.checkId,
        student_id: input.studentId,
        selected_index: input.selectedIndex,
        correct,
      },
      { onConflict: "check_id,student_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = data as CheckResponse;
  setState((s) => ({
    ...s,
    checkResponses: [...s.checkResponses.filter((r) => !(r.check_id === row.check_id && r.student_id === row.student_id)), row],
  }));
  return row;
}

/** Teacher stats: % correct pre vs post for a misconception. */
export function checkStats(misconceptionId: string): { prePct: number | null; postPct: number | null; preN: number; postN: number } {
  const { checks, checkResponses } = getState();
  const pre = checks.find((c) => c.misconception_id === misconceptionId && c.phase === "pre");
  const post = checks.find((c) => c.misconception_id === misconceptionId && c.phase === "post");
  const pct = (checkId?: string) => {
    if (!checkId) return { pct: null as number | null, n: 0 };
    const rows = checkResponses.filter((r) => r.check_id === checkId);
    if (!rows.length) return { pct: null, n: 0 };
    return { pct: Math.round((rows.filter((r) => r.correct).length / rows.length) * 100), n: rows.length };
  };
  const a = pct(pre?.id);
  const b = pct(post?.id);
  return { prePct: a.pct, postPct: b.pct, preN: a.n, postN: b.n };
}
