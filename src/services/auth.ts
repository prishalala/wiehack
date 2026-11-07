/**
 * Institution sign-in shared by the teacher, student and (later) parent portals.
 * Accounts are issued by the institution: Supabase Auth checks the password, and the
 * `people` directory decides the role. There is no self sign-up.
 */
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured, type Portal } from "@/lib/supabase";
import type { Person, UserRole } from "@/types/teacherPortal";

type PersonRow = { id: string; email: string; full_name: string; role: UserRole; preferred_language: string };

function toPerson(r: PersonRow): Person {
  return { id: r.id, email: r.email, fullName: r.full_name, role: r.role, preferredLanguage: r.preferred_language };
}

export class NotRegisteredError extends Error {}

const ROLE_LABEL: Record<UserRole, string> = { teacher: "teacher", student: "student", parent: "parent" };

/** Directory record for the signed-in account, checked against the expected role. */
async function personForSession(portal: Portal, role: UserRole, session: Session | null): Promise<Person | null> {
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  const { data, error } = await getSupabase(portal)
    .from("people")
    .select("id, email, full_name, role, preferred_language")
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new NotRegisteredError("This email isn't registered with your institution.");
  const person = toPerson(data as PersonRow);
  if (person.role !== role) {
    throw new NotRegisteredError(`This is a ${ROLE_LABEL[person.role]} account. Use the ${ROLE_LABEL[person.role]} sign-in.`);
  }
  return person;
}

export async function signInInstitution(portal: Portal, role: UserRole, email: string, password: string): Promise<Person> {
  if (!isSupabaseConfigured()) throw new Error("Sign-in needs Supabase. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  const client = getSupabase(portal);
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
  try {
    const person = await personForSession(portal, role, data.session);
    if (!person) throw new Error("Sign-in failed.");
    return person;
  } catch (err) {
    await client.auth.signOut(); // never leave a wrong-role session behind
    throw err;
  }
}

export async function getSignedInPerson(portal: Portal, role: UserRole): Promise<Person | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase(portal).auth.getSession();
  try {
    return await personForSession(portal, role, data.session);
  } catch {
    return null;
  }
}

export function onSignedInPersonChange(portal: Portal, role: UserRole, cb: (p: Person | null) => void): () => void {
  if (!isSupabaseConfigured()) {
    cb(null);
    return () => undefined;
  }
  const { data } = getSupabase(portal).auth.onAuthStateChange((_event, session) => {
    // Defer DB calls out of the auth callback (supabase-js recommendation).
    setTimeout(() => {
      personForSession(portal, role, session).then(cb, () => cb(null));
    }, 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutInstitution(portal: Portal): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase(portal).auth.signOut();
}

export async function requestPasswordReset(portal: Portal, email: string, redirectPath: string): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Sign-in needs Supabase.");
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}${redirectPath}` : undefined;
  const { error } = await getSupabase(portal).auth.resetPasswordForEmail(email.trim(), redirectTo ? { redirectTo } : undefined);
  if (error) throw new Error(error.message);
}
