import { AlertCircle, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisStatus } from "@/hooks/use-misconception-analysis";

export function AnalysisControls({
  status,
  error,
  onReanalyze,
}: {
  status: AnalysisStatus;
  error: string | null;
  onReanalyze: () => void;
}) {
  const analyzing = status === "analyzing";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "error" && error && (
        <span className="inline-flex max-w-md items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="truncate">{error}</span>
        </span>
      )}
      <Button size="sm" onClick={onReanalyze} disabled={analyzing}>
        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
        {analyzing ? "Analyzing with AI…" : status === "error" ? "Retry" : "Analyze questions"}
      </Button>
    </div>
  );
}
