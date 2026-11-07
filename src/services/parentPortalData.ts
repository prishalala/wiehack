/**
 * Parent portal data — Supabase, scoped by RLS to students in parent_links.
 * Only published grades and non-draft coursework are readable.
 */
import { getSupabase } from "@/lib/supabase";
import { translateUiTexts } from "@/services/translateUi";

const db = () => getSupabase("parent");

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export type LinkedChild = {
  id: string;
  fullName: string;
  preferredLanguage: string;
};

export type ParentAssignmentItem = {
  id: string;
  kind: "homework" | "quiz" | "test" | "project";
  title: string;
  instructions: string;
  dueDate: string | null;
  maxPoints: number;
  score: number | null;
  percent: number | null;
  feedback: string;
  courseName: string;
  topic: string;
};

export type ParentWeakArea = {
  id: string;
  title: string;
  description: string;
  childAffected: boolean;
  howToHelp: string;
};

export type ParentOverview = {
  childName: string;
  courses: { id: string; name: string; subject: string }[];
  assignments: ParentAssignmentItem[];
  gradeSummary: Record<string, number | null>;
  weakAreas: ParentWeakArea[];
  stats: { graded: number; assignments: number; avgPercent: number | null };
};

export async function listLinkedChildren(): Promise<LinkedChild[]> {
  const links = check(await db().from("parent_links").select("student_id")) as Array<{ student_id: string }>;
  if (!links.length) return [];
  const people = check(
    await db().from("people").select("id, full_name, preferred_language").in(
      "id",
      links.map((l) => l.student_id),
    ),
  ) as Array<{ id: string; full_name: string; preferred_language: string }>;
  return people.map((p) => ({ id: p.id, fullName: p.full_name, preferredLanguage: p.preferred_language }));
}

export async function getParentOverview(childId: string): Promise<ParentOverview> {
  const children = await listLinkedChildren();
  const child = children.find((c) => c.id === childId);
  if (!child) throw new Error("This student is not linked to your parent account.");

  const enrollments = check(
    await db().from("enrollments").select("course_id, courses(id, name, subject)").eq("student_id", childId),
  ) as unknown as Array<{ course_id: string; courses: { id: string; name: string; subject: string } | null }>;
  const courses = enrollments.map((e) => e.courses).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const courseIds = courses.map((c) => c.id);
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? "";

  const grades = courseIds.length
    ? (check(
        await db().from("grades").select("*").eq("student_id", childId).eq("publish_state", "published").order("updated_at", { ascending: false }),
      ) as Array<{
        id: string;
        course_id: string;
        source: string;
        source_id: string;
        title: string;
        marks: number;
        total_marks: number;
        feedback: string | null;
        topic: string | null;
      }>)
    : [];

  const homework = courseIds.length
    ? (check(await db().from("homework").select("*").in("course_id", courseIds).neq("status", "draft").order("due_at")) as Array<{
        id: string;
        course_id: string;
        title: string;
        description: string;
        instructions: string;
        due_at: string;
        total_marks: number;
        topic: string;
      }>)
    : [];

  const quizzes = courseIds.length
    ? (check(await db().from("quizzes").select("*").in("course_id", courseIds).neq("status", "draft").order("due_at", { ascending: true })) as Array<{
        id: string;
        course_id: string;
        kind: "quiz" | "test";
        title: string;
        topic: string;
        due_at: string | null;
        questions: unknown[];
      }>)
    : [];

  const gradeBySource = new Map(grades.map((g) => [`${g.source}:${g.source_id}`, g]));

  const assignments: ParentAssignmentItem[] = [];

  for (const h of homework) {
    const g = gradeBySource.get(`homework:${h.id}`);
    const maxPoints = Number(h.total_marks) || 0;
    const score = g ? Number(g.marks) : null;
    const percent = score != null && maxPoints > 0 ? Math.round((100 * score) / maxPoints) : null;
    assignments.push({
      id: h.id,
      kind: "homework",
      title: h.title,
      instructions: [h.description, h.instructions].filter(Boolean).join("\n\n").trim(),
      dueDate: h.due_at ? h.due_at.slice(0, 10) : null,
      maxPoints,
      score,
      percent,
      feedback: g?.feedback ?? "",
      courseName: courseName(h.course_id),
      topic: h.topic || g?.topic || "",
    });
  }

  for (const q of quizzes) {
    const g = gradeBySource.get(`quiz:${q.id}`) ?? gradeBySource.get(`test:${q.id}`);
    const maxPoints: number = Array.isArray(q.questions)
      ? q.questions.reduce<number>((sum, item) => {
          const marks = typeof item === "object" && item && "marks" in item ? Number((item as { marks?: number }).marks) : 1;
          return sum + (Number.isFinite(marks) ? marks : 1);
        }, 0)
      : g
        ? Number(g.total_marks)
        : 0;
    const score = g ? Number(g.marks) : null;
    const percent = score != null && maxPoints > 0 ? Math.round((100 * score) / maxPoints) : null;
    assignments.push({
      id: q.id,
      kind: q.kind,
      title: q.title,
      instructions: q.topic ? `Topic: ${q.topic}` : "",
      dueDate: q.due_at ? q.due_at.slice(0, 10) : null,
      maxPoints: maxPoints || (g ? Number(g.total_marks) : 0),
      score,
      percent,
      feedback: g?.feedback ?? "",
      courseName: courseName(q.course_id),
      topic: q.topic || g?.topic || "",
    });
  }

  // Orphan published grades (if coursework row missing).
  for (const g of grades) {
    const keyKind = g.source === "homework" ? "homework" : g.source === "test" ? "test" : "quiz";
    if (assignments.some((a) => a.id === g.source_id)) continue;
    const maxPoints = Number(g.total_marks) || 0;
    const score = Number(g.marks);
    assignments.push({
      id: g.id,
      kind: keyKind,
      title: g.title,
      instructions: "",
      dueDate: null,
      maxPoints,
      score,
      percent: maxPoints > 0 ? Math.round((100 * score) / maxPoints) : null,
      feedback: g.feedback ?? "",
      courseName: courseName(g.course_id),
      topic: g.topic ?? "",
    });
  }

  const byKind: Record<string, number[]> = {};
  for (const a of assignments) {
    if (a.percent == null) continue;
    (byKind[a.kind] ??= []).push(a.percent);
  }
  const gradeSummary: Record<string, number | null> = {};
  for (const [k, vals] of Object.entries(byKind)) {
    gradeSummary[k] = Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
  }
  const all = Object.values(byKind).flat();
  gradeSummary["overall"] = all.length ? Math.round(all.reduce((s, n) => s + n, 0) / all.length) : null;

  const weakAreas = buildWeakAreas(assignments);

  return {
    childName: child.fullName,
    courses,
    assignments,
    gradeSummary,
    weakAreas,
    stats: {
      graded: assignments.filter((a) => a.score != null).length,
      assignments: assignments.length,
      avgPercent: gradeSummary["overall"] ?? null,
    },
  };
}

function buildWeakAreas(assignments: ParentAssignmentItem[]): ParentWeakArea[] {
  const byTopic = new Map<string, { scores: number[]; feedback: string[] }>();
  for (const a of assignments) {
    if (a.percent == null) continue;
    const topic = a.topic.trim() || a.title;
    const row = byTopic.get(topic) ?? { scores: [], feedback: [] };
    row.scores.push(a.percent);
    if (a.feedback.trim()) row.feedback.push(a.feedback.trim());
    byTopic.set(topic, row);
  }
  return [...byTopic.entries()]
    .map(([topic, row]) => {
      const avg = row.scores.reduce((s, n) => s + n, 0) / row.scores.length;
      return {
        id: topic,
        title: topic,
        description:
          avg < 70
            ? `Average score around ${Math.round(avg)}% on work related to this topic.`
            : `Doing okay overall (~${Math.round(avg)}%), with room to review.` +
              (row.feedback[0] ? ` Teacher note: ${row.feedback[0]}` : ""),
        childAffected: avg < 75,
        howToHelp:
          avg < 70
            ? "Review the assignment together, ask your child to explain the tricky part in their own words, then try one similar practice question."
            : "Ask your child to teach you one idea from this topic — explaining is a strong way to lock it in.",
        avg,
      };
    })
    .filter((w) => w.childAffected)
    .sort((a, b) => a.avg - b.avg)
    .map(({ avg: _avg, ...rest }) => rest);
}

/** Best-effort content translation for parent dashboard copy. */
export async function translateParentTexts(lang: string, texts: string[]): Promise<string[]> {
  return translateUiTexts(lang, texts);
}
