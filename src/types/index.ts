/** Canonical ClassBridge domain types (Phase 1+). */

/** BCP-47-ish language code from the student dropdown (en, hi, es, zh, …). */
export type Lang = string;

/** Per-language strings; keys are language codes. */
export type Localized = Record<string, string>;

export type SessionStatus = "draft" | "live" | "ended";

export type Session = {
  id: string;
  code: string;
  title: string;
  subject: string;
  notes: string;
  notes_localized: Localized | null;
  status: SessionStatus;
  created_at: string;
  started_at: string | null;
};

export type Student = {
  id: string;
  session_id: string;
  name: string;
  language: Lang;
  created_at: string;
};

export type Question = {
  id: string;
  session_id: string;
  text: string;
  detected_language: string;
  is_romanized: boolean;
  english_gloss: string;
  student_name: string | null;
  answer?: string;
  created_at: string;
  student_id?: string | null;
  is_anonymous?: boolean;
  answer_lang?: Lang | null;
  /** Cached translations of the AI answer keyed by language code. */
  answers_localized?: Localized;
  status?: "pending" | "analyzed" | "answered";
  misconception_id?: string | null;
  /** pending → translating; done → english_gloss holds the translation; not_needed → already English. */
  translation_status?: TranslationStatus;
  translation_error?: string | null;
};

export type TranslationStatus = "pending" | "done" | "not_needed" | "failed";

export type Misconception = {
  id: string;
  label: string;
  confidence: number;
  question_ids: string[];
  languages: string[];
  suggested_intervention: string;
  session_id?: string;
};

export type Activity = {
  id: string;
  misconception_id: string | null;
  html: string;
  explanation: Localized;
  shared: boolean;
  session_id?: string;
  created_at?: string;
};

export type Check = {
  id: string;
  question: Localized;
  options: Localized[];
  correct_index: number;
  phase: "pre" | "post";
  session_id: string;
  misconception_id: string | null;
  created_at?: string;
};

export type CheckResponse = {
  id: string;
  check_id: string;
  student_id: string;
  selected_index: number;
  correct: boolean;
  created_at?: string;
};

// ---------------------------------------------------------------------------
// UI compatibility
// ---------------------------------------------------------------------------

export type ClassroomSession = {
  id: string;
  title: string;
  subject: string;
  notes: string;
  notesLocalized: Localized | null;
  joinCode: string;
  status: SessionStatus;
  createdAt: number;
  startedAt?: number | undefined;
};

export type DetectedLanguage = string;

export type StudentQuestion = {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  text: string;
  detectedLanguage: DetectedLanguage;
  status: "pending" | "analyzed" | "answered";
  misconceptionId?: string | undefined;
  createdAt: number;
  isDemo?: boolean | undefined;
  answer?: string | undefined;
  answerLang?: string | null | undefined;
  answersLocalized?: Localized | undefined;
  isRomanized?: boolean | undefined;
  /** English translation of `text` for the teacher (`text` is always the original). */
  englishGloss?: string | undefined;
  isAnonymous?: boolean | undefined;
  translationStatus?: TranslationStatus | undefined;
  translationError?: string | null | undefined;
};

export type UiMisconception = {
  id: string;
  title: string;
  explanation: string;
  questionIds: string[];
  languages: DetectedLanguage[];
  intervention: string;
  severity: "high" | "medium" | "low";
  isDemo: boolean;
  confidence?: number;
};

export type QuizQuestion = {
  id: string;
  prompt: Record<string, string>;
  options: string[];
  correctIndex: number;
  feedback: Record<string, { correct: string; incorrect: string }>;
};

export type LearningActivity = {
  id: string;
  sessionId: string;
  misconceptionId?: string | undefined;
  type: "fraction-compare";
  title: Record<string, string>;
  denominators: [number, number];
  explanation: Record<string, string>;
  instructions: Record<string, string>;
  quiz: QuizQuestion;
  status: "draft" | "shared";
  sharedAt?: number | undefined;
};

export type QuizResponse = {
  id: string;
  activityId: string;
  studentId: string;
  selectedIndex: number;
  correct: boolean;
  createdAt: number;
};

export type AppState = {
  session: ClassroomSession;
  students: Array<{ id: string; name: string; language: Lang; joinedAt: number }>;
  questions: StudentQuestion[];
  misconceptions: UiMisconception[];
  /** AI-generated iframe activities (Phase 3). */
  activities: Activity[];
  checks: Check[];
  checkResponses: CheckResponse[];
  /** @deprecated legacy fraction quiz — kept empty for older screens */
  quizResponses: QuizResponse[];
};

export function activityLabel(a: Activity): string {
  const en = a.explanation["en"];
  if (en) return en.slice(0, 80);
  const first = Object.values(a.explanation)[0];
  return first ? first.slice(0, 80) : "Activity";
}

export function sessionToUi(s: Session): ClassroomSession {
  return {
    id: s.id,
    title: s.title,
    subject: s.subject,
    notes: s.notes,
    notesLocalized: s.notes_localized,
    joinCode: s.code,
    status: s.status,
    createdAt: Date.parse(s.created_at) || Date.now(),
    ...(s.started_at ? { startedAt: Date.parse(s.started_at) } : {}),
  };
}

export function questionToUi(q: Question): StudentQuestion {
  const anonymous = Boolean(q.is_anonymous);
  return {
    id: q.id,
    sessionId: q.session_id,
    studentId: anonymous ? "" : (q.student_id ?? ""),
    studentName: anonymous ? "Anonymous" : (q.student_name ?? "Anonymous"),
    text: q.text,
    detectedLanguage: q.detected_language,
    status: q.status ?? "pending",
    createdAt: Date.parse(q.created_at) || Date.now(),
    ...(q.misconception_id ? { misconceptionId: q.misconception_id } : {}),
    ...(q.answer ? { answer: q.answer } : {}),
    answerLang: q.answer_lang ?? null,
    answersLocalized: q.answers_localized ?? (q.answer && q.answer_lang ? { [q.answer_lang]: q.answer } : {}),
    isRomanized: q.is_romanized,
    englishGloss: q.english_gloss,
    isAnonymous: anonymous,
    translationStatus: q.translation_status ?? (q.english_gloss ? "done" : "pending"),
    translationError: q.translation_error ?? null,
  };
}

export function misconceptionToUi(m: Misconception): UiMisconception {
  const n = m.question_ids?.length ?? 0;
  const severity: UiMisconception["severity"] =
    m.confidence >= 0.75 || n >= 5 ? "high" : m.confidence >= 0.45 || n >= 3 ? "medium" : "low";
  return {
    id: m.id,
    title: m.label,
    explanation: m.suggested_intervention,
    questionIds: m.question_ids ?? [],
    languages: m.languages ?? [],
    intervention: m.suggested_intervention,
    severity,
    isDemo: false,
    confidence: m.confidence,
  };
}

export function studentToUi(s: Student) {
  return {
    id: s.id,
    name: s.name,
    language: s.language,
    joinedAt: Date.parse(s.created_at) || Date.now(),
  };
}
