import { CheckCircle2, HelpCircle, Lightbulb } from "lucide-react";
import { DemoBadge } from "@/components/common";
import type { UnderstandingSignal } from "@/types/teacherPortal";
import { cn } from "@/lib/utils";

export type SignalCounts = Record<UnderstandingSignal, number>;

const META: Record<UnderstandingSignal, { label: string; icon: typeof CheckCircle2; tone: string }> = {
  understand: { label: "I understand", icon: CheckCircle2, tone: "bg-success-soft text-success" },
  example: { label: "Need another example", icon: Lightbulb, tone: "bg-sky-soft text-sky" },
  confused: { label: "I'm confused", icon: HelpCircle, tone: "bg-alert-soft text-alert-foreground" },
};

export function UnderstandingPanel({
  counts,
  totalStudents,
  isDemo,
}: {
  counts: SignalCounts;
  totalStudents: number;
  isDemo?: boolean;
}) {
  const responded = counts.understand + counts.example + counts.confused;
  const segments = (["understand", "example", "confused"] as const).map((key) => ({
    key,
    ...META[key],
    n: counts[key],
    pct: responded ? Math.round((counts[key] / responded) * 100) : 0,
  }));

  return (
    <section className="surface p-6" aria-labelledby="understand-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="understand-h" className="font-semibold">
          Class understanding
        </h2>
        {isDemo ? <DemoBadge /> : <span className="text-xs text-muted-foreground">{responded} of {totalStudents} responded</span>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Private student signals — not shown to other students.</p>

      {responded === 0 && !isDemo ? (
        <p className="mt-4 text-sm text-muted-foreground">No signals yet. Students tap a status in the classroom view.</p>
      ) : (
        <>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
            {segments.map((s) =>
              s.n > 0 ? (
                <div key={s.key} className={cn("h-full transition-all", s.tone.split(" ")[0])} style={{ width: `${s.pct}%` }} title={`${s.label}: ${s.n}`} />
              ) : null,
            )}
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {segments.map((s) => (
              <li key={s.key} className="rounded-xl border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className={cn("grid h-7 w-7 place-items-center rounded-lg", s.tone)}>
                    <s.icon className="h-3.5 w-3.5" />
                  </span>
                  {s.label}
                </div>
                <p className="mt-2 font-display text-2xl font-semibold">{s.n}</p>
                <p className="text-xs text-muted-foreground">students</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
