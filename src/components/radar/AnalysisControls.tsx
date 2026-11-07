import { AlertCircle, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisStatus } from "@/hooks/use-misconception-analysis";

export function AnalysisControls({
  status,
  error,
  onReanalyze,
  lastUpdated,
}: {
  status: AnalysisStatus;
  error: string | null;
  onReanalyze: () => void;
  lastUpdated?: number | null;
}) {
  const analyzing = status === "analyzing";
  const updatedLabel =
    lastUpdated && lastUpdated > 0
      ? `Last updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {analyzing && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-soft px-2.5 py-1 text-xs font-semibold text-ai-foreground" role="status" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Analysing…
        </span>
      )}
      {!analyzing && updatedLabel && <span className="text-xs text-muted-foreground">{updatedLabel}</span>}
      {status === "error" && error && (
        <span className="inline-flex max-w-md items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{error}</span>
        </span>
      )}
      <Button size="sm" onClick={onReanalyze} disabled={analyzing}>
        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
        {analyzing ? "Analysing with AI…" : status === "error" ? "Retry" : "Analyze questions"}
      </Button>
    </div>
  );
}
