import { useSyncExternalStore } from "react";
import type { AppState, ClassroomSession } from "@/types";

/**
 * Client state for the active classroom.
 * Session/student identity persist in localStorage; live rows sync from Supabase via the API layer.
 */
const STATE_KEY = "classbridge:state:v1";
const SESSION_KEY = "classbridge:sessionId";
const STUDENT_KEY = "classbridge:student";
const MY_QUESTIONS_KEY = "classbridge:myQuestionIds";

const listeners = new Set<() => void>();
let cache: AppState | null = null;
let serverSnapshot: AppState | null = null;

function emptySession(): ClassroomSession {
  return {
    id: "",
    title: "No session yet",
    subject: "",
    notes: "",
    notesLocalized: null,
    joinCode: "------",
    status: "draft",
    createdAt: Date.now(),
  };
}

export function createEmptyState(): AppState {
  return {
    session: emptySession(),
    students: [],
    questions: [],
    misconceptions: [],
    activities: [],
    checks: [],
    checkResponses: [],
    quizResponses: [],
  };
}

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Migrate older demo shapes missing notesLocalized
      if (parsed.session && !("notesLocalized" in parsed.session)) {
        parsed.session = { ...(parsed.session as ClassroomSession), notesLocalized: null };
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return createEmptyState();
}

export function getState(): AppState {
  if (typeof window === "undefined") return (serverSnapshot ??= createEmptyState());
  if (!cache) cache = load();
  return cache;
}

export function setState(updater: (s: AppState) => AppState) {
  cache = updater(getState());
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(cache));
  }
  listeners.forEach((l) => l());
}

export function resetDemo() {
  setSessionId(null);
  setStudentId(null);
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(MY_QUESTIONS_KEY);
  }
  setState(() => createEmptyState());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STATE_KEY || e.key === SESSION_KEY || e.key === STUDENT_KEY) {
      cache = load();
      cb();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, () => (serverSnapshot ??= createEmptyState()));
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY) || getState().session.id || null;
}

export function setSessionId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(SESSION_KEY, id);
  else window.localStorage.removeItem(SESSION_KEY);
  listeners.forEach((l) => l());
}

export function getStudentId(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(STUDENT_KEY);
}

export function setStudentId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STUDENT_KEY, id);
  else window.localStorage.removeItem(STUDENT_KEY);
  listeners.forEach((l) => l());
}

export function useStudentId(): string | null {
  return useSyncExternalStore(subscribe, getStudentId, () => null);
}

const TEACHER_TOKENS_KEY = "classbridge:teacherTokens";

function readTeacherTokens(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(TEACHER_TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Teacher key returned once by the server when this browser created the session. */
export function getTeacherToken(sessionId: string): string | null {
  if (typeof window === "undefined" || !sessionId) return null;
  return readTeacherTokens()[sessionId] ?? null;
}

export function setTeacherToken(sessionId: string, token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEACHER_TOKENS_KEY, JSON.stringify({ ...readTeacherTokens(), [sessionId]: token }));
  } catch {
    /* storage unavailable: teacher actions will report a missing key */
  }
}

/** Track question IDs submitted from this browser (needed when anonymous — no student_id stored). */
export function rememberMyQuestionId(id: string) {
  if (typeof window === "undefined") return;
  const ids = new Set(getMyQuestionIds());
  ids.add(id);
  window.localStorage.setItem(MY_QUESTIONS_KEY, JSON.stringify([...ids]));
}

export function getMyQuestionIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_QUESTIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
