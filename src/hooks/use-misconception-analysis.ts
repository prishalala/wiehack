import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeMisconceptions, refreshSession } from "@/api";
import { useAppState } from "@/lib/store";

const POLL_MS = 4000;
const MIN_ANALYZE_GAP_MS = 20000;

export type AnalysisStatus = "idle" | "analyzing" | "error";

/**
 * Polls questions every 4s; re-runs analyze-misconceptions when new questions
 * arrive (debounced, at most every 20s) or when reanalyze() is called.
 */
export function useMisconceptionAnalysis(enabled = true) {
  const { session, questions: allQuestions } = useAppState();
  // Only auto-analyze questions whose translation has finished (done, not_needed or failed),
  // so the radar runs on English text rather than racing the translation step.
  const questions = allQuestions.filter((q) => q.translationStatus !== "pending");
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const lastCount = useRef(0);
  const lastRunAt = useRef(0);
  const timer = useRef<number | null>(null);
  const running = useRef(false);

  const runAnalyze = useCallback(async (force = false) => {
    if (!session.id || running.current) return;
    const now = Date.now();
    if (!force && now - lastRunAt.current < MIN_ANALYZE_GAP_MS) return;
    if (!force && questions.length < 2) return;

    running.current = true;
    setStatus("analyzing");
    setError(null);
    try {
      await analyzeMisconceptions(session.id);
      lastRunAt.current = Date.now();
      lastCount.current = questions.length;
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      setStatus("error");
    } finally {
      running.current = false;
    }
  }, [session.id, questions.length]);

  const reanalyze = useCallback(() => runAnalyze(true), [runAnalyze]);

  // Poll questions
  useEffect(() => {
    if (!enabled || !session.id) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await refreshSession();
      } catch {
        /* ignore poll errors */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, session.id]);

  // Debounced auto-analyze when new questions appear
  useEffect(() => {
    if (!enabled || !session.id) return;
    if (questions.length <= lastCount.current) return;
    if (questions.length < 2) {
      lastCount.current = questions.length;
      return;
    }

    if (timer.current) window.clearTimeout(timer.current);
    const delay = Math.max(0, MIN_ANALYZE_GAP_MS - (Date.now() - lastRunAt.current));
    timer.current = window.setTimeout(() => {
      void runAnalyze(false);
    }, Math.min(delay, MIN_ANALYZE_GAP_MS));

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [enabled, session.id, questions.length, runAnalyze]);

  // Initial analyze if we already have questions and no misconceptions loaded
  useEffect(() => {
    if (!enabled || !session.id) return;
    if (questions.length >= 2 && lastRunAt.current === 0) {
      void runAnalyze(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session.id]);

  return { status, error, reanalyze, analyzing: status === "analyzing" };
}
