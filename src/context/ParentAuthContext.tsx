import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Person } from "@/types/teacherPortal";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSignedInPerson, onSignedInPersonChange, signInInstitution, signOutInstitution } from "@/services/auth";

type ParentAuthValue = {
  parent: Person | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Person>;
  signOut: () => Promise<void>;
};

const ParentAuthContext = createContext<ParentAuthValue | null>(null);

/** Parent sign-in with the institution account linked via parent_links. */
export function ParentAuthProvider({ children }: { children: ReactNode }) {
  const [parent, setParent] = useState<Person | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    let cancelled = false;
    void getSignedInPerson("parent", "parent").then((p) => {
      if (!cancelled) {
        setParent(p);
        setLoading(false);
      }
    });
    const unsub = onSignedInPersonChange("parent", "parent", (p) => {
      if (!cancelled) setParent(p);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const value: ParentAuthValue = {
    parent,
    loading,
    async signIn(email, password) {
      const p = await signInInstitution("parent", "parent", email, password);
      setParent(p);
      return p;
    },
    async signOut() {
      await signOutInstitution("parent");
      setParent(null);
    },
  };

  return <ParentAuthContext.Provider value={value}>{children}</ParentAuthContext.Provider>;
}

export function useParentAuth(): ParentAuthValue {
  const ctx = useContext(ParentAuthContext);
  if (!ctx) throw new Error("useParentAuth must be used within ParentAuthProvider");
  return ctx;
}
