import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { requireTeacher, statusOf } from "../_shared/teacher.ts";

const RequestSchema = z.object({
  misconception_id: z.string().uuid(),
  session_id: z.string().uuid().optional(),
  /** Language codes for the explanation text (HTML stays language-neutral). */
  langs: z.array(z.string().min(1).max(16)).min(1).max(8).optional(),
  regenerate: z.boolean().optional(),
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

    const explanationShape: Record<string, z.ZodType<string>> = {};
    for (const code of langs) explanationShape[code] = z.string().min(1);
    const AiSchema = z.object({
      html: z.string().min(50),
      explanation: z.object(explanationShape),
    });

    const ai = await generateValidatedJson(AiSchema, [
      {
        role: "system",
        content:
          "You create a single self-contained interactive HTML mini-lesson for Grade 5 students. " +
          "Return JSON with keys html and explanation. " +
          "html MUST be a full HTML document with inline <style> and <script> only — no external URLs, no CDN, no fetch/XHR/WebSocket, no iframes, no network. " +
          "Make it responsive, accessible (labels, keyboard), and interactive (sliders, buttons, and/or drag) to visually demonstrate the correct concept. " +
          "Text inside the HTML must be minimal and language-neutral (numbers, symbols, +, =). " +
          `explanation is an object with keys ${langs.join(", ")} — short teacher/student explanation of what the activity shows, in each language's native script. ` +
          "No markdown fences in html.",
      },
      {
        role: "user",
        content:
          `LESSON: ${session.title}\nNOTES:\n${notes}\n\n` +
          `MISCONCEPTION LABEL: ${mis.label}\n` +
          `INTERVENTION IDEA: ${mis.suggested_intervention}\n` +
          `Build an interactive activity that corrects this misconception.`,
      },
    ]);

    // Basic safety: strip obvious external references
    let html = ai.html.trim();
    if (!/^<!DOCTYPE html>/i.test(html) && !/^<html[\s>]/i.test(html)) {
      html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Activity</title></head><body>${html}</body></html>`;
    }
    if (/https?:\/\//i.test(html) || /src\s*=\s*["']\/\//i.test(html)) {
      throw new Error("Generated HTML contained external URLs; refused for safety. Regenerate.");
    }

    if (input.regenerate) {
      await supabase
        .from("activities")
        .delete()
        .eq("session_id", sessionId)
        .eq("misconception_id", input.misconception_id);
    }

    const { data: activity, error: insErr } = await supabase
      .from("activities")
      .insert({
        session_id: sessionId,
        misconception_id: input.misconception_id,
        html,
        explanation: ai.explanation,
        shared: false,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    return jsonResponse({ activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : "generate-activity failed";
    console.error("generate-activity", message);
    return errorResponse(message, statusOf(err));
  }
});
