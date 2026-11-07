import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Radar } from "lucide-react";
import { EmptyState } from "@/components/common";
import { AnalysisControls } from "@/components/radar/AnalysisControls";
import { MisconceptionCard, RadarVisual } from "@/components/radar/MisconceptionCard";
import { Button } from "@/components/ui/button";
import { useMisconceptionAnalysis } from "@/hooks/use-misconception-analysis";
import { useAppState } from "@/lib/store";
import { listAssessmentInsights, listClasses, listTopicPerformance } from "@/services/teacherPortalData";
import type { MisconceptionInsight, SchoolClass, TopicPerformance } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/radar")({
  head: () => ({
    meta: [
      { title: "Misconception Radar — ClassBridge" },
      { name: "description", content: "Live session and assessment misconceptions across languages." },
      { property: "og:title", content: "Misconception Radar — ClassBridge" },
      { property: "og:description", content: "Live session and assessment misconceptions across languages." },
    ],
  }),
  component: RadarPage,
});

function RadarPage() {
  const { session, questions, misconceptions } = useAppState();
  const { status, error, reanalyze, analyzing } = useMisconceptionAnalysis(Boolean(session.id));
  const [insights, setInsights] = useState<MisconceptionInsight[]>([]);
  const [topics, setTopics] = useState<TopicPerformance[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("all");
  const [source, setSource] = useState("all");

  useEffect(() => {
    void listAssessmentInsights().then(setInsights);
    void listTopicPerformance().then(setTopics);
    void listClasses().then(setClasses);
  }, []);

  const filteredInsights = useMemo(() => {
    return insights.filter((i) => {
      if (classId !== "all" && i.classId && i.classId !== classId) return false;
      if (source !== "all" && i.source !== source) return false;
      return true;
    });
  }, [insights, classId, source]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Misconception Radar</h1>
          <p className="text-muted-foreground">Live classroom clusters plus assessment insights from your quizzes.</p>
        </div>
        <AnalysisControls status={status} error={error} onReanalyze={reanalyze} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Live session</h2>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="surface h-fit p-5">
            <div className="aspect-square">
              <RadarVisual items={misconceptions.map((m) => ({ label: m.id, value: m.questionIds.length, severity: m.severity }))} />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-alert" /> High frequency
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky" /> Emerging
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Isolated
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            {analyzing && misconceptions.length === 0 ? (
              <EmptyState icon={Radar} title="Analyzing…" body="Grouping questions by shared conceptual misunderstanding." />
            ) : misconceptions.length === 0 ? (
              <EmptyState icon={Radar} title="No live misconceptions yet" body="Results appear when at least two questions share an underlying idea." />
            ) : (
              misconceptions.map((m) => <MisconceptionCard key={m.id} m={m} questions={questions} total={questions.length} />)
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Homework & quiz insights</h2>
          <p className="text-sm text-muted-foreground">Built from graded quiz attempts — empty until students submit work.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            <option value="homework">Homework</option>
            <option value="quiz">Quiz</option>
            <option value="test">Test</option>
            <option value="live_session">Live session</option>
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface p-5">
            <h3 className="text-sm font-semibold text-alert-foreground">Needs attention</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {topics
                .filter((t) => t.strength === "attention")
                .map((t) => (
                  <li key={t.topic} className="rounded-lg bg-alert-soft/50 px-3 py-2">
                    <p className="font-medium">{t.topic}</p>
                    <p className="text-xs text-muted-foreground">{t.evidence}</p>
                  </li>
                ))}
              {topics.filter((t) => t.strength === "attention").length === 0 && (
                <li className="text-muted-foreground">No weak topics yet.</li>
              )}
            </ul>
          </div>
          <div className="surface p-5">
            <h3 className="text-sm font-semibold text-success">Performing well</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {topics
                .filter((t) => t.strength === "strong")
                .map((t) => (
                  <li key={t.topic} className="rounded-lg bg-success-soft/50 px-3 py-2">
                    <p className="font-medium">{t.topic}</p>
                    <p className="text-xs text-muted-foreground">{t.evidence}</p>
                  </li>
                ))}
              {topics.filter((t) => t.strength === "strong").length === 0 && (
                <li className="text-muted-foreground">No strong topics yet.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          {filteredInsights.map((ins) => (
            <article key={ins.id} className="surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{ins.title}</h3>
                {ins.aiInterpretation && <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">AI interpretation</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {ins.topic} · {ins.source.replace("_", " ")} · {ins.affected}/{ins.total} responses
              </p>
              <p className="mt-3 text-sm">{ins.explanation}</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                {ins.evidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm">
                <span className="font-medium">Recommended:</span> {ins.recommendedAction}
              </p>
            </article>
          ))}
          {filteredInsights.length === 0 && <p className="text-sm text-muted-foreground">No assessment insights for these filters.</p>}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void reanalyze()}>
          Refresh live analysis
        </Button>
      </section>
    </div>
  );
}
