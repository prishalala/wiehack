import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common";
import { PdfAttachmentLink } from "@/components/teacher/PdfAttachmentLink";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listQuizAttempts, listQuizzes, publishQuizGrades, subscribeTeacherPortal } from "@/services/teacherPortalData";
import type { QuizAssessment, QuizAttempt } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/quizzes/")({
  head: () => ({ meta: [{ title: "Quizzes & Tests — ClassBridge" }] }),
  component: QuizzesPage,
});

function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<QuizAssessment[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [releasing, setReleasing] = useState(false);

  const refresh = useCallback(() => {
    void listQuizzes().then((q) => {
      setQuizzes(q);
      setSelectedId((prev) => prev || q[0]?.id || "");
    });
  }, []);

  useEffect(() => {
    refresh();
    return subscribeTeacherPortal(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setAttempts([]);
      return;
    }
    void listQuizAttempts(selectedId).then(setAttempts);
  }, [selectedId]);

  const selected = quizzes.find((q) => q.id === selectedId) ?? null;

  const questionStats = useMemo(() => {
    if (!selected) return [];
    return selected.questions
      .filter((q) => q.type === "multiple_choice" && q.correctIndex != null)
      .map((q) => {
        const answered = attempts.filter((a) => a.answers[q.id] !== undefined);
        const correct = answered.filter((a) => a.answers[q.id] === q.correctIndex).length;
        const pct = answered.length ? Math.round((correct / answered.length) * 100) : 0;
        return { id: q.id, label: q.prompt.slice(0, 28) + (q.prompt.length > 28 ? "…" : ""), pct, correct, total: answered.length, topic: q.topic };
      });
  }, [selected, attempts]);

  const avg =
    attempts.length === 0 || !selected
      ? null
      : Math.round(
          (attempts.reduce((n, a) => n + (a.teacherScore ?? a.autoScore ?? 0), 0) /
            attempts.length /
            (selected.questions.reduce((n, q) => n + q.marks, 0) || 1)) *
            100,
        );

  const missed = [...questionStats].sort((a, b) => a.pct - b.pct)[0];
  const strong = [...questionStats].sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Quizzes & Tests</h1>
          <p className="mt-1 text-muted-foreground">MC auto-grades from answer keys; short answers need teacher review.</p>
        </div>
        <Button asChild>
          <Link to="/teacher/quizzes/new">
            <Plus className="h-4 w-4" /> Create assessment
          </Link>
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState icon={BookOpenCheck} title="No quizzes yet" body="Create a quiz or test — optionally attach a PDF." />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {quizzes.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedId(q.id)}
                className={`rounded-lg border px-3 py-2 text-sm ${selectedId === q.id ? "border-primary bg-primary-soft" : "bg-card hover:bg-muted"}`}
              >
                {q.title}
                <span className="ml-2 text-xs capitalize text-muted-foreground">{q.kind}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
                <div className="surface space-y-3 p-5">
                  <h2 className="font-semibold">{selected.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.topic} · {selected.questions.length} questions · {attempts.length} submissions
                  </p>
                  <PdfAttachmentLink fileId={selected.attachmentFileId} fileName={selected.attachmentName} />
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Average score</dt>
                      <dd className="font-display text-2xl font-semibold">{avg != null ? `${avg}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="capitalize">{selected.status}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      disabled={releasing || attempts.length === 0 || attempts.every((a) => a.gradeState === "published")}
                      onClick={async () => {
                        setReleasing(true);
                        try {
                          const n = await publishQuizGrades(selected.id);
                          toast.success(`Released ${n} grade(s) to students and parents`);
                          setAttempts(await listQuizAttempts(selected.id));
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not release grades");
                        } finally {
                          setReleasing(false);
                        }
                      }}
                    >
                      Release grades
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {attempts.filter((a) => a.gradeState === "published").length}/{attempts.length} released · students and parents only see released grades
                    </span>
                  </div>
                </div>
                <div className="surface space-y-3 p-5">
                  <h3 className="text-sm font-semibold">Insights for Misconception Radar</h3>
                  {missed && missed.total > 0 ? (
                    <p className="rounded-lg bg-alert-soft/60 p-3 text-sm">
                      <span className="font-medium">Needs attention:</span> {missed.correct} of {missed.total} correct on “{missed.label}”
                      {missed.topic ? ` (${missed.topic})` : ""}.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No graded attempts yet.</p>
                  )}
                  {strong && strong.total > 0 && (
                    <p className="rounded-lg bg-success-soft/60 p-3 text-sm">
                      <span className="font-medium">Performing well:</span> {strong.correct} of {strong.total} correct on “{strong.label}”.
                    </p>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to="/teacher/radar">Open Misconception Radar</Link>
                  </Button>
                </div>
              </div>
              <div className="surface p-5">
                <h3 className="font-semibold">Question correctness %</h3>
                <div className="mt-4 h-64">
                  {questionStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No multiple-choice results yet.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={questionStats}>
                        <CartesianGrid stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="pct" fill="var(--primary)" radius={[6, 6, 0, 0]} name="% correct" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="surface overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Auto score</th>
                  <th className="px-4 py-3">Teacher score</th>
                  <th className="px-4 py-3">Grade state</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attempts.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-medium">{a.studentName}</td>
                    <td className="px-4 py-3">{a.autoScore ?? "—"}</td>
                    <td className="px-4 py-3">{a.teacherScore ?? "Needs review"}</td>
                    <td className="px-4 py-3 capitalize">{a.gradeState}</td>
                    <td className="px-4 py-3">{new Date(a.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {attempts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                      No attempts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
