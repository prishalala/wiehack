import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { translateQuestionToEnglish } from "@/api";
import type { StudentQuestion } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Teacher view of a student question: English translation first, original on demand.
 * The original (`q.text`) is always kept and shown when translation is pending or failed.
 */
export function TranslatedQuestion({ q, quoted = false }: { q: StudentQuestion; quoted?: boolean }) {
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const status = q.translationStatus ?? "pending";
  const translated = status === "done" && q.englishGloss?.trim() && q.englishGloss.trim() !== q.text.trim();
  const primary = translated ? q.englishGloss! : q.text;
  const wrap = (s: string) => (quoted ? `“${s}”` : s);

  async function retry() {
    setRetrying(true);
    try {
      await translateQuestionToEnglish(q.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="min-w-0">
      {translated && (
        <span className="ai-label mb-1.5">
          <Sparkles className="h-3 w-3" aria-hidden />
          AI-translated
        </span>
      )}
      <p className={cn("whitespace-pre-wrap text-[15px] leading-relaxed", translated && "text-foreground")}>
        {wrap(primary)}
      </p>

      {status === "pending" && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-alert-foreground" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Translating…
        </p>
      )}

      {status === "failed" && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Translation unavailable
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
            Retry
          </button>
        </p>
      )}

      {translated && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")} />
            {open
              ? "Hide original"
              : `Show original${q.detectedLanguage && q.detectedLanguage !== "unknown" ? ` (${q.detectedLanguage})` : ""}`}
          </button>
          {open && (
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-start" dir="auto">
              {wrap(q.text)}
              {q.isRomanized && <span className="ms-2 text-xs text-muted-foreground">· romanized</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}
