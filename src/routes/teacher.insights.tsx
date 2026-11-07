import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, MessageSquareText, Send } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, StatCard } from "@/components/common";
import { checkStats } from "@/api";
import { useSessionPoll } from "@/hooks/use-session-poll";
import { useAppState } from "@/lib/store";

export const Route = createFileRoute("/teacher/insights")({
  head: () => ({
    meta: [
      { title: "Insights — ClassBridge" },
      { name: "description", content: "Questions, misconception categories, shared interventions and quiz results." },
      { property: "og:title", content: "Insights — ClassBridge" },
      { property: "og:description", content: "Questions, misconception categories, shared interventions and quiz results." },
    ],
  }),
  component: Insights,
});

const tip = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 };

function Insights() {
  const { session, questions, misconceptions, activities, checkResponses } = useAppState();
  useSessionPoll(4000, Boolean(session.id));
  const shared = activities.filter((a) => a.shared).length;
  const byMis = misconceptions.map((m) => ({ name: m.title.split(" ").slice(0, 3).join(" ") + "…", count: m.questionIds.length }));
  const langMap = new Map<string, number>();
  for (const q of questions) {
    const k = q.detectedLanguage || "unknown";
    langMap.set(k, (langMap.get(k) ?? 0) + 1);
  }
  const langCounts = [...langMap.entries()].map(([name, value]) => ({ name, value }));
  const colors = ["var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-3)", "var(--muted-foreground)"];

  const prePost = misconceptions.map((m) => {
    const s = checkStats(m.id);
    return { id: m.id, title: m.title, ...s };
  }).filter((r) => r.preN + r.postN > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Insights</h1>
        <p className="text-muted-foreground">What this session tells you so far.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Questions" value={questions.length} icon={MessageSquareText} />
        <StatCard label="Misconception categories" value={misconceptions.length} icon={AlertTriangle} tone="alert" />
        <StatCard label="Interventions shared" value={shared} icon={Send} tone="sky" />
        <StatCard label="Check responses" value={checkResponses.length} icon={ClipboardCheck} />
        <StatCard label="Activities" value={activities.length} icon={CheckCircle2} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-6">
          <h2 className="font-semibold">Questions per misconception</h2>
          <div className="mt-4 h-64">
            {byMis.length === 0 ? (
              <EmptyState icon={BarChart3} title="No clusters yet" body="Run analysis from the live radar." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMis} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tip} cursor={{ fill: "var(--muted)" }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="surface p-6">
          <h2 className="font-semibold">Question languages</h2>
          <div className="mt-4 grid h-64 grid-cols-[1fr_auto] items-center gap-4">
            {langCounts.length === 0 ? (
              <EmptyState icon={MessageSquareText} title="No questions yet" body="Languages appear as students ask." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={langCounts} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
                      {langCounts.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tip} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="space-y-2 text-sm">
                  {langCounts.map((d, i) => <li key={d.name} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i % colors.length] }} />{d.name} <b>{d.value}</b></li>)}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="surface p-6">
        <h2 className="font-semibold">Pre vs post check</h2>
        <p className="mt-1 text-sm text-muted-foreground">% correct before vs after the shared activity.</p>
        <div className="mt-4 space-y-3">
          {prePost.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="No check data yet" body="Generate a mini-lesson (creates pre/post checks), share it, and have students answer." />
          ) : (
            prePost.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <p className="font-medium">{r.title}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Pre</p>
                    <p className="font-display text-2xl font-semibold">{r.prePct === null ? "—" : `${r.prePct}%`}</p>
                    <p className="text-xs text-muted-foreground">{r.preN} answers</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Post</p>
                    <p className="font-display text-2xl font-semibold">{r.postPct === null ? "—" : `${r.postPct}%`}</p>
                    <p className="text-xs text-muted-foreground">{r.postN} answers</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
