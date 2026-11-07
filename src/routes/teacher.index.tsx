import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  MessageSquareText,
  Plus,
  Presentation,
  Radar,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { LangChip, StatCard } from "@/components/common";
import { RadarVisual } from "@/components/radar/MisconceptionCard";
import { TranslatedQuestion } from "@/components/radar/TranslatedQuestion";
import { useTeacherAuth } from "@/context/TeacherAuthContext";
import { useAppState } from "@/lib/store";
import { getDashboardAssessmentSummary, listHomework, listTopicPerformance } from "@/services/teacherPortalData";
import type { DashboardSummary, HomeworkAssignment, TopicPerformance } from "@/types/teacherPortal";

export const Route = createFileRoute("/teacher/")({
  head: () => ({
    meta: [
      { title: "Teacher Overview — ClassBridge" },
      { name: "description", content: "Classroom overview: students, sessions, homework, quizzes, and misconceptions." },
      { property: "og:title", content: "Teacher Overview — ClassBridge" },
      { property: "og:description", content: "Classroom overview: students, sessions, homework, quizzes, and misconceptions." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { teacher } = useTeacherAuth();
  const { session, students, questions, misconceptions } = useAppState();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [homework, setHomework] = useState<HomeworkAssignment[]>([]);
  const [topics, setTopics] = useState<TopicPerformance[]>([]);

  useEffect(() => {
    void getDashboardAssessmentSummary(students.length).then(setSummary).catch(() => setSummary(null));
    void listHomework().then(setHomework).catch(() => setHomework([]));
    void listTopicPerformance().then(setTopics).catch(() => setTopics([]));
  }, [students.length, questions.length, misconceptions.length]);

  const recent = [...questions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const upcoming = [...homework]
    .filter((h) => h.status === "published")
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
    .slice(0, 3);
  const strong = topics.filter((t) => t.strength === "strong");
  const attention = topics.filter((t) => t.strength === "attention");
  const firstName = teacher?.fullName?.split(/\s+/)[0] ?? "there";

  const questionTimeline = useMemo(() => {
    if (!questions.length) return [{ t: "start", questions: 0 }];
    const sorted = [...questions].sort((a, b) => a.createdAt - b.createdAt);
    const t0 = session.startedAt ?? sorted[0]!.createdAt;
    const points: { t: string; questions: number }[] = [{ t: "0′", questions: 0 }];
    sorted.forEach((q, i) => {
      const mins = Math.max(0, Math.round((q.createdAt - t0) / 60000));
      points.push({ t: `${mins}′`, questions: i + 1 });
    });
    return points;
  }, [questions, session.startedAt]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Good morning, {firstName}</p>
          <h1 className="font-display text-3xl font-semibold">Here's your classroom today</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/teacher/homework">
              <ClipboardList className="h-4 w-4" /> Assignment
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/teacher/quizzes">
              <BookOpenCheck className="h-4 w-4" /> Quiz
            </Link>
          </Button>
          <Button asChild>
            <Link to="/teacher/sessions">
              <Plus className="h-4 w-4" /> Session
            </Link>
          </Button>
        </div>
      </div>

      <div className="surface relative overflow-hidden p-6">
        <div className="dot-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,black,transparent_60%)]" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              {session.status === "live" ? (
                <>
                  <span className="live-dot" /> Live now
                </>
              ) : (
                <span className="text-muted-foreground">Session {session.status}</span>
              )}
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold">{session.title}</h2>
            <p className="text-muted-foreground">{session.subject}</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Join code</p>
              <p className="font-mono text-2xl font-semibold tracking-[0.2em]">{session.joinCode}</p>
            </div>
            <Button asChild variant="outline" className="bg-card">
              <Link to="/teacher/live">
                Open session <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Students joined" value={students.length} icon={Users} tone="sky" />
        <StatCard label="Active classes" value={summary?.activeClasses ?? 0} icon={Presentation} />
        <StatCard label="Homework assigned" value={summary?.homeworkAssigned ?? 0} icon={ClipboardList} />
        <StatCard label="Pending submissions" value={summary?.pendingSubmissions ?? 0} icon={MessageSquareText} tone="alert" />
        <StatCard label="Avg quiz score" value={summary?.averageQuizPerformance != null ? `${summary.averageQuizPerformance}%` : "—"} icon={BookOpenCheck} />
        <StatCard label="Topics needing support" value={summary?.studentsNeedingSupport ?? 0} icon={AlertTriangle} tone="alert" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="surface p-6">
          <h3 className="font-semibold">Questions this session</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={questionTimeline} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="qg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="1" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="t" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }} />
                <Area type="monotone" dataKey="questions" stroke="var(--primary)" strokeWidth={2} fill="url(#qg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <Link to="/teacher/radar" className="surface group flex flex-col p-6 transition-shadow hover:shadow-lift">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <Radar className="h-4 w-4 text-primary" /> Live radar
            </h3>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
          <div className="mx-auto mt-2 aspect-square w-full max-w-[220px]">
            <RadarVisual items={misconceptions.map((m) => ({ label: m.id, value: m.questionIds.length, severity: m.severity }))} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{misconceptions[0]?.title ?? "No misconceptions yet"}</p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-6">
          <h3 className="font-semibold">Upcoming homework</h3>
          <ul className="mt-4 divide-y">
            {upcoming.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">{h.title}</p>
                  <p className="text-xs text-muted-foreground">{h.topic}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">Due {new Date(h.dueAt).toLocaleDateString()}</span>
              </li>
            ))}
            {upcoming.length === 0 && <li className="py-4 text-sm text-muted-foreground">No upcoming assignments.</li>}
          </ul>
          <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
            <Link to="/teacher/homework">Manage homework</Link>
          </Button>
        </div>
        <div className="surface p-6">
          <h3 className="font-semibold">Topics snapshot</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-success">Performing well</p>
              <ul className="mt-2 space-y-2 text-sm">
                {strong.map((t) => (
                  <li key={t.topic} className="rounded-lg bg-success-soft/50 px-3 py-2">
                    {t.topic}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.correct}/{t.total} correct
                    </span>
                  </li>
                ))}
                {strong.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-alert-foreground">Needs attention</p>
              <ul className="mt-2 space-y-2 text-sm">
                {attention.map((t) => (
                  <li key={t.topic} className="rounded-lg bg-alert-soft/50 px-3 py-2">
                    {t.topic}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.correct}/{t.total} correct
                    </span>
                  </li>
                ))}
                {attention.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="surface p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent student questions</h3>
          <Link to="/teacher/live" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <ul className="mt-4 divide-y">
          {recent.map((q) => {
            const name = q.studentName?.trim() || "Student";
            return (
            <li key={q.id} className="flex items-start gap-3 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">{name.slice(0, 2)}</span>
              <div className="min-w-0 flex-1">
                <TranslatedQuestion q={q} />
                <p className="mt-1 text-xs text-muted-foreground">{name}</p>
              </div>
              <LangChip lang={q.detectedLanguage} />
            </li>
            );
          })}
          {recent.length === 0 && <li className="py-6 text-sm text-muted-foreground">No questions in this session yet.</li>}
        </ul>
      </div>
    </div>
  );
}
