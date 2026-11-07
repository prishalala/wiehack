import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common";
import { ActivityFrame } from "@/components/activity/ActivityFrame";
import { LANGUAGES } from "@/i18n";
import { useAppState } from "@/lib/store";
import { checkStats, regenerateActivity, shareActivity } from "@/api";
import { activityLabel } from "@/types";
import type { Lang } from "@/types";
import { cn } from "@/lib/utils";
import { useSessionPoll } from "@/hooks/use-session-poll";

export const Route = createFileRoute("/teacher/activities")({
  validateSearch: (s: Record<string, unknown>): { id?: string | undefined } => ({ id: typeof s["id"] === "string" ? s["id"] : undefined }),
  head: () => ({
    meta: [
      { title: "Learning Activities — ClassBridge" },
      { name: "description", content: "Preview interactive mini-lessons and share them with your class." },
      { property: "og:title", content: "Learning Activities — ClassBridge" },
      { property: "og:description", content: "Preview interactive mini-lessons and share them with your class." },
    ],
  }),
  component: Activities,
});

function Activities() {
  const { session, activities, misconceptions, checks } = useAppState();
  useSessionPoll(4000, Boolean(session.id));
  const { id } = Route.useSearch();
  const [selected, setSelected] = useState<string | undefined>(id);
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  const act = activities.find((a) => a.id === selected) ?? activities[0];
  const mis = act ? misconceptions.find((m) => m.id === act.misconception_id) : undefined;
  const stats = act?.misconception_id ? checkStats(act.misconception_id) : null;
  const hasChecks = act?.misconception_id
    ? checks.some((c) => c.misconception_id === act.misconception_id)
    : false;

  const langOptions = useMemo(() => {
    const keys = act ? Object.keys(act.explanation) : ["en"];
    const fromAct = LANGUAGES.filter((l) => keys.includes(l.code));
    return fromAct.length ? fromAct : LANGUAGES.filter((l) => l.code === "en");
  }, [act]);

  if (!act) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Learning activities</h1>
          <p className="text-muted-foreground">Generate a mini-lesson from a misconception on the radar.</p>
        </div>
        <EmptyState icon={BookOpenCheck} title="No activities yet" body="Open Misconception Radar → Generate mini-lesson." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Learning activities</h1>
        <p className="text-muted-foreground">Preview the interactive activity, regenerate if needed, then share with the class.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelected(a.id)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-colors",
                  a.id === act.id ? "border-primary bg-primary-soft/50" : "bg-card hover:bg-muted",
                )}
              >
                <p className="line-clamp-2 font-medium">{activityLabel(a)}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {a.shared ? (
                    <><CheckCircle2 className="h-3 w-3 text-success" /> Shared with class</>
                  ) : (
                    "Draft · not shared"
                  )}
                </p>
              </button>
            </li>
          ))}
        </ul>
        <div className="surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervention preview</p>
              {mis && <p className="mt-1 text-sm">For: <span className="font-medium">{mis.title}</span></p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={lang} onValueChange={(v) => setLang(v)}>
                <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {langOptions.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.native}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={regenBusy || !act.misconception_id}
                onClick={async () => {
                  if (!act.misconception_id) return;
                  setRegenBusy(true);
                  try {
                    const next = await regenerateActivity(act.misconception_id);
                    setSelected(next.id);
                    toast.success("Activity regenerated");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Regenerate failed");
                  } finally {
                    setRegenBusy(false);
                  }
                }}
              >
                {regenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate
              </Button>
              {act.shared ? (
                <Button variant="outline" disabled><CheckCircle2 className="h-4 w-4" /> Shared</Button>
              ) : (
                <Button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await shareActivity(act.id);
                      toast.success("Shared with class — students see it now");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Share failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Share with class
                </Button>
              )}
            </div>
          </div>
          <div className="pt-6">
            <ActivityFrame key={act.id + lang} activity={act} lang={lang} />
          </div>
          {hasChecks && stats && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pre-check</p>
                <p className="mt-1 font-display text-2xl font-semibold">{stats.prePct === null ? "—" : `${stats.prePct}%`}</p>
                <p className="text-xs text-muted-foreground">{stats.preN} response{stats.preN === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Post-check</p>
                <p className="mt-1 font-display text-2xl font-semibold">{stats.postPct === null ? "—" : `${stats.postPct}%`}</p>
                <p className="text-xs text-muted-foreground">{stats.postN} response{stats.postN === 1 ? "" : "s"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
