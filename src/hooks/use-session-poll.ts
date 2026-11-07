import { useEffect, useRef } from "react";
import { refreshSession } from "@/api";
import { getSessionId } from "@/lib/store";

/** Poll Supabase for the active session bundle. */
export function useSessionPoll(intervalMs = 4000, enabled = true) {
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    async function tick() {
      if (busy.current || cancelled) return;
      if (!getSessionId()) return;
      busy.current = true;
      try {
        await refreshSession();
      } catch (err) {
        console.warn("session poll failed", err);
      } finally {
        busy.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs, enabled]);
}
