import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { HttpError, hashToken, newTeacherToken, requireTeacher, statusOf } from "../_shared/teacher.ts";

/**
 * Teacher-only session operations. `create` issues a teacher token (returned once,
 * stored hashed); every other action requires it in the x-teacher-token header.
 */
const RequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().trim().min(1).max(200),
    subject: z.string().max(120).default(""),
    notes: z.string().max(20000).default(""),
  }),
  z.object({
    action: z.literal("set_status"),
    session_id: z.string().uuid(),
    status: z.enum(["draft", "live", "ended"]),
  }),
  z.object({
    action: z.literal("mark_answered"),
    session_id: z.string().uuid(),
    question_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("share_activity"),
    session_id: z.string().uuid(),
    activity_id: z.string().uuid(),
  }),
]);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateJoinCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const input = RequestSchema.parse(await req.json());
    const supabase = createServiceClient();

    if (input.action === "create") {
      let session: Record<string, unknown> | null = null;
      for (let attempt = 0; attempt < 5 && !session; attempt++) {
        const { data, error } = await supabase
          .from("sessions")
          .insert({
            code: generateJoinCode(),
            title: input.title,
            subject: input.subject,
            notes: input.notes,
            status: "draft",
            notes_localized: input.notes.trim() ? { en: input.notes } : null,
          })
          .select("*")
          .single();
        if (!error) session = data;
        else if (error.code !== "23505") throw new Error(error.message);
      }
      if (!session) throw new Error("Could not allocate a unique join code");

      const token = newTeacherToken();
      const { error: secretErr } = await supabase
        .from("session_secrets")
        .insert({ session_id: session.id, teacher_token_hash: await hashToken(token) });
      if (secretErr) {
        await supabase.from("sessions").delete().eq("id", session.id);
        throw new Error(`Failed to store teacher key: ${secretErr.message}`);
      }
      return jsonResponse({ session, teacher_token: token });
    }

    await requireTeacher(req, supabase, input.session_id);

    if (input.action === "set_status") {
      const patch: Record<string, unknown> = { status: input.status };
      if (input.status === "live") patch.started_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .update(patch)
        .eq("id", input.session_id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return jsonResponse({ session: data });
    }

    if (input.action === "mark_answered") {
      const { data, error } = await supabase
        .from("questions")
        .update({ status: "answered" })
        .eq("id", input.question_id)
        .eq("session_id", input.session_id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new HttpError("Question not found in this session", 404);
      return jsonResponse({ ok: true });
    }

    // share_activity
    const { data, error } = await supabase
      .from("activities")
      .update({ shared: true })
      .eq("id", input.activity_id)
      .eq("session_id", input.session_id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new HttpError("Activity not found in this session", 404);
    return jsonResponse({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "teacher-session failed";
    console.error("teacher-session", message);
    return errorResponse(message, statusOf(err));
  }
});
