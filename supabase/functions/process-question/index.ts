import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { HttpError, statusOf } from "../_shared/teacher.ts";
import { type QuestionRow, safeQuestion, translateQuestionRow } from "../_shared/translate-question.ts";

const RequestSchema = z.object({
  session_id: z.string().uuid(),
  text: z.string().max(2000),
  /** Student's current UI language (independent of the language the question is typed in). */
  student_language: z.string().min(1).max(16),
  student_language_label: z.string().min(1).max(80).optional(),
  student_id: z.string().uuid().nullable().optional(),
  student_name: z.string().max(80).nullable().optional(),
  is_anonymous: z.boolean().optional().default(false),
});

const AnswerSchema = z.object({
  answer: z.string().min(1),
});

/**
 * Pipeline (save-first):
 *  1. store the exact original text (translation_status = pending)
 *  2. detect language + translate to English  -> done | not_needed | failed
 *  3. answer in the student's UI language     -> best effort
 * A failure in step 2 or 3 never loses the question.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const input = RequestSchema.parse(await req.json());
    if (!input.text.trim()) throw new HttpError("Question cannot be empty.", 400);

    const supabase = createServiceClient();

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, notes, notes_localized, title, status")
      .eq("id", input.session_id)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) throw new HttpError("Session not found", 404);
    if (session.status === "ended") throw new HttpError("This session has ended.", 409);

    const isAnonymous = Boolean(input.is_anonymous);
    if (input.student_id) {
      const { data: student, error: stuErr } = await supabase
        .from("students")
        .select("id")
        .eq("id", input.student_id)
        .eq("session_id", input.session_id)
        .maybeSingle();
      if (stuErr) throw new Error(stuErr.message);
      if (!student) throw new HttpError("Student is not part of this session.", 403);
    }

    // 1) Save the original first.
    const { data: inserted, error: insertError } = await supabase
      .from("questions")
      .insert({
        session_id: input.session_id,
        student_id: isAnonymous ? null : (input.student_id ?? null),
        student_name: isAnonymous ? null : (input.student_name?.trim() || null),
        text: input.text,
        is_anonymous: isAnonymous,
        status: "pending",
        translation_status: "pending",
      })
      .select("*")
      .single();
    if (insertError) throw new Error(`Failed to store question: ${insertError.message}`);

    // 2) Translate for the teacher.
    const { row: translated, error: translationError } = await translateQuestionRow(
      supabase,
      inserted as QuestionRow,
      session.title as string,
    );
    let row = translated;

    // 3) Answer for the student, in their current UI language.
    let answerError: string | null = null;
    try {
      const localized = (session.notes_localized as Record<string, string> | null) ?? {};
      const notes = localized[input.student_language] ?? localized.en ?? session.notes ?? "";
      const langLabel =
        input.student_language_label ??
        `language code "${input.student_language}" (use that language's native script when appropriate)`;
      const englishVersion =
        typeof row.english_gloss === "string" && row.english_gloss ? `\nENGLISH TRANSLATION: ${row.english_gloss}` : "";

      const ai = await generateValidatedJson(AnswerSchema, [
        {
          role: "system",
          content:
            "You are a patient Grade 5 classroom assistant. Ground every answer strictly in the lesson notes. " +
            "Return JSON { answer } written in the student's selected UI language, 2-4 short sentences, " +
            "keeping math notation like 1/8 exactly. If the question is off-topic, briefly redirect to the lesson. " +
            "No markdown, no preamble.",
        },
        {
          role: "user",
          content:
            `LESSON TITLE: ${session.title}\nLESSON NOTES:\n${notes}\n\n` +
            `STUDENT UI LANGUAGE: ${langLabel} (code=${input.student_language})\n` +
            `STUDENT QUESTION (original):\n${input.text}${englishVersion}`,
        },
      ]);

      const { data: answered, error: ansErr } = await supabase
        .from("questions")
        .update({
          answer: ai.answer,
          answer_lang: input.student_language,
          answers_localized: { [input.student_language]: ai.answer },
        })
        .eq("id", row.id)
        .select("*")
        .single();
      if (ansErr) throw new Error(ansErr.message);
      row = answered as QuestionRow;
    } catch (err) {
      answerError = err instanceof Error ? err.message : String(err);
      console.warn("process-question answer failed", answerError);
    }

    return jsonResponse({
      question: safeQuestion(row),
      translation_error: translationError,
      answer_error: answerError,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "process-question failed";
    console.error("process-question", message);
    return errorResponse(message, statusOf(err));
  }
});
