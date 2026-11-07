import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { requireTeacher, statusOf } from "../_shared/teacher.ts";

const RequestSchema = z.object({
  session_id: z.string().uuid(),
});

const ClusterSchema = z.object({
  label: z.string().min(1).max(160),
  confidence: z.number().min(0).max(1),
  question_ids: z.array(z.string().uuid()).min(2),
  languages: z.array(z.string()).min(1),
  suggested_intervention: z.string().min(1),
});

const AiOutputSchema = z.object({
  misconceptions: z.array(ClusterSchema),
  unclustered: z.array(z.string().uuid()),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const { session_id } = RequestSchema.parse(await req.json());
    const supabase = createServiceClient();
    await requireTeacher(req, supabase, session_id);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, title, notes, notes_localized")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return errorResponse("Session not found", 404);

    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("id, text, detected_language, english_gloss, translation_status, is_romanized")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true });
    if (qError) throw new Error(qError.message);

    const questionRows = questions ?? [];
    if (questionRows.length < 2) {
      // Clear previous clusters when not enough signal
      await supabase.from("questions").update({ misconception_id: null, status: "pending" }).eq("session_id", session_id);
      await supabase.from("misconceptions").delete().eq("session_id", session_id);
      return jsonResponse({ misconceptions: [], unclustered: questionRows.map((q) => q.id) });
    }

    const { data: previous, error: prevError } = await supabase
      .from("misconceptions")
      .select("id, label, confidence, question_ids, languages, suggested_intervention")
      .eq("session_id", session_id);
    if (prevError) throw new Error(prevError.message);

    const notes =
      (session.notes_localized as Record<string, string> | null)?.en ??
      session.notes ??
      "";

    const validIds = new Set(questionRows.map((q) => q.id as string));

    const ai = await generateValidatedJson(AiOutputSchema, [
      {
        role: "system",
        content:
          "You are an expert Grade 5 classroom teacher analyzing live student questions. " +
          "Group questions by the shared underlying conceptual misunderstanding — NOT by surface wording, language, or script. " +
          "Romanized Hindi / Hinglish / French / English asking the same idea belong together. " +
          "Exclude off-topic or logistical questions (bathroom, wifi, page number, etc.) — put those ids in unclustered. " +
          "Only report a misconception if at least 2 question_ids support it. " +
          "For each misconception provide: concise teacher-facing label, confidence 0-1, question_ids, languages (detected language labels), " +
          "and a specific suggested_intervention (an interactive activity idea a teacher can run now). " +
          "If previous misconceptions are provided, reuse stable labels when the same idea reappears. " +
          "Return JSON only: { misconceptions: [...], unclustered: [...] }.",
      },
      {
        role: "user",
        content:
          `LESSON: ${session.title}\nNOTES:\n${notes}\n\n` +
          `PREVIOUS MISCONCEPTIONS (keep labels stable when possible):\n${JSON.stringify(previous ?? [])}\n\n` +
          `QUESTIONS:\n${JSON.stringify(questionRows)}`,
      },
    ]);

    // Sanitize: only known question ids, enforce ≥2 support
    const cleaned = ai.misconceptions
      .map((m) => ({
        ...m,
        question_ids: [...new Set(m.question_ids.filter((id) => validIds.has(id)))],
      }))
      .filter((m) => m.question_ids.length >= 2);

    const clustered = new Set(cleaned.flatMap((m) => m.question_ids));
    const unclustered = [
      ...new Set([
        ...ai.unclustered.filter((id) => validIds.has(id) && !clustered.has(id)),
        ...questionRows.map((q) => q.id as string).filter((id) => !clustered.has(id)),
      ]),
    ];

    // Replace session rows atomically-ish
    await supabase.from("questions").update({ misconception_id: null }).eq("session_id", session_id);
    await supabase.from("misconceptions").delete().eq("session_id", session_id);

    const inserted: Array<Record<string, unknown>> = [];
    for (const m of cleaned) {
      const { data: row, error: insertError } = await supabase
        .from("misconceptions")
        .insert({
          session_id,
          label: m.label,
          confidence: m.confidence,
          question_ids: m.question_ids,
          languages: m.languages,
          suggested_intervention: m.suggested_intervention,
        })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      inserted.push(row);

      const { error: linkError } = await supabase
        .from("questions")
        .update({ misconception_id: row.id, status: "analyzed" })
        .in("id", m.question_ids);
      if (linkError) throw new Error(linkError.message);
    }

    if (unclustered.length) {
      await supabase
        .from("questions")
        .update({ status: "pending", misconception_id: null })
        .in("id", unclustered);
    }

    return jsonResponse({ misconceptions: inserted, unclustered });
  } catch (err) {
    const message = err instanceof Error ? err.message : "analyze-misconceptions failed";
    console.error("analyze-misconceptions", message);
    return errorResponse(message, statusOf(err));
  }
});
