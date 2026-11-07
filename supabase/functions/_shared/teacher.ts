import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Error carrying an HTTP status so handlers can return 401/403/404 instead of 500. */
export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const TEACHER_TOKEN_HEADER = "x-teacher-token";

export function newTeacherToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Directory record of the signed-in caller (from the Supabase Auth JWT), or null. */
export async function callerPerson(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ id: string; email: string; role: string; full_name: string } | null> {
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return null; // anon key or expired token
  const { data: person } = await supabase
    .from("people")
    .select("id, email, role, full_name")
    .eq("email", email)
    .maybeSingle();
  return (person as { id: string; email: string; role: string; full_name: string } | null) ?? null;
}

/** True when the signed-in caller teaches the course this session belongs to. */
async function isSessionCourseTeacher(req: Request, supabase: SupabaseClient, sessionId: string): Promise<boolean> {
  const me = await callerPerson(req, supabase);
  if (!me || me.role !== "teacher") return false;
  const { data } = await supabase
    .from("sessions")
    .select("course_id, courses!inner(teacher_id)")
    .eq("id", sessionId)
    .maybeSingle();
  const teacherId = (data as { courses?: { teacher_id?: string } } | null)?.courses?.teacher_id;
  return Boolean(teacherId && teacherId === me.id);
}

/**
 * Throws 401/403 unless the caller is this session's teacher: either the signed-in
 * teacher of the session's course, or the per-session teacher key from creation.
 */
export async function requireTeacher(
  req: Request,
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  if (await isSessionCourseTeacher(req, supabase, sessionId)) return;
  const token = req.headers.get(TEACHER_TOKEN_HEADER)?.trim();
  if (!token) throw new HttpError("Teacher access required for this action.", 401);

  const { data, error } = await supabase
    .from("session_secrets")
    .select("teacher_token_hash")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new HttpError("This session has no teacher key. Create a new session.", 403);
  }

  const hash = await hashToken(token);
  if (!timingSafeEqual(hash, data.teacher_token_hash as string)) {
    throw new HttpError("Teacher key does not match this session.", 403);
  }
}

export function statusOf(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  if (err && typeof err === "object" && "issues" in err) return 400; // ZodError
  return 500;
}
