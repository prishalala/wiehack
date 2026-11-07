import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { generateValidatedJson, z } from "./openai.ts";

const TranslationSchema = z.object({
  detected_language: z.string().min(1).max(60),
  language_code: z.string().min(2).max(16),
  is_romanized: z.boolean(),
  is_english: z.boolean(),
  translated_text_en: z.string().min(1).max(4000),
});

export type QuestionRow = Record<string, unknown> & { id: string; text: string };

/**
 * translateQuestionToEnglish: detect the language and translate into English.
 * Updates only the translation columns; `text` (the original) is never touched.
 * On AI failure the row is marked translation_status='failed' and the error is returned.
 */
export async function translateQuestionRow(
  supabase: SupabaseClient,
  question: { id: string; text: string },
  lessonTitle: string,
): Promise<{ row: QuestionRow; error: string | null }> {
  let patch: Record<string, unknown>;
  let failure: string | null = null;

  try {
    const ai = await generateValidatedJson(TranslationSchema, [
      {
        role: "system",
        content:
          "You detect the language of a Grade 5 student's classroom question and translate it into English for the teacher. " +
          "Students may type in any language or script, mix languages, or write a non-Latin language in Latin letters " +
          "(e.g. Hinglish = Hindi written in English letters). " +
          "Return JSON: detected_language (human-readable, e.g. 'Hindi', 'French', 'Hinglish (romanized Hindi)'), " +
          "language_code (ISO 639-1 of the underlying language, e.g. 'hi' for Hinglish), " +
          "is_romanized, is_english (true only if the question is already plain English), " +
          "translated_text_en (a faithful English translation: keep the student's meaning, uncertainty and mistakes; " +
          "do not answer, correct or improve the question; keep numbers and math notation like 1/8 exactly). " +
          "If is_english, translated_text_en is the original text unchanged.",
      },
      {
        role: "user",
        content: `LESSON TOPIC (context only): ${lessonTitle}\nSTUDENT QUESTION:\n${question.text}`,
      },
    ]);

    patch = {
      detected_language: ai.detected_language,
      is_romanized: ai.is_romanized,
      english_gloss: ai.is_english ? question.text : ai.translated_text_en,
      translation_status: ai.is_english ? "not_needed" : "done",
      translation_error: null,
    };
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
    patch = { translation_status: "failed", translation_error: failure.slice(0, 500) };
  }

  const { data, error } = await supabase
    .from("questions")
    .update(patch)
    .eq("id", question.id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to store translation: ${error.message}`);
  return { row: data as QuestionRow, error: failure };
}

/** Strip identity from anonymous questions before returning them to a browser. */
export function safeQuestion(q: QuestionRow): QuestionRow {
  return q.is_anonymous ? { ...q, student_id: null, student_name: null } : q;
}
