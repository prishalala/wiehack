/**
 * Teacher sign-in. Teacher accounts are issued by the institution (uni/org email in the
 * `people` directory with role = teacher); there is no self sign-up.
 */
import type { Person, Teacher } from "@/types/teacherPortal";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getSignedInPerson,
  onSignedInPersonChange,
  requestPasswordReset as resetFor,
  signInInstitution,
  signOutInstitution,
} from "@/services/auth";

export type AuthResult = { teacher: Teacher };

function toTeacher(p: Person): Teacher {
  return { id: p.id, fullName: p.fullName, email: p.email, role: "teacher", createdAt: "" };
}

export function isTeacherAuthAvailable(): boolean {
  return isSupabaseConfigured();
}

export async function getCurrentTeacher(): Promise<Teacher | null> {
  const p = await getSignedInPerson("teacher", "teacher");
  return p ? toTeacher(p) : null;
}

export async function signInTeacher(input: { email: string; password: string }): Promise<AuthResult> {
  return { teacher: toTeacher(await signInInstitution("teacher", "teacher", input.email, input.password)) };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await resetFor("teacher", email, "/teacher/login");
}

export async function signOutTeacher(): Promise<void> {
  await signOutInstitution("teacher");
}

export function onAuthStateChange(cb: (teacher: Teacher | null) => void): () => void {
  return onSignedInPersonChange("teacher", "teacher", (p) => cb(p ? toTeacher(p) : null));
}
