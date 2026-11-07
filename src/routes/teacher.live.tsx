import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Hourglass, Inbox, Lightbulb, Radar, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, LangChip, timeAgo } from "@/components/common";
import { AnalysisControls } from "@/components/radar/AnalysisControls";
import { MisconceptionCard, RadarVisual } from "@/components/radar/MisconceptionCard";
import { TranslatedQuestion } from "@/components/radar/TranslatedQuestion";
import { useMisconceptionAnalysis } from "@/hooks/use-misconception-analysis";
import { useAppState } from "@/lib/store";
import { UnderstandingPanel } from "@/components/teacher/UnderstandingPanel";
import { useSessionSignalCounts } from "@/lib/understandingStore";
import { markAnswered } from "@/api";

export const Route = createFileRoute("/teacher/live")({
  head: () => ({
    meta: [
      { title: "Live Session — ClassBridge" },
      { name: "description", content: "Incoming student questions and the live Misconception Radar." },
      { property: "og:title", content: "Live Session — ClassBridge" },
      { property: "og:description", content: "Incoming student questions and the live Misconception Radar." },
    ],
  }),
  component: Live,
});

function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(i);
  }, []);
  return now;
}

function Live() {
  const { session, students, questions, misconceptions } = useAppState();
  const { status, error, reanalyze, analyzing } = useMisconceptionAnalysis(Boolean(session.id));
  const now = useNow();
  const pending = questions.filter((q) => q.status === "pending").sort((a, b) => b.createdAt - a.createdAt);
  const feed = [...questions].sort((a, b) => b.createdAt - a.createdAt);
  const analyzedCount = questions.filter((q) => q.misconceptionId).length;
  const signalCounts = useSessionSignalCounts(session.id);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const wasAnalyzing = useRef(false);

  useEffect(() => {
    if (wasAnalyzing.current && !analyzing && status !== "error") {
      setLastUpdated(Date.now());
    }
    wasAnalyzing.current = analyzing;
  }, [analyzing, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            {session.status === "live" ? (
              <>
                <span className="live-dot" /> <span className="text-success-foreground">Live session</span>
              </>
            ) : (
              <span className="text-muted-foreground capitalize">Session {session.status}</span>
            )}
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold">{session.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="surface flex items-center gap-3 px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground">Code</span>
            <span className="font-mono text-lg font-semibold tracking-[0.2em]">{session.joinCode}</span>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              aria-label="Copy join code"
              onClick={() => {
                navigator.clipboard?.writeText(session.joinCode);
                toast.success("Copied");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="surface flex items-center gap-2 px-4 py-2.5 text-sm">
            <Users className="h-4 w-4 text-sky" aria-hidden />
            <b className="font-display text-lg tabular-nums">{students.length}</b>
            <span className="text-muted-foreground">joined</span>
          </div>
        </div>
      </div>

      <UnderstandingPanel counts={signalCounts} totalStudents={students.length} />

      <section className="surface overflow-hidden" aria-labelledby="radar-h" aria-live="polite">
        <div className="grid lg:grid-cols-[300px_1fr]">
          <div className="border-b bg-foreground p-6 text-background lg:border-b-0 lg:border-e">
            <h2 id="radar-h" className="flex items-center gap-2 font-semibold">
              <Radar className="h-4 w-4" aria-hidden /> Misconception Radar
            </h2>
            <p className="mt-1 text-sm opacity-70">Questions grouped by the idea behind them, across languages.</p>
            <div className="mx-auto mt-4 aspect-square max-w-[240px] rounded-full bg-background p-2">
              <RadarVisual items={misconceptions.map((m) => ({ label: m.id, value: m.questionIds.length, severity: m.severity }))} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="opacity-60">Grouped</dt>
                <dd className="font-display text-2xl tabular-nums">{analyzedCount}</dd>
              </div>
              <div>
                <dt className="opacity-60">Pending</dt>
                <dd className="font-display text-2xl tabular-nums">{pending.length}</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">Detected misconceptions</p>
              <AnalysisControls status={status} error={error} onReanalyze={reanalyze} lastUpdated={lastUpdated} />
            </div>
            {analyzing && misconceptions.length === 0 ? (
              <EmptyState icon={Radar} title="Analysing…" body="Grouping questions by underlying misunderstanding." />
            ) : misconceptions.length === 0 ? (
              <EmptyState
                icon={Radar}
                title="Nothing detected yet"
                body="Need at least 2 related questions. New questions trigger analysis automatically (max every 20s)."
              />
            ) : (
              misconceptions.map((m, i) => (
                <MisconceptionCard key={m.id} m={m} questions={questions} total={questions.length} defaultOpen={i === 0} />
              ))
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-6" aria-labelledby="pending-h">
          <div className="flex items-center justify-between gap-2">
            <h2 id="pending-h" className="flex items-center gap-2 font-semibold">
              <Hourglass className="h-4 w-4 text-alert" aria-hidden /> Pending / unclustered
            </h2>
            <span className="rounded-full bg-alert-soft px-2.5 py-0.5 text-xs font-semibold text-alert-foreground tabular-nums">
              {pending.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Questions not yet clustered — click Analyze questions or wait for auto-analysis.
          </p>
          <ul className="mt-4 space-y-2" aria-live="polite">
            {pending.length === 0 && <EmptyState icon={Check} title="All caught up" body="No questions are waiting." />}
            {pending.map((q) => (
              <li key={q.id} className="feed-in flex items-start gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <TranslatedQuestion q={q} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {q.isAnonymous ? "Anonymous" : q.studentName} · {now ? timeAgo(q.createdAt, now) : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    markAnswered(q.id)
                      .then(() => toast.success("Marked as answered"))
                      .catch((e: Error) => toast.error(e.message))
                  }
                >
                  Answered
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface p-6" aria-labelledby="feed-h">
          <h2 id="feed-h" className="flex items-center gap-2 font-semibold">
            <Inbox className="h-4 w-4 text-primary" aria-hidden /> Incoming questions
          </h2>
          <ul className="mt-4 max-h-[420px] space-y-1 overflow-y-auto pe-1" aria-live="polite">
            {feed.length === 0 && (
              <li>
                <EmptyState icon={Inbox} title="Waiting for questions" body="Student questions appear here as they ask." />
              </li>
            )}
            {feed.map((q) => {
              const label = q.isAnonymous ? "Anonymous" : q.studentName;
              return (
                <li key={q.id} className="feed-in flex items-start gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-muted">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-semibold text-accent-foreground">
                    {label.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <TranslatedQuestion q={q} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {label}
                      {q.status === "answered" && " · answered"}
                      {q.status === "analyzed" && " · clustered"}
                      {q.isRomanized ? " · romanized" : ""}
                    </p>
                    {q.answer && (
                      <div className="mt-2 rounded-lg border border-ai/20 bg-ai-soft px-2.5 py-2">
                        <span className="ai-label mb-1">
                          <Sparkles className="h-3 w-3" aria-hidden />
                          AI suggestion
                        </span>
                        <p className="text-xs leading-relaxed text-ai-foreground">{q.answer}</p>
                      </div>
                    )}
                  </div>
                  <LangChip lang={q.detectedLanguage} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="surface p-6" aria-labelledby="intervene-h">
        <h2 id="intervene-h" className="flex items-center gap-2 font-semibold">
          <Lightbulb className="h-4 w-4 text-ai" aria-hidden /> Suggested teaching interventions
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {misconceptions.map((m) => (
            <div key={m.id} className="rounded-xl border border-ai/20 bg-ai-soft/60 p-4">
              <span className="ai-label mb-2">
                <Sparkles className="h-3 w-3" aria-hidden />
                AI suggestion — review before sharing
              </span>
              <p className="text-xs font-semibold text-ai-foreground">{m.title}</p>
              <p className="mt-2 text-sm leading-relaxed">{m.intervention}</p>
            </div>
          ))}
          {misconceptions.length === 0 && (
            <p className="text-sm text-muted-foreground md:col-span-3">
              Interventions appear after analysis finds shared misconceptions.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
