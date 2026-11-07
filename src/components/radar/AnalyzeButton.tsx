import { useState } from "react";
import { Loader2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { analyzeMisconceptions } from "@/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSessionId, getState } from "@/lib/store";

/** Runs the AI Misconception Radar (Supabase analyze-misconceptions). */
export function AnalyzeButton({ size = "sm", className }: { size?: "sm" | "default"; className?: string }) {
  const [busy, setBusy] = useState(false);
  if (!isSupabaseConfigured()) return null;

  async function run() {
    const sessionId = getSessionId() || getState().session.id;
    if (!sessionId) {
      toast.error("Create a session first");
      return;
    }
    setBusy(true);
    try {
      const { misconceptions } = await analyzeMisconceptions(sessionId);
      const n = misconceptions.length;
      toast.success(n === 0 ? "Analyzed — no shared misconception found" : `Found ${n} misconception${n === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size={size} className={className} onClick={() => void run()} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
      {busy ? "Analyzing with AI…" : "Analyze questions"}
    </Button>
  );
}
