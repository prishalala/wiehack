import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { requireTeacher, statusOf } from "../_shared/teacher.ts";

const RequestSchema = z.object({
  misconception_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  langs: z.array(z.string().min(1).max(16)).min(1).max(8).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const input = RequestSchema.parse(await req.json());
    const langs = input.langs?.length ? input.langs : ["en", "hi", "fr", "es", "ar"];
    const supabase = createServiceClient();

    const { data: mis, error: misErr } = await supabase
      .from("misconceptions")
      .select("*")
      .eq("id", input.misconception_id)
      .maybeSingle();
    if (misErr) throw new Error(misErr.message);
    if (!mis) return errorResponse("Misconception not found", 404);

    // Always use the misconception's own session so one session cannot touch another.
    const sessionId = mis.session_id as string;
    if (input.session_id && input.session_id !== sessionId) {
      return errorResponse("Misconception does not belong to this session", 403);
    }
    await requireTeacher(req, supabase, sessionId);
    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("id, title, notes, notes_localized")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessErr) throw new Error(sessErr.message);
    if (!session) return errorResponse("Session not found", 404);

    const notes =
      (session.notes_localized as Record<string, string> | null)?.en ??
      session.notes ??
      "";

    const locString = z.object(
      Object.fromEntries(langs.map((c) => [c, z.string().min(1)])) as Record<string, z.ZodType<string>>,
    );

    const AiSchema = z.object({
      question: locString,
      options: z.array(locString).min(3).max(4),
      correct_index: z.number().int().min(0).max(3),
    });

    const ai = await generateValidatedJson(AiSchema, [
      {
        role: "system",
        content:
          "You write one Grade 5 multiple-choice check for a classroom misconception. " +
          "Return JSON: question (object per language), options (array of 3–4 objects per language), correct_index (0-based). " +
          `Languages: ${langs.join(", ")}. Use native scripts. Keep options short. Exactly one correct answer. ` +
          "Ground the question in the lesson notes. No markdown.",
      },
      {
        role: "user",
        content:
          `LESSON: ${session.title}\nNOTES:\n${notes}\n\n` +
          `MISCONCEPTION: ${mis.label}\n` +
          `Write one MCQ that diagnoses whether a student still holds this misconception.`,
      },
    ]);

    if (ai.correct_index >= ai.options.length) {
      throw new Error("correct_index out of range");
    }

    // Replace existing checks for this misconception (pre+post)
    await supabase
      .from("checks")
      .delete()
      .eq("session_id", sessionId)
      .eq("misconception_id", input.misconception_id);

    const base = {
      session_id: sessionId,
      misconception_id: input.misconception_id,
      question: ai.question,
      options: ai.options,
      correct_index: ai.correct_index,
    };

    const { data: rows, error: insErr } = await supabase
      .from("checks")
      .insert([
        { ...base, phase: "pre" },
        { ...base, phase: "post" },
      ])
      .select("*");
    if (insErr) throw new Error(insErr.message);

    return jsonResponse({
      checks: rows,
      pre: rows?.find((r) => r.phase === "pre") ?? null,
      post: rows?.find((r) => r.phase === "post") ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate-check failed";
    console.error("generate-check", message);
    return errorResponse(message, statusOf(err));
  }
});
