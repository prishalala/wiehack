import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Lightbulb, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LangChip } from "@/components/common";
import { generateMiniLesson } from "@/api";
import { TranslatedQuestion } from "./TranslatedQuestion";
import type { StudentQuestion, UiMisconception } from "@/types";
import { cn } from "@/lib/utils";

const sev = {
  high: { bar: "bg-alert", label: "Needs attention", chip: "bg-alert-soft text-alert-foreground" },
  medium: { bar: "bg-sky", label: "Emerging", chip: "bg-sky-soft text-sky" },
  low: { bar: "bg-muted-foreground/40", label: "Isolated", chip: "bg-muted text-muted-foreground" },
};

export function MisconceptionCard({ m, questions, defaultOpen = false, total }: { m: UiMisconception; questions: StudentQuestion[]; defaultOpen?: boolean; total: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const support = questions.filter((q) => m.questionIds.includes(q.id));
  const s = sev[m.severity];
  const pct = total ? Math.round((support.length / total) * 100) : 0;

  async function onGenerate() {
    setBusy(true);
    try {
      const act = await generateMiniLesson(m.id);
      toast.success("Mini-lesson ready to preview");
      navigate({ to: "/teacher/activities", search: { id: act.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate activity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border border-ai/25 bg-ai-soft/40 transition-shadow duration-200 hover:shadow-lift",
        m.severity === "high" && "border-alert/50",
      )}
    >
      <span className={cn("absolute inset-y-0 start-0 w-1", s.bar)} aria-hidden />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-4 p-5 ps-6 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ai-label">
              <Sparkles className="h-3 w-3" aria-hidden />
              AI suggestion
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.chip)}>{s.label}</span>
            {m.languages.map((l) => (
              <LangChip key={l} lang={l} />
            ))}
          </div>
          <h3 className="mt-2.5 font-display text-xl font-semibold leading-snug text-ai-foreground">{m.title}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground">{m.explanation}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-display text-3xl font-semibold tabular-nums text-ai-foreground">{support.length}</span>
          <span className="text-[11px] font-medium text-muted-foreground">
            question{support.length === 1 ? "" : "s"} · {pct}%
          </span>
          <ChevronDown className={cn("mt-1 h-4 w-4 text-muted-foreground transition-transform duration-150", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="space-y-4 border-t border-ai/15 bg-card/80 p-5 ps-6 feed-in">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supporting questions</p>
            <ul className="mt-2 space-y-2">
              {support.map((q) => (
                <li key={q.id} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm shadow-soft">
                  <LangChip lang={q.detectedLanguage} />
                  <div className="min-w-0 flex-1">
                    <TranslatedQuestion q={q} quoted />
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{q.studentName}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3 rounded-xl border border-ai/20 bg-ai-soft p-4">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-ai" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-ai-foreground">Suggested intervention</p>
              <p className="mt-1 text-[15px] leading-relaxed">{m.intervention}</p>
              <p className="mt-2 text-xs font-medium text-ai-foreground/80">AI suggestion — review before sharing</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDetails(true)}>
              View details
            </Button>
            <Button size="sm" onClick={onGenerate} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate mini-lesson
            </Button>
          </div>
        </div>
      )}
      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-ai-foreground">{m.title}</DialogTitle>
            <DialogDescription>{m.explanation}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-ai-soft p-3">
              <p className="font-display text-xl font-semibold">{support.length}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="font-display text-xl font-semibold">{m.languages.length}</p>
              <p className="text-xs text-muted-foreground">Languages</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold">
                <Users className="h-4 w-4" />
                {new Set(support.map((q) => q.studentId)).size}
              </p>
              <p className="text-xs text-muted-foreground">Students</p>
            </div>
          </div>
          <p className="ai-label w-fit">
            <Sparkles className="h-3 w-3" aria-hidden />
            Live AI clustering — review before acting
          </p>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export function RadarVisual({ items }: { items: { label: string; value: number; severity: UiMisconception["severity"] }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const angles = items.map((_, i) => (i / Math.max(items.length, 1)) * Math.PI * 2 - Math.PI / 2);
  const fill = { high: "var(--alert)", medium: "var(--sky)", low: "var(--muted-foreground)" };
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" role="img" aria-label="Misconception radar">
      <defs>
        <linearGradient id="sweep" x1="0" x2="1">
          <stop offset="0" stopColor="var(--ai)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--ai)" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {[90, 65, 40, 15].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="var(--border)" />
      ))}
      <line x1="10" y1="100" x2="190" y2="100" stroke="var(--border)" />
      <line x1="100" y1="10" x2="100" y2="190" stroke="var(--border)" />
      <g className="radar-sweep">
        <path d="M100 100 L190 100 A90 90 0 0 0 163.6 36.4 Z" fill="url(#sweep)" />
      </g>
      {items.map((it, i) => {
        const r = 25 + (it.value / max) * 60;
        const x = 100 + Math.cos(angles[i] ?? 0) * (90 - r + 15);
        const y = 100 + Math.sin(angles[i] ?? 0) * (90 - r + 15);
        const size = 5 + (it.value / max) * 9;
        return (
          <g key={it.label}>
            <circle cx={x} cy={y} r={size + 5} fill={fill[it.severity]} opacity="0.15" />
            <circle cx={x} cy={y} r={size} fill={fill[it.severity]} opacity="0.85" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--card)">
              {it.value}
            </text>
          </g>
        );
      })}
      <circle cx="100" cy="100" r="3" fill="var(--foreground)" />
    </svg>
  );
}
