import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { pickLocalized } from "@/components/activity/ActivityFrame";
import { submitCheckResponse } from "@/api";
import type { Check as CheckType, Lang } from "@/types";
import { cn } from "@/lib/utils";

export function CheckQuiz({
  check,
  lang,
  studentId,
  alreadySelected = null,
  onDone,
}: {
  check: CheckType;
  lang: Lang;
  studentId: string;
  alreadySelected?: number | null;
  onDone?: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(alreadySelected);
  const [busy, setBusy] = useState(false);
  const done = picked !== null;

  async function choose(i: number) {
    if (done || busy) return;
    setBusy(true);
    try {
      const res = await submitCheckResponse({ checkId: check.id, studentId, selectedIndex: i });
      setPicked(i);
      onDone?.(res.correct);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  const question = pickLocalized(check.question, lang);
  const correct = picked === check.correct_index;

  return (
    <div className="rounded-xl border p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {check.phase === "pre" ? "Quick check · before" : "Quick check · after"}
      </p>
      <p className="mt-2 font-semibold">{question}</p>
      <div className="mt-3 grid gap-2">
        {check.options.map((opt, i) => {
          const label = pickLocalized(opt, lang);
          return (
            <button
              key={i}
              type="button"
              disabled={done || busy}
              onClick={() => void choose(i)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors",
                picked === i && correct && "border-success bg-success-soft",
                picked === i && !correct && "border-destructive/50 bg-destructive/5",
                picked !== i && !done && "hover:bg-muted",
              )}
            >
              <span>{label}</span>
              {busy && !done ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {picked === i && (correct ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-destructive" />)}
            </button>
          );
        })}
      </div>
      {done && (
        <p className={cn("mt-3 text-sm font-medium", correct ? "text-success" : "text-muted-foreground")}>
          {correct ? "Nice — that’s right." : "Not quite — keep learning with the activity."}
        </p>
      )}
    </div>
  );
}
