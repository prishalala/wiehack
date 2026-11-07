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

/** Throws 401/403 unless the request carries the teacher token for this session. */
export async function requireTeacher(
  req: Request,
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
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
