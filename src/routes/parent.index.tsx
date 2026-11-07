import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  GraduationCap,
  Languages,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useParentAuth } from "@/context/ParentAuthContext";
import { pt } from "@/i18n/parent";
import { useParentLang } from "@/context/ParentLangContext";
import {
  getParentOverview,
  listLinkedChildren,
  translateParentTexts,
  type LinkedChild,
  type ParentAssignmentItem,
  type ParentOverview,
} from "@/services/parentPortalData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/parent/")({
  head: () => ({
    meta: [
      { title: "Parent Portal — ClassBridge" },
      { name: "description", content: "View your child's grades, homework and weak areas in your language." },
    ],
  }),
  component: ParentHome,
});

const KIND_STYLE: Record<string, string> = {
  homework: "bg-sky-soft text-sky",
  quiz: "bg-primary-soft text-primary-deep",
  test: "bg-alert-soft text-alert-foreground",
  project: "bg-success-soft text-success",
};

function kindLabel(lang: string, kind: string) {
  const key = kind === "quiz" || kind === "test" || kind === "project" || kind === "homework" ? kind : "homework";
  return pt(lang, key);
}

function fmtDate(lang: string, d: string) {
  try {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00`));
  } catch {
    return d;
  }
}

function gradeTone(pct: number) {
  return pct >= 80 ? "bg-success" : pct >= 60 ? "bg-alert" : "bg-tomato";
}

function fmtPoints(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ParentHome() {
  const { parent } = useParentAuth();
  const { lang } = useParentLang();
  const [children, setChildren] = useState<LinkedChild[]>([]);
  const [childId, setChildId] = useState<string>("");
  const [data, setData] = useState<ParentOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingKids, setLoadingKids] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingKids(true);
    listLinkedChildren()
      .then((kids) => {
        if (cancelled) return;
        setChildren(kids);
        setChildId((prev) => prev || kids[0]?.id || "");
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : pt(lang, "error"));
      })
      .finally(() => {
        if (!cancelled) setLoadingKids(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const load = useCallback(() => {
    if (!childId) return;
    setError(null);
    setData(null);
    getParentOverview(childId)
      .then(async (overview) => {
        if (lang === "en") {
          setData(overview);
          return;
        }
        const titles = overview.assignments.map((a) => a.title);
        const instructions = overview.assignments.map((a) => a.instructions || " ");
        const feedbacks = overview.assignments.map((a) => a.feedback || " ");
        const weakTitles = overview.weakAreas.map((w) => w.title);
        const weakDesc = overview.weakAreas.map((w) => w.description);
        const weakHelp = overview.weakAreas.map((w) => w.howToHelp);
        const [tTitles, tInstr, tFeed, tWeakT, tWeakD, tWeakH] = await Promise.all([
          translateParentTexts(lang, titles),
          translateParentTexts(lang, instructions),
          translateParentTexts(lang, feedbacks),
          translateParentTexts(lang, weakTitles),
          translateParentTexts(lang, weakDesc),
          translateParentTexts(lang, weakHelp),
        ]);
        setData({
          ...overview,
          assignments: overview.assignments.map((a, i) => ({
            ...a,
            title: tTitles[i] || a.title,
            instructions: a.instructions ? tInstr[i] || a.instructions : "",
            feedback: a.feedback ? tFeed[i] || a.feedback : "",
          })),
          weakAreas: overview.weakAreas.map((w, i) => ({
            ...w,
            title: tWeakT[i] || w.title,
            description: tWeakD[i] || w.description,
            howToHelp: tWeakH[i] || w.howToHelp,
          })),
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : pt(lang, "error")));
  }, [childId, lang]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadingKids) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!children.length) {
    return (
      <div className="mx-auto max-w-lg py-10">
        <div className="surface p-8 text-center shadow-lift">
          <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-semibold">{pt(lang, "hello")}, {parent?.fullName}</h1>
          <p className="mt-2 text-muted-foreground">{pt(lang, "noChildren")}</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <p className="text-destructive">{error}</p>
        <Button className="mt-4" variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4" /> {pt(lang, "retry")}
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const child = { child: data.childName };
  const kinds = Object.entries(data.gradeSummary).filter(([k, v]) => k !== "overall" && v !== null) as [string, number][];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-foreground via-foreground to-primary-deep p-7 text-background shadow-lift sm:p-9">
        <span className="glow -right-10 -top-20 h-64 w-64 bg-alert/40" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm text-background/75">
              <ShieldCheck className="h-4 w-4 text-success" />
              {pt(lang, "verified")}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              {pt(lang, "hello")}, {parent?.fullName}
            </h1>
            <p className="mt-1 text-lg text-background/80">{pt(lang, "headline", child)}</p>
          </div>
          <div className="space-y-2">
            {children.length > 1 && (
              <Select value={childId} onValueChange={setChildId}>
                <SelectTrigger className="h-10 min-w-[180px] border-background/30 bg-background/10 text-background">
                  <SelectValue placeholder={pt(lang, "selectChild")} />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="rounded-xl border border-background/20 bg-background/10 px-4 py-3 backdrop-blur">
              <p className="flex items-center gap-2 font-semibold">
                <BookOpen className="h-4 w-4" />
                {data.courses[0]?.name ?? "—"}
              </p>
              {data.courses[0]?.subject && <p className="text-sm text-background/70">{data.courses[0].subject}</p>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label={pt(lang, "statGrade")}
          value={data.stats.avgPercent == null ? "—" : `${Math.round(data.stats.avgPercent)}%`}
          icon={GraduationCap}
          tone="from-alert-soft/80 text-alert-foreground"
        />
        <Stat label={pt(lang, "assignmentsTitle")} value={data.stats.assignments} icon={ClipboardList} tone="from-sky-soft/80 text-sky" />
        <Stat label={pt(lang, "gradesTitle")} value={data.stats.graded} icon={CheckCircle2} tone="from-success-soft/80 text-success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <section className="surface p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <GraduationCap className="h-5 w-5 text-alert" />
              {pt(lang, "gradesTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "gradesSub")}</p>
            {data.assignments.filter((a) => a.score != null).length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noGrades")}</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.gradeSummary["overall"] != null && (
                    <span className="rounded-xl bg-foreground px-3 py-2 text-sm font-semibold text-background">
                      {pt(lang, "overall")} · {Math.round(data.gradeSummary["overall"])}%
                    </span>
                  )}
                  {kinds.map(([k, v]) => (
                    <span key={k} className={cn("rounded-xl px-3 py-2 text-sm font-semibold", KIND_STYLE[k])}>
                      {kindLabel(lang, k)} · {Math.round(v)}%
                    </span>
                  ))}
                </div>
                <ul className="mt-4 space-y-3">
                  {data.assignments
                    .filter((a) => a.score != null)
                    .map((a) => (
                      <li key={a.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 font-semibold">
                            <KindChip lang={lang} kind={a.kind} />
                            {a.title}
                          </p>
                          <p className="font-display text-xl font-semibold tabular-nums" dir="ltr">
                            {fmtPoints(a.score!)}
                            <span className="text-sm text-muted-foreground">/{fmtPoints(a.maxPoints)}</span>
                          </p>
                        </div>
                        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", gradeTone(a.percent ?? 0))} style={{ width: `${Math.min(100, a.percent ?? 0)}%` }} />
                        </div>
                        {a.feedback && (
                          <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                            <b className="font-medium">{pt(lang, "teacherFeedback")}:</b> {a.feedback}
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>

          <Assignments lang={lang} items={data.assignments} childName={data.childName} />
        </div>

        <div className="space-y-6">
          <section className="surface relative overflow-hidden bg-gradient-to-br from-alert-soft/80 to-card to-60% p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Lightbulb className="h-5 w-5 text-alert" />
              {pt(lang, "helpTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "helpSub", child)}</p>
            {data.weakAreas.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed bg-card/80 p-6 text-center text-sm text-muted-foreground">{pt(lang, "noMistakes")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-tomato">
                  <Target className="h-3.5 w-3.5" />
                  {pt(lang, "weakTitle", child)}
                </p>
                {data.weakAreas.map((w) => (
                  <li key={w.id} className="rounded-xl border-s-4 border-tomato bg-card p-3 shadow-soft">
                    <p className="font-semibold">{w.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <b className="font-medium">{pt(lang, "whyLabel")}:</b> {w.description}
                    </p>
                    <p className="mt-1 text-sm">
                      <b className="font-medium text-primary">{pt(lang, "howHelp")}:</b> {w.howToHelp}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface bg-gradient-to-br from-tomato/5 to-card to-50% p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5 text-tomato" />
              {pt(lang, "mistakesTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "mistakesSub", child)}</p>
            {data.weakAreas.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noMistakes")}</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.weakAreas.map((m) => (
                  <li key={`m-${m.id}`} className="rounded-xl border border-tomato/40 bg-card p-4 shadow-soft">
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-tomato/10 px-2 py-0.5 text-xs font-semibold text-tomato">
                      <Target className="h-3 w-3" />
                      {pt(lang, "childToo", child)}
                    </span>
                    <p className="font-semibold">{m.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function KindChip({ lang, kind }: { lang: string; kind: string }) {
  return <span className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", KIND_STYLE[kind] ?? KIND_STYLE["homework"])}>{kindLabel(lang, kind)}</span>;
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  const [from, text] = tone.split(" ");
  return (
    <div className={cn("surface bg-gradient-to-br to-card to-60% p-5", from)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl bg-card shadow-soft", text)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Assignments({ lang, items, childName }: { lang: string; items: ParentAssignmentItem[]; childName: string }) {
  const child = { child: childName };
  const sorted = [...items].sort((a, b) => (b.dueDate ?? "").localeCompare(a.dueDate ?? "") || a.title.localeCompare(b.title));
  return (
    <section className="surface p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <ClipboardList className="h-5 w-5 text-sky" />
        {pt(lang, "assignmentsTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{pt(lang, "assignmentsSub", child)}</p>
      {sorted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{pt(lang, "noAssignments")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sorted.map((a) => (
            <AssignmentItem key={a.id} a={a} lang={lang} />
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Languages className="h-3.5 w-3.5" />
        {pt(lang, "translatedNote")}
      </p>
    </section>
  );
}

function AssignmentItem({ a, lang }: { a: ParentAssignmentItem; lang: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border bg-muted/20">
      <button type="button" className="flex w-full items-center gap-3 p-4 text-start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <KindChip lang={lang} kind={a.kind} />
            {a.title}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {a.courseName && <span>{a.courseName}</span>}
            {a.dueDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {pt(lang, "due")}: {fmtDate(lang, a.dueDate)}
              </span>
            )}
            {a.score == null ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {pt(lang, "notGraded")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-success" dir="ltr">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {fmtPoints(a.score)}/{fmtPoints(a.maxPoints)}
              </span>
            )}
          </p>
        </div>
        <span className="hidden text-xs font-semibold text-primary sm:inline">{open ? pt(lang, "hideAssignment") : pt(lang, "viewAssignment")}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3 animate-in fade-in">
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {a.instructions || <span className="text-muted-foreground">{pt(lang, "noInstructions")}</span>}
          </p>
          {a.feedback && (
            <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
              <b className="font-medium">{pt(lang, "teacherFeedback")}:</b> {a.feedback}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
