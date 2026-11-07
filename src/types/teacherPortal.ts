/**
 * Teacher Portal domain models.
 * Parent-portal-ready: grades/feedback are structured and publishable.
 * Keep separate from student join-session types in ./index.ts.
 */

export type UserRole = "teacher" | "student" | "parent";

export type Teacher = {
  id: string;
  fullName: string;
  email: string;
  role: "teacher";
  createdAt: string;
};

/** Directory account issued by the institution (uni/org email). */
export type Person = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  preferredLanguage: string;
};

/** A course from the institution roster (a "class" in the teacher UI). */
export type SchoolClass = {
  id: string;
  code: string;
  name: string;
  subject: string;
  grade: string;
  teacherId: string;
  studentIds: string[];
  /** Enrolled students (teacher view). */
  roster?: Array<{ id: string; fullName: string; email: string }>;
  teacherName?: string;
};

export type UnderstandingSignal = "understand" | "example" | "confused";

export type StudentFeedback = {
  id: string;
  sessionId: string;
  studentId: string;
  signal: UnderstandingSignal;
  updatedAt: number;
};

export type HomeworkStatus = "draft" | "published" | "closed";
export type SubmissionStatus = "missing" | "submitted" | "graded" | "returned";
export type GradePublishState = "draft" | "published";

export type HomeworkTask = {
  id: string;
  prompt: string;
  marks: number;
};

export type HomeworkAssignment = {
  id: string;
  classId: string;
  title: string;
  subject: string;
  topic: string;
  description: string;
  instructions: string;
  dueAt: string;
  totalMarks: number;
  status: HomeworkStatus;
  tasks: HomeworkTask[];
  attachmentName?: string;
  attachmentFileId?: string;
  createdAt: string;
  updatedAt: string;
};

export type HomeworkSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  status: SubmissionStatus;
  answers: Record<string, string>;
  submittedAt?: string;
  marks?: number;
  feedback?: string;
  gradeState: GradePublishState;
};

export type QuizQuestionType = "multiple_choice" | "short_answer";

export type AssessmentQuestion = {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options?: string[];
  /** Required for MC auto-grade. */
  correctIndex?: number;
  marks: number;
  topic?: string;
};

export type AssessmentKind = "quiz" | "test";
export type AssessmentStatus = "draft" | "published" | "closed";

export type QuizAssessment = {
  id: string;
  classId: string;
  kind: AssessmentKind;
  title: string;
  subject: string;
  topic: string;
  status: AssessmentStatus;
  availableFrom?: string;
  dueAt?: string;
  questions: AssessmentQuestion[];
  createdAt: string;
  attachmentName?: string;
  attachmentFileId?: string;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string | number>;
  autoScore?: number;
  teacherScore?: number;
  feedback?: string;
  gradeState: GradePublishState;
  submittedAt: string;
};

export type Grade = {
  id: string;
  studentId: string;
  classId: string;
  source: "homework" | "quiz" | "test";
  sourceId: string;
  title: string;
  marks: number;
  totalMarks: number;
  feedback?: string;
  /** Only published grades are parent-visible. */
  publishState: GradePublishState;
  topic?: string;
  updatedAt: string;
};

export type TopicPerformance = {
  topic: string;
  subject: string;
  classId: string;
  correct: number;
  total: number;
  source: "live_session" | "homework" | "quiz" | "test";
  strength: "strong" | "attention" | "neutral";
  evidence: string;
  /** AI interpretation — not proven without response context. */
  aiInterpretation?: string;
};

export type ParentStudentRelationship = {
  id: string;
  parentId: string;
  studentId: string;
  classId: string;
  linkedAt: string;
};

export type MisconceptionInsight = {
  id: string;
  topic: string;
  source: "live_session" | "homework" | "quiz" | "test";
  title: string;
  explanation: string;
  affected: number;
  total: number;
  evidence: string[];
  recommendedAction: string;
  classId?: string;
  subject?: string;
  /** True when the title is an AI guess rather than confirmed clustering. */
  aiInterpretation?: boolean;
};

export type DashboardSummary = {
  totalStudents: number;
  activeClasses: number;
  homeworkAssigned: number;
  pendingSubmissions: number;
  averageQuizPerformance: number | null;
  studentsNeedingSupport: number;
};
