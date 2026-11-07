import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

/**
 * Free / no-OpenAI-billing providers (OpenAI-compatible chat completions):
 * 1) Groq — set GROQ_API_KEY (free tier at console.groq.com)
 * 2) Lovable gateway — set LOVABLE_API_KEY (project credits, no provider key)
 * 3) OpenAI — set OPENAI_API_KEY (paid)
 *
 * Optional overrides: AI_BASE_URL, AI_API_KEY, AI_MODEL
 */
export function getAiConfig() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const explicitKey = Deno.env.get("AI_API_KEY");
  const explicitUrl = Deno.env.get("AI_BASE_URL");
  const explicitModel = Deno.env.get("AI_MODEL");

  if (explicitKey && explicitUrl) {
    return {
      apiKey: explicitKey,
      url: explicitUrl,
      model: explicitModel ?? "openai/gpt-oss-20b",
      provider: "custom",
    };
  }

  if (groqKey) {
    return {
      apiKey: groqKey,
      url: explicitUrl ?? "https://api.groq.com/openai/v1/chat/completions",
      model: explicitModel ?? "openai/gpt-oss-20b",
      provider: "groq",
    };
  }

  if (lovableKey) {
    return {
      apiKey: lovableKey,
      url: explicitUrl ?? "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: explicitModel ?? "google/gemini-2.5-flash",
      provider: "lovable",
    };
  }

  if (openaiKey) {
    return {
      apiKey: openaiKey,
      url: explicitUrl ?? "https://api.openai.com/v1/chat/completions",
      model: explicitModel ?? "gpt-4o-mini",
      provider: "openai",
    };
  }

  throw new Error(
    "No AI key set. For free usage: npx supabase secrets set GROQ_API_KEY=... (get one at https://console.groq.com)",
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse "try again in 2.4s" / Retry-After from Groq-style 429 bodies. */
function rateLimitWaitMs(status: number, detail: string, retryAfterHeader: string | null): number | null {
  if (status !== 429) return null;
  if (retryAfterHeader) {
    const sec = Number(retryAfterHeader);
    if (!Number.isNaN(sec) && sec > 0) return Math.ceil(sec * 1000) + 250;
  }
  const m = detail.match(/try again in\s+([\d.]+)\s*s/i);
  if (m?.[1]) return Math.ceil(Number(m[1]) * 1000) + 500;
  return 3000;
}

class AiHttpError extends Error {
  status: number;
  waitMs: number | null;
  constructor(message: string, status: number, waitMs: number | null) {
    super(message);
    this.status = status;
    this.waitMs = waitMs;
  }
}

/**
 * Call an OpenAI-compatible chat API for structured JSON, validate with Zod.
 * Retries once on validation failure; on 429 waits (Groq TPM) then retries up to twice.
 */
export async function generateValidatedJson<T>(
  schema: z.ZodType<T>,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<T> {
  const { apiKey, url, model, provider } = getAiConfig();

  async function once(): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      const waitMs = rateLimitWaitMs(res.status, detail, res.headers.get("retry-after"));
      throw new AiHttpError(
        res.status === 429
          ? `AI rate limit (free tier). Wait a few seconds and try again. (${provider})`
          : `AI request failed via ${provider} (${res.status}): ${detail}`,
        res.status,
        waitMs,
      );
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("AI returned an empty response");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("AI returned invalid JSON");
    }

    return schema.parse(parsed);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await once();
    } catch (err) {
      lastError = err;
      if (err instanceof AiHttpError && err.status === 429 && attempt < 2) {
        await sleep(err.waitMs ?? 3000);
        continue;
      }
      // One immediate retry for non-429 validation/parse failures
      if (!(err instanceof AiHttpError) && attempt === 0) {
        continue;
      }
      break;
    }
  }

  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(msg);
}

export { z };
