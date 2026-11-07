import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, Clock, Eye, Languages, Lightbulb, Loader2, LogOut, Send, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/common";
import { LanguageSwitcher } from "@/components/student/LanguageSwitcher";
import { ActivityFrame } from "@/components/activity/ActivityFrame";
import { CheckQuiz } from "@/components/activity/CheckQuiz";
import { useLanguage } from "@/context/LanguageContext";
import { StudentAuthProvider, useStudentAuth } from "@/context/StudentAuthContext";
import {
  answerForLang,
  answerNeedsTranslate,
  ensureLessonTranslation,
  generateExplanation,
  submitQuestion,
  translateAnswer,
} from "@/api";
import { useSessionPoll } from "@/hooks/use-session-poll";
import { t, type ExplanationLevel } from "@/i18n";
import { getMyQuestionIds, setStudentId, useAppState, useStudentId } from "@/lib/store";
import { setUnderstandingSignal, useMySignal } from "@/lib/understandingStore";
import type { UnderstandingSignal } from "@/types/teacherPortal";
import type { Activity, StudentQuestion } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/classroom")({
  head: () => ({
    meta: [
      { title: "Classroom — ClassBridge" },
      { name: "description", content: "Follow the lesson in your language and ask private questions." },
      { property: "og:title", content: "Classroom — ClassBridge" },
      { property: "og:description", content: "Follow the lesson in your language and ask private questions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClassroomRoute,
});

/** Live lessons are for signed-in, enrolled students only (they join from their course page). */
function ClassroomRoute() {
  return (
    <StudentAuthProvider>
      <ClassroomGate />
    </StudentAuthProvider>
  );
}

function ClassroomGate() {
  const { student, loading } = useStudentAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !student) void navigate({ to: "/student/login" });
  }, [loading, student, navigate]);
  if (loading || !student) {
    return <ClassroomLoading />;
  }
  return <Classroom />;
}

function ClassroomLoading() {
  const { lang } = useLanguage();
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">{t(lang, "checkingSignIn")}</div>
  );
}

const MAX = 500;

function Classroom() {
  const { lang } = useLanguage();
  const state = useAppState();
  const studentId = useStudentId();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);
  useSessionPoll(4000, Boolean(studentId && state.session.id));
  const student = state.students.find((s) => s.id === studentId);

  // Instant switch from notesLocalized; only fetch AI if this lang is missing
  useEffect(() => {
    if (!state.session.id || !state.session.notes) return;
    if (state.session.notesLocalized?.[lang]) {
      setTranslating(false);
      setTranslateError(null);
      return;
    }
    let cancelled = false;
    setTranslating(true);
    setTranslateError(null);
    ensureLessonTranslation(lang)
      .catch((err) => {
        if (!cancelled) setTranslateError(err instanceof Error ? err.message : "Translation failed");
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, state.session.id, state.session.notes, state.session.notesLocalized]);

  if (!hydrated) return <div className="mx-auto max-w-6xl space-y-4 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!student) {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div className="surface max-w-sm p-8">
          <BookOpen className="mx-auto h-6 w-6 text-primary" />
          <h1 className="mt-3 font-display text-xl font-semibold">{t(lang, "noLiveLessonTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(lang, "noLiveLessonBody")}</p>
          <Button asChild className="mt-5"><Link to="/student">{t(lang, "myCourses")}</Link></Button>
        </div>
      </div>
    );
  }

  const localizedNotes =
    state.session.notesLocalized?.[lang] ??
    state.session.notesLocalized?.["en"] ??
    state.session.notes;
  const hasLessonContent = Boolean(localizedNotes?.trim());
  const myIds = new Set(getMyQuestionIds());
  const mine = state.questions
    .filter((q) => q.studentId === student.id || myIds.has(q.id))
    .sort((a, b) => b.createdAt - a.createdAt);
  const shared = state.activities.filter((a) => a.shared);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Logo />
          {state.session.status === "live" && <span className="hidden items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success sm:flex"><span className="live-dot" />{t(lang, "live")}</span>}
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{t(lang, "hello")}, {student.name}</span>
            <LanguageSwitcher />
            <Button variant="ghost" size="icon" aria-label={t(lang, "leave")} onClick={() => { setStudentId(null); navigate({ to: "/student" }); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <article className="surface p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{t(lang, "lesson")} · {state.session.subject}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold">{state.session.title}</h1>
            {translating && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-alert-soft px-2.5 py-1 text-sm font-medium text-alert-foreground" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t(lang, "translating")}
              </p>
            )}
            {translateError && (
              <p className="mt-3 text-sm font-medium text-destructive" role="alert">{translateError}</p>
            )}
            <div className="mt-6 max-w-prose space-y-4 text-[17px] leading-relaxed text-start" dir="auto">
              {hasLessonContent ? (
                <p className="whitespace-pre-wrap">{localizedNotes}</p>
              ) : (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t(lang, "noLessonContent")}
                </p>
              )}
            </div>
          </article>

          <ExplanationPanel hasNotes={hasLessonContent} />

          <section className="surface p-6" aria-labelledby="act-h">
            <h2 id="act-h" className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-ai" aria-hidden /> {t(lang, "sharedActivity")}</h2>
            {shared.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t(lang, "noActivity")}</p>
            ) : (
              <div className="mt-5 space-y-10">
                {shared.map((a) => (
                  <div key={a.id + lang} className="feed-in rounded-xl border border-ai/25 bg-ai-soft/30 p-4 ring-2 ring-ai/10">
                    <SharedActivityBlock activity={a} lang={lang} studentId={student.id} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
          <UnderstandingCheck sessionId={state.session.id} studentId={student.id} />
          <QuestionComposer studentId={student.id} studentName={student.name} />
          <section className="surface p-6">
            <h2 className="font-semibold">{t(lang, "yourQuestions")}</h2>
            {mine.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">{t(lang, "noQuestions")}</p> : (
              <ul className="mt-3 space-y-3">
                {mine.map((q) => (
                  <li key={q.id} className="feed-in rounded-lg border p-3">
                    <p className="whitespace-pre-wrap text-sm text-start" dir="auto">{q.text}</p>
                    <p className={cn(
                      "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      q.status === "answered" ? "bg-success-soft text-success-foreground" : q.status === "analyzed" ? "bg-sky-soft text-sky" : "bg-alert-soft text-alert-foreground",
                    )}>
                      {q.status === "answered" ? <><CheckCircle2 className="h-3 w-3" aria-hidden />{t(lang, "answered")}</> : q.status === "analyzed" ? <><Eye className="h-3 w-3" aria-hidden />{t(lang, "seen")}</> : <><Clock className="h-3 w-3" aria-hidden />{t(lang, "pending")}</>}
                    </p>
                    <QuestionAnswer q={q} lang={lang} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

function QuestionAnswer({ q, lang }: { q: StudentQuestion; lang: string }) {
  const [busy, setBusy] = useState(false);
  const text = answerForLang(q, lang);
  if (!text) return null;
  const needs = answerNeedsTranslate(q, lang);

  return (
    <div className="mt-2 rounded-lg border border-ai/20 bg-ai-soft p-2.5">
      <span className="ai-label mb-1.5">
        <Sparkles className="h-3 w-3" aria-hidden />
        {t(lang, "aiSuggestion")}
      </span>
      <p className="text-sm leading-relaxed text-ai-foreground text-start" dir="auto">{needs ? (q.answer ?? "") : (text ?? "")}</p>
      {needs && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2 h-7 px-2 text-xs text-ai-foreground"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await translateAnswer(q.id, lang);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : t(lang, "error"));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          {t(lang, "translateAnswer")}
        </Button>
      )}
    </div>
  );
}

function SharedActivityBlock({ activity, lang, studentId }: { activity: Activity; lang: string; studentId: string }) {
  const { checks, checkResponses } = useAppState();
  const mid = activity.misconception_id;
  const pre = mid ? checks.find((c) => c.misconception_id === mid && c.phase === "pre") : undefined;
  const post = mid ? checks.find((c) => c.misconception_id === mid && c.phase === "post") : undefined;
  const preAns = pre ? checkResponses.find((r) => r.check_id === pre.id && r.student_id === studentId) : undefined;
  const postAns = post ? checkResponses.find((r) => r.check_id === post.id && r.student_id === studentId) : undefined;
  const [preDone, setPreDone] = useState(Boolean(preAns));

  return (
    <div className="space-y-4">
      {pre && (
        <CheckQuiz
          check={pre}
          lang={lang}
          studentId={studentId}
          alreadySelected={preAns?.selected_index ?? null}
          onDone={() => setPreDone(true)}
        />
      )}
      {(!pre || preDone || preAns) && (
        <ActivityFrame activity={activity} lang={lang} />
      )}
      {(preDone || preAns || !pre) && post && (
        <CheckQuiz
          check={post}
          lang={lang}
          studentId={studentId}
          alreadySelected={postAns?.selected_index ?? null}
        />
      )}
    </div>
  );
}

function UnderstandingCheck({ sessionId, studentId }: { sessionId: string; studentId: string }) {
  const { lang } = useLanguage();
  const current = useMySignal(sessionId, studentId);
  const options: { id: UnderstandingSignal; labelKey: "understand" | "needExample" | "confused" }[] = [
    { id: "understand", labelKey: "understand" },
    { id: "example", labelKey: "needExample" },
    { id: "confused", labelKey: "confused" },
  ];
  return (
    <section className="surface p-5">
      <h2 className="text-sm font-semibold">{t(lang, "howDoing")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t(lang, "onlyTeacherSees")}</p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              setUnderstandingSignal(sessionId, studentId, o.id);
              toast.success(t(lang, "signalSent"));
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-start text-sm transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current === o.id && "border-primary bg-primary-soft",
            )}
          >
            {t(lang, o.labelKey)}
          </button>
        ))}
      </div>
    </section>
  );
}

function QuestionComposer({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { lang } = useLanguage();
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const len = text.length;
  const valid = text.trim().length > 0 && len <= MAX;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await submitQuestion({
        studentId,
        studentName,
        text,
        isAnonymous: anonymous,
        language: lang,
      });
      setText("");
      toast.success("✓");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="surface border-primary/20 p-6 shadow-lift ring-1 ring-primary/10">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Lightbulb className="h-4 w-4 text-alert" aria-hidden /> {t(lang, "askPrivately")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t(lang, "askHint")}</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={t(lang, "placeholder")} aria-label={t(lang, "askPrivately")}
        className="mt-4 resize-none text-[15px]" spellCheck={false} autoCorrect="off" dir="auto" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e); }} />
      <div className="mt-3 flex items-center gap-2">
        <Checkbox id="anon" checked={anonymous} onCheckedChange={(v) => setAnonymous(v === true)} />
        <Label htmlFor="anon" className="text-sm font-normal text-muted-foreground">{t(lang, "askAnonymously")}</Label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={cn("text-xs tabular-nums", len > MAX ? "text-destructive" : "text-muted-foreground")}>{len}/{MAX} {t(lang, "chars")}</span>
        <Button type="submit" disabled={!valid || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t(lang, "submit")}</Button>
      </div>
    </form>
  );
}

function ExplanationPanel({ hasNotes }: { hasNotes: boolean }) {
  const { lang } = useLanguage();
  const { session } = useAppState();
  const [level, setLevel] = useState<ExplanationLevel>("standard");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(hasNotes ? "loading" : "idle");
  const [lines, setLines] = useState<string[]>([]);
  // Cache explain-simpler results per lang+level so language switching feels instant
  const cacheRef = useState(() => new Map<string, string[]>())[0];

  const load = useCallback(async (lv: ExplanationLevel) => {
    if (!hasNotes) {
      setLines([]);
      setStatus("idle");
      return;
    }
    const key = `${lang}:${lv}`;
    const hit = cacheRef.get(key);
    if (hit) {
      setLines(hit);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    try {
      const next = await generateExplanation({ lang, level: lv });
      cacheRef.set(key, next);
      setLines(next);
      setStatus("ready");
    } catch { setStatus("error"); }
  }, [lang, cacheRef, hasNotes]);

  useEffect(() => { void load(level); }, [level, load, session.notesLocalized?.[lang]]);

  return (
    <section className="surface overflow-hidden" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ai/15 bg-ai-soft/50 px-6 py-4">
        <h2 className="flex items-center gap-2 font-semibold"><Wand2 className="h-4 w-4 text-ai" aria-hidden /> {t(lang, "explanation")}</h2>
        <span className="ai-label"><Sparkles className="h-3 w-3" aria-hidden />{t(lang, "aiSuggestion")}</span>
      </div>
      <div className="min-h-[160px] p-6">
        {status === "idle" && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t(lang, "noExplanation")}</p>
        )}
        {status === "loading" && <div className="space-y-3" aria-label={t(lang, "loading")}><Skeleton className="h-4 w-11/12" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /><p className="pt-1 text-xs text-muted-foreground">{t(lang, "loading")}</p></div>}
        {status === "error" && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{t(lang, "error")}</span>
            <Button size="sm" variant="outline" onClick={() => load(level)}>{t(lang, "retry")}</Button>
          </div>
        )}
        {status === "ready" && (
          <ol className="space-y-3">
            {lines.map((l, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sky-soft text-xs font-semibold text-sky">{i + 1}</span>
                <span>{l.split(/(\d+\/\d+)/).map((part, j) => /\d+\/\d+/.test(part) ? <span key={j} className="rounded bg-muted px-1 font-mono font-semibold">{part}</span> : part)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {hasNotes && (
        <div className="flex flex-wrap gap-2 border-t px-6 py-4">
          {(["standard", "simple", "example"] as const).map((lv) => (
            <Button key={lv} size="sm" variant={level === lv ? "default" : "outline"} onClick={() => (level === lv ? load(lv) : setLevel(lv))}>
              {lv === "standard" ? t(lang, "explainSimply") : lv === "simple" ? t(lang, "moreSimply") : t(lang, "example")}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
