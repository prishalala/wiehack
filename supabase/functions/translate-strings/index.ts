import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { generateValidatedJson, z } from "../_shared/openai.ts";

const RequestSchema = z.object({
  texts: z.array(z.string()).min(1).max(40),
  target_lang: z.string().min(1).max(16),
  /** Optional human label for the language (helps the model pick the right script). */
  target_label: z.string().min(1).max(64).optional(),
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
    const lang = body.target_lang.toLowerCase();
    const label = body.target_label ?? lang;
    const n = body.texts.length;

    const schema = z.object({
      translations: z.array(z.string()).length(n),
    });

    const result = await generateValidatedJson(schema, [
      {
        role: "system",
        content:
          "You translate short classroom UI labels for students and parents. " +
          "Return JSON: { \"translations\": string[] } with exactly the same number of items, same order. " +
          "Use the native script for the target language. Keep {placeholders} like {child} unchanged. " +
          "Do not add numbering, quotes around each item, or commentary.",
      },
      {
        role: "user",
        content:
          `Translate each string into ${label} (language code: ${lang}).\n` +
          `Return exactly ${n} translations.\n\n` +
          JSON.stringify({ texts: body.texts }),
      },
    ]);

    return jsonResponse({ translations: result.translations, language: lang });
  } catch (err) {
    const message = err instanceof Error ? err.message : "translate-strings failed";
    console.error("translate-strings", message);
    return errorResponse(message, 500);
  }
});
