import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const RequestSchema = z.object({
  session_id: z.string().uuid().optional(),
  notes: z.string().min(1).optional(),
  language: z.string().min(1).max(16),
  language_label: z.string().min(1).max(80).optional(),
  level: z.enum(["standard", "simple", "example"]).optional().default("simple"),
});

const AiSchema = z.object({
  lines: z.array(z.string().min(1)).min(2).max(8),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const input = RequestSchema.parse(await req.json());
    let notes = input.notes ?? "";

    if (input.session_id) {
      const supabase = createServiceClient();
      const { data: session, error } = await supabase
        .from("sessions")
        .select("notes, notes_localized")
        .eq("id", input.session_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!session) return errorResponse("Session not found", 404);
      const loc = (session.notes_localized as Record<string, string> | null) ?? {};
      notes =
        loc[input.language] ??
        loc.en ??
        session.notes ??
        notes;
    }

    if (!notes.trim()) return errorResponse("No lesson notes to explain", 400);

    const langLabel = input.language_label ?? input.language;
    const levelHint =
      input.level === "example"
        ? "Use a concrete everyday example (pizza, chocolate, friends sharing)."
        : input.level === "standard"
          ? "Clear standard explanation."
          : "Explain more simply, shorter sentences, no jargon.";

    const ai = await generateValidatedJson(AiSchema, [
      {
        role: "system",
        content:
          "You rewrite classroom lesson notes into a simpler student-facing explanation. " +
          `Write entirely in ${langLabel} (code=${input.language}). ` +
          "Return JSON { lines: string[] } — 2 to 6 short bullet lines. Grade 5. No markdown.",
      },
      {
        role: "user",
        content: `LEVEL: ${input.level}. ${levelHint}\n\nLESSON NOTES:\n${notes}`,
      },
    ]);

    return jsonResponse({ lines: ai.lines, language: input.language });
  } catch (err) {
    const message = err instanceof Error ? err.message : "explain-simpler failed";
    console.error("explain-simpler", message);
    return errorResponse(message, 500);
  }
});
