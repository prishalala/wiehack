import { useSyncExternalStore } from "react";
import type { UnderstandingSignal } from "@/types/teacherPortal";

const KEY = "classbridge:understanding:v1";
const CHANNEL = "classbridge-understanding";

type SignalMap = Record<string, { signal: UnderstandingSignal; updatedAt: number; sessionId: string }>;

const listeners = new Set<() => void>();
let cache: SignalMap | null = null;
let bc: BroadcastChannel | null = null;
const EMPTY_COUNTS: Record<UnderstandingSignal, number> = { understand: 0, example: 0, confused: 0 };
const countsCache = new Map<string, Record<UnderstandingSignal, number>>();

function ensureChannel() {
  if (typeof window === "undefined" || bc) return;
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = () => {
      cache = load();
      countsCache.clear();
      listeners.forEach((l) => l());
    };
  } catch {
    /* ignore */
  }
}

function load(): SignalMap {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SignalMap) : {};
  } catch {
    return {};
  }
}

function getMap(): SignalMap {
  if (typeof window === "undefined") return {};
  if (!cache) cache = load();
  return cache;
}

function persist(next: SignalMap) {
  cache = next;
  countsCache.clear();
  window.localStorage.setItem(KEY, JSON.stringify(next));
  ensureChannel();
  try {
    bc?.postMessage("update");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  ensureChannel();
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = load();
      countsCache.clear();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setUnderstandingSignal(sessionId: string, studentId: string, signal: UnderstandingSignal) {
  if (!sessionId || !studentId) return;
  const map = { ...getMap() };
  map[`${sessionId}:${studentId}`] = { signal, updatedAt: Date.now(), sessionId };
  persist(map);
}

export function getSessionSignalCounts(sessionId: string): Record<UnderstandingSignal, number> {
  const counts = { understand: 0, example: 0, confused: 0 };
  if (!sessionId) return EMPTY_COUNTS;
  for (const row of Object.values(getMap())) {
    if (row.sessionId === sessionId) counts[row.signal] += 1;
  }
  const prev = countsCache.get(sessionId);
  if (
    prev &&
    prev.understand === counts.understand &&
    prev.example === counts.example &&
    prev.confused === counts.confused
  ) {
    return prev;
  }
  countsCache.set(sessionId, counts);
  return counts;
}

export function getMySignal(sessionId: string, studentId: string): UnderstandingSignal | null {
  if (!sessionId || !studentId) return null;
  return getMap()[`${sessionId}:${studentId}`]?.signal ?? null;
}

export function useSessionSignalCounts(sessionId: string) {
  return useSyncExternalStore(
    subscribe,
    () => getSessionSignalCounts(sessionId),
    () => EMPTY_COUNTS,
  );
}

export function useMySignal(sessionId: string, studentId: string | null) {
  return useSyncExternalStore(
    subscribe,
    () => (studentId ? getMySignal(sessionId, studentId) : null),
    () => null,
  );
}
