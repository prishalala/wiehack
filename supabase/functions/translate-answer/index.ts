import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const RequestSchema = z.object({
  question_id: z.string().uuid(),
  target_lang: z.string().min(1).max(16),
  target_lang_label: z.string().min(1).max(80).optional(),
});

const AiSchema = z.object({
  text: z.string().min(1),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const input = RequestSchema.parse(await req.json());
    const supabase = createServiceClient();

    const { data: q, error } = await supabase
      .from("questions")
      .select("id, answer, answer_lang, answers_localized, english_gloss, text")
      .eq("id", input.question_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!q) return errorResponse("Question not found", 404);

    const existing = (q.answers_localized as Record<string, string> | null) ?? {};
    if (existing[input.target_lang]?.trim()) {
      return jsonResponse({
        text: existing[input.target_lang],
        answers_localized: existing,
        cached: true,
      });
    }

    const source =
      (q.answer_lang && existing[q.answer_lang]) ||
      q.answer ||
      q.english_gloss ||
      "";
    if (!source.trim()) return errorResponse("No answer to translate", 400);

    const label = input.target_lang_label ?? input.target_lang;
    const ai = await generateValidatedJson(AiSchema, [
      {
        role: "system",
        content:
          "You translate a short Grade 5 tutoring answer into the student's language. " +
          "Preserve math notation. Return JSON { text }. No markdown, no preamble.",
      },
      {
        role: "user",
        content:
          `TARGET LANGUAGE: ${label} (code=${input.target_lang})\n` +
          `STUDENT QUESTION (context only):\n${q.text}\n\n` +
          `ANSWER TO TRANSLATE:\n${source}`,
      },
    ]);

    const answers_localized = { ...existing, [input.target_lang]: ai.text };
    // Keep primary answer as original; cache translations
    const { error: upErr } = await supabase
      .from("questions")
      .update({ answers_localized })
      .eq("id", input.question_id);
    if (upErr) throw new Error(upErr.message);

    return jsonResponse({ text: ai.text, answers_localized, cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "translate-answer failed";
    console.error("translate-answer", message);
    return errorResponse(message, 500);
  }
});
