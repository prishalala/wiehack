import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Person } from "@/types/teacherPortal";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSignedInPerson, onSignedInPersonChange, signInInstitution, signOutInstitution } from "@/services/auth";
import { setSessionId, setStudentId } from "@/lib/store";

type StudentAuthValue = {
  student: Person | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Person>;
  signOut: () => Promise<void>;
};

const StudentAuthContext = createContext<StudentAuthValue | null>(null);

/** Student sign-in with the institution account (no join codes, no self sign-up). */
export function StudentAuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Person | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    let cancelled = false;
    void getSignedInPerson("student", "student").then((p) => {
      if (!cancelled) {
        setStudent(p);
        setLoading(false);
      }
    });
    const unsub = onSignedInPersonChange("student", "student", (p) => {
      if (!cancelled) setStudent(p);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const value: StudentAuthValue = {
    student,
    loading,
    async signIn(email, password) {
      const p = await signInInstitution("student", "student", email, password);
      setStudent(p);
      return p;
    },
    async signOut() {
      await signOutInstitution("student");
      setStudentId(null);
      setSessionId(null);
      setStudent(null);
    },
  };

  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>;
}

export function useStudentAuth(): StudentAuthValue {
  const ctx = useContext(StudentAuthContext);
  if (!ctx) throw new Error("useStudentAuth must be used within StudentAuthProvider");
  return ctx;
}
