import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, RotateCw } from "lucide-react";
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
      <p className="whitespace-pre-wrap text-sm">{wrap(primary)}</p>

      {status === "pending" && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Translating to English…
        </p>
      )}

      {status === "failed" && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-alert-foreground">
          <AlertTriangle className="h-3 w-3" /> English translation unavailable — showing the original.
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center gap-1 rounded px-1 font-medium underline-offset-2 hover:underline disabled:opacity-60"
          >
            {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />} Retry
          </button>
        </p>
      )}

      {translated && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            {open ? "Hide original" : `Show original${q.detectedLanguage && q.detectedLanguage !== "unknown" ? ` (${q.detectedLanguage})` : ""}`}
          </button>
          {open && (
            <p className="mt-1 whitespace-pre-wrap rounded-md border-l-2 border-primary/40 bg-muted/60 px-2 py-1 text-sm">
              {wrap(q.text)}
              {q.isRomanized && <span className="ml-2 text-xs text-muted-foreground">· romanized</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}
