import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";
import { createServiceClient } from "../_shared/supabase.ts";

const RequestSchema = z.object({
  session_id: z.string().uuid().optional(),
  notes: z.string().min(1).optional(),
  /** One or more BCP-47-ish codes to translate into (e.g. ["es","hi"]). */
  target_langs: z.array(z.string().min(1).max(16)).min(1).max(12).optional(),
  /** Convenience single-target (merged into target_langs). */
  target_lang: z.string().min(1).max(16).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const body = RequestSchema.parse(await req.json());
    const targets = [
      ...new Set([...(body.target_langs ?? []), ...(body.target_lang ? [body.target_lang] : [])]),
    ].map((t) => t.toLowerCase());

    const langs = targets.length ? targets : ["en", "hi", "fr"];
    const supabase = body.session_id ? createServiceClient() : null;

    let notes = body.notes ?? "";
    let existing: Record<string, string> = {};

    if (supabase && body.session_id) {
      const { data: session, error } = await supabase
        .from("sessions")
        .select("notes, notes_localized")
        .eq("id", body.session_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!session) return errorResponse("Session not found", 404);
      // Stored notes only: a browser must not be able to overwrite another session's lesson text.
      notes = session.notes || "";
      existing = (session.notes_localized as Record<string, string> | null) ?? {};
    }

    if (!notes.trim()) return errorResponse("No lesson notes to translate", 400);

    // Skip AI for langs already cached
    const missing = langs.filter((l) => !existing[l]?.trim());
    let localized: Record<string, string> = { ...existing };

    if (missing.length) {
      // Dynamic object: one string field per missing language code
      const shape: Record<string, z.ZodType<string>> = {};
      for (const code of missing) shape[code] = z.string().min(1);
      const schema = z.object(shape);

      const translated = await generateValidatedJson(schema, [
        {
          role: "system",
          content:
            "You translate classroom lesson notes for multilingual students. " +
            `Return JSON with exactly these keys: ${missing.join(", ")}. ` +
            "Preserve meaning, keep math notation intact, Grade 5 reading level. No commentary.",
        },
        {
          role: "user",
          content:
            `Translate these lesson notes into: ${missing.join(", ")}.\n` +
            `Use the native script for each language when appropriate.\n\nNOTES:\n${notes}`,
        },
      ]);

      localized = { ...localized, ...translated };
    }

    if (supabase && body.session_id) {
      const { error } = await supabase
        .from("sessions")
        .update({ notes_localized: localized })
        .eq("id", body.session_id);
      if (error) throw new Error(`Failed to store notes_localized: ${error.message}`);
    }

    return jsonResponse({ notes_localized: localized });
  } catch (err) {
    const message = err instanceof Error ? err.message : "translate-lesson failed";
    console.error("translate-lesson", message);
    return errorResponse(message, 500);
  }
});
