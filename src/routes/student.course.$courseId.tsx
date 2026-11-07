import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Award, BookOpenCheck, CheckCircle2, ClipboardList, Loader2, Radio, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common";
import { JoinLiveButton } from "@/components/student/JoinLiveButton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/i18n";
import {
  getMyCourse,
  listMyGrades,
  listMyHomework,
  listMyQuizzes,
  submitHomework,
  submitQuiz,
  type MyHomework,
  type MyQuiz,
  type QuizResult,
  type StudentCourse,
} from "@/services/studentPortalData";
import type { Grade } from "@/types/teacherPortal";

export const Route = createFileRoute("/student/course/$courseId")({
  head: () => ({ meta: [{ title: "Course — ClassBridge" }] }),
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const { lang } = useLanguage();
  const [course, setCourse] = useState<StudentCourse | null | undefined>(undefined);
  const [homework, setHomework] = useState<MyHomework[]>([]);
  const [quizzes, setQuizzes] = useState<MyQuiz[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([getMyCourse(courseId), listMyHomework(courseId), listMyQuizzes(courseId), listMyGrades(courseId)])
      .then(([c, h, q, g]) => {
        setCourse(c);
        setHomework(h);
        setQuizzes(q);
        setGrades(g);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [courseId]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 15000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (course === undefined && !error) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> …</p>;
  }
  if (!course) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error ?? "Course not found, or you aren't enrolled in it."}</p>
        <Button asChild variant="outline"><Link to="/student">{t(lang, "backToCourses")}</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/student" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> {t(lang, "backToCourses")}
        </Link>
        <p className="mt-3 font-mono text-xs text-muted-foreground">{course.code}</p>
        <h1 className="font-display text-3xl font-semibold">{course.name}</h1>
        <p className="text-muted-foreground">{course.subject}{course.teacherName ? ` · ${course.teacherName}` : ""}</p>
      </div>

      <div
        className={`surface flex flex-wrap items-center gap-3 p-4 ${
          course.liveSession ? "border-success/40 bg-success-soft/30 ring-1 ring-success/15" : ""
        }`}
      >
        {course.liveSession ? (
          <>
            <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-foreground">
              <span className="live-dot" /> {t(lang, "liveNow")}
            </span>
            <span className="text-sm font-medium">{course.liveSession.title}</span>
            <span className="ms-auto">
              <JoinLiveButton sessionId={course.liveSession.id} />
            </span>
          </>
        ) : (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" aria-hidden /> {t(lang, "noLive")}
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <Tabs defaultValue="homework">
        <TabsList>
          <TabsTrigger value="homework"><ClipboardList className="mr-1.5 h-4 w-4" />{t(lang, "homework")} ({homework.length})</TabsTrigger>
          <TabsTrigger value="quizzes"><BookOpenCheck className="mr-1.5 h-4 w-4" />{t(lang, "quizzes")} ({quizzes.length})</TabsTrigger>
          <TabsTrigger value="grades"><Award className="mr-1.5 h-4 w-4" />{t(lang, "grades")}</TabsTrigger>
        </TabsList>

        <TabsContent value="homework" className="mt-4 space-y-3">
          {homework.length === 0 && <EmptyState icon={ClipboardList} title={t(lang, "noHomework")} body="" />}
          {homework.map((h) => <HomeworkCard key={h.id} hw={h} onSaved={refresh} />)}
        </TabsContent>

        <TabsContent value="quizzes" className="mt-4 space-y-3">
          {quizzes.length === 0 && <EmptyState icon={BookOpenCheck} title={t(lang, "noQuizzes")} body="" />}
          {quizzes.map((q) => <QuizCard key={q.id} quiz={q} onSubmitted={refresh} />)}
        </TabsContent>

        <TabsContent value="grades" className="mt-4">
          {grades.length === 0 ? (
            <EmptyState icon={Award} title={t(lang, "noGrades")} body="" />
          ) : (
            <ul className="surface divide-y">
              {grades.map((g) => (
                <li key={g.id} className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">{g.source}{g.topic ? ` · ${g.topic}` : ""} · {new Date(g.updatedAt).toLocaleDateString()}</p>
                    {g.feedback && <p className="mt-2 text-sm"><span className="text-muted-foreground">{t(lang, "feedback")}:</span> {g.feedback}</p>}
                  </div>
                  <p className="font-display text-xl font-semibold">{g.marks}/{g.totalMarks}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Due({ at }: { at: string }) {
  const { lang } = useLanguage();
  const d = new Date(at);
  const ms = d.getTime() - Date.now();
  const overdue = ms < 0;
  const dueSoon = !overdue && ms < 1000 * 60 * 60 * 48; // within 48h
  return (
    <span
      className={
        overdue
          ? "font-semibold text-destructive"
          : dueSoon
            ? "font-semibold text-alert-foreground"
            : undefined
      }
    >
      {overdue ? `${t(lang, "overdue")} · ` : dueSoon ? `${t(lang, "dueSoon")} · ` : ""}
      {t(lang, "due")}: {d.toLocaleString()}
    </span>
  );
}

function HomeworkCard({ hw, onSaved }: { hw: MyHomework; onSaved: () => void }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>(hw.submission?.answers ?? {});
  const [busy, setBusy] = useState(false);
  const sub = hw.submission;
  const locked = Boolean(sub && sub.status !== "submitted") || hw.status === "closed";
  const tasks = hw.tasks.length ? hw.tasks : [{ id: "answer", prompt: hw.instructions || hw.description || hw.title, marks: hw.totalMarks }];

  async function onSubmit() {
    if (tasks.some((task) => !answers[task.id]?.trim())) {
      toast.error("Answer every task before submitting.");
      return;
    }
    setBusy(true);
    try {
      await submitHomework(hw.id, answers);
      toast.success(t(lang, "submitted"));
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = !sub ? t(lang, "notSubmitted") : sub.status === "submitted" ? t(lang, "submitted") : t(lang, "graded");

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{hw.topic}</p>
          <h3 className="font-semibold">{hw.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground"><Due at={hw.dueAt} /> · {hw.totalMarks} {t(lang, "marks")}</p>
        </div>
        <span
          className={
            !sub
              ? "rounded-full bg-alert-soft px-2.5 py-1 text-xs font-semibold text-alert-foreground"
              : sub.status === "graded"
                ? "rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-foreground"
                : "rounded-full bg-sky-soft px-2.5 py-1 text-xs font-semibold text-sky"
          }
        >
          {statusLabel}
        </span>
      </div>
      {hw.description && <p className="mt-3 text-sm text-muted-foreground">{hw.description}</p>}
      {hw.attachmentName && <p className="mt-2 text-xs text-muted-foreground">📎 {hw.attachmentName}</p>}
      {sub?.released && sub.marks != null && (
        <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-foreground">
          <b className="font-display text-lg tabular-nums">
            {sub.marks}/{hw.totalMarks}
          </b>
          {sub.feedback ? ` · ${sub.feedback}` : ""}
        </p>
      )}
      {sub && !sub.released && sub.status === "graded" && <p className="mt-3 text-xs text-muted-foreground">{t(lang, "awaitingRelease")}</p>}

      {!locked && (
        <Button className="mt-4" size="sm" variant={open ? "ghost" : "default"} onClick={() => setOpen((o) => !o)}>
          {sub ? t(lang, "resubmit") : t(lang, "submitHw")}
        </Button>
      )}

      {open && !locked && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {hw.instructions && <p className="text-sm">{hw.instructions}</p>}
          {tasks.map((task, i) => (
            <div key={task.id} className="space-y-1.5">
              <Label htmlFor={`hw-${hw.id}-${task.id}`}>{i + 1}. {task.prompt} <span className="text-xs text-muted-foreground">({task.marks} {t(lang, "marks")})</span></Label>
              <Textarea
                id={`hw-${hw.id}-${task.id}`}
                rows={3}
                value={answers[task.id] ?? ""}
                placeholder={t(lang, "answerHere")}
                onChange={(e) => setAnswers((a) => ({ ...a, [task.id]: e.target.value }))}
                disabled={busy}
              />
            </div>
          ))}
          <Button onClick={() => void onSubmit()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {sub ? t(lang, "resubmit") : t(lang, "submitHw")}
          </Button>
        </div>
      )}
    </div>
  );
}

function QuizCard({ quiz, onSubmitted }: { quiz: MyQuiz; onSubmitted: () => void }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const totalMarks = quiz.questions.reduce((n, q) => n + q.marks, 0);
  const done = Boolean(quiz.attempt) || Boolean(result);

  async function onSubmit() {
    if (quiz.questions.some((q) => answers[q.id] === undefined || answers[q.id] === "")) {
      toast.error("Answer every question before submitting.");
      return;
    }
    setBusy(true);
    try {
      const r = await submitQuiz(quiz.id, answers);
      setResult(r);
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs capitalize text-muted-foreground">{quiz.kind} · {quiz.topic}</p>
          <h3 className="font-semibold">{quiz.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {quiz.questions.length} · {totalMarks} {t(lang, "marks")}{quiz.dueAt ? <> · <Due at={quiz.dueAt} /></> : null}
          </p>
        </div>
        {done ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{quiz.attempt?.released ? t(lang, "released") : t(lang, "submitted")}</span>
        ) : (
          <Button size="sm" variant={open ? "ghost" : "default"} onClick={() => setOpen((o) => !o)} disabled={quiz.status === "closed"}>{t(lang, "startQuiz")}</Button>
        )}
      </div>

      {(result || quiz.attempt) && (
        <div className="mt-3 rounded-lg border border-success/20 bg-success-soft/50 px-3 py-3 text-sm">
          {result ? (
            <>
              <p className="font-display text-2xl font-semibold tabular-nums text-success-foreground">
                {result.autoScore}/{result.autoTotal}
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{t(lang, "yourScore")}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t(lang, "awaitingRelease")}</p>
            </>
          ) : quiz.attempt?.released ? (
            <p className="text-xs text-muted-foreground">{t(lang, "grades")} →</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {quiz.attempt?.autoScore != null ? `${t(lang, "yourScore")}: ${quiz.attempt.autoScore}. ` : ""}
              {t(lang, "awaitingRelease")}
            </p>
          )}
        </div>
      )}

      {open && !done && (
        <div className="mt-4 space-y-5 border-t pt-4">
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id} className="space-y-2">
              <legend className="text-sm font-medium">{i + 1}. {q.prompt} <span className="text-xs text-muted-foreground">({q.marks} {t(lang, "marks")})</span></legend>
              {q.type === "multiple_choice" ? (
                <RadioGroup
                  value={answers[q.id] !== undefined ? String(answers[q.id]) : ""}
                  onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id]: Number(v) }))}
                  disabled={busy}
                >
                  {(q.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem id={`${q.id}-${oi}`} value={String(oi)} />
                      <Label htmlFor={`${q.id}-${oi}`} className="font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <Textarea rows={2} value={String(answers[q.id] ?? "")} placeholder={t(lang, "answerHere")} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} disabled={busy} />
              )}
            </fieldset>
          ))}
          <Button onClick={() => void onSubmit()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t(lang, "submitQuiz")}
          </Button>
        </div>
      )}

      {result && (
        <ul className="mt-3 space-y-1.5 text-sm" aria-label={t(lang, "yourScore")}>
          {quiz.questions
            .filter((q) => q.id in result.correct)
            .map((q, i) => (
              <li
                key={q.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                  result.correct[q.id] ? "bg-success-soft/60" : "bg-destructive/5"
                }`}
              >
                {result.correct[q.id] ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label={t(lang, "correct")} />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-label={t(lang, "incorrect")} />
                )}
                <span className="truncate text-start">{i + 1}. {q.prompt}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
