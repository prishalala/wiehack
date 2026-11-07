import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Teacher } from "@/types/teacherPortal";
import {
  getCurrentTeacher,
  isTeacherAuthAvailable,
  onAuthStateChange,
  signInTeacher,
  signOutTeacher,
  requestPasswordReset,
} from "@/services/teacherAuth";

type TeacherAuthContextValue = {
  teacher: Teacher | null;
  loading: boolean;
  /** True when Supabase Auth can enforce real sessions. */
  authAvailable: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
};

const TeacherAuthContext = createContext<TeacherAuthContextValue | null>(null);

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const authAvailable = isTeacherAuthAvailable();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(authAvailable);

  useEffect(() => {
    if (!authAvailable) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getCurrentTeacher().then((t) => {
      if (!cancelled) {
        setTeacher(t);
        setLoading(false);
      }
    });
    const unsub = onAuthStateChange((t) => {
      if (!cancelled) setTeacher(t);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [authAvailable]);

  const value: TeacherAuthContextValue = {
    teacher,
    loading,
    authAvailable,
    async signIn(email, password) {
      const { teacher: t } = await signInTeacher({ email, password });
      setTeacher(t);
    },
    async signOut() {
      await signOutTeacher();
      setTeacher(null);
    },
    async forgotPassword(email) {
      await requestPasswordReset(email);
    },
  };

  return <TeacherAuthContext.Provider value={value}>{children}</TeacherAuthContext.Provider>;
}

export function useTeacherAuth() {
  const ctx = useContext(TeacherAuthContext);
  if (!ctx) throw new Error("useTeacherAuth must be used within TeacherAuthProvider");
  return ctx;
}
