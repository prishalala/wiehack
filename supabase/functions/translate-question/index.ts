import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { HttpError, statusOf } from "../_shared/teacher.ts";
import { type QuestionRow, safeQuestion, translateQuestionRow } from "../_shared/translate-question.ts";

/** Retry English translation for one question (e.g. after translation_status = failed). */
const RequestSchema = z.object({
  question_id: z.string().uuid(),
  session_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const input = RequestSchema.parse(await req.json());
    const supabase = createServiceClient();

    const { data: q, error } = await supabase
      .from("questions")
      .select("id, text, session_id, translation_status")
      .eq("id", input.question_id)
      .eq("session_id", input.session_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) throw new HttpError("Question not found in this session", 404);

    const { data: session } = await supabase
      .from("sessions")
      .select("title")
      .eq("id", input.session_id)
      .maybeSingle();

    const { row, error: translationError } = await translateQuestionRow(
      supabase,
      q as QuestionRow,
      (session?.title as string | undefined) ?? "",
    );
    return jsonResponse({ question: safeQuestion(row), translation_error: translationError });
  } catch (err) {
    const message = err instanceof Error ? err.message : "translate-question failed";
    console.error("translate-question", message);
    return errorResponse(message, statusOf(err));
  }
});
