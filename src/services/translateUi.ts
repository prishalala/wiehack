/**
 * Batch-translate short UI / content strings via the translate-strings edge function
 * (structured JSON array — reliable for every language, not just en/hi/fr/es).
 */
import { invokeFunction } from "@/lib/supabase";
import { languageLabel } from "@/lib/languages";

function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** True when a translated pack is still mostly English (bad/partial cache). */
export function looksUntranslated(source: string[], translated: string[]): boolean {
  if (!translated.length || translated.length !== source.length) return true;
  let same = 0;
  let compared = 0;
  for (let i = 0; i < source.length; i++) {
    const a = oneLine(source[i] ?? "");
    const b = oneLine(translated[i] ?? "");
    if (!a) continue;
    compared += 1;
    if (a === b) same += 1;
  }
  if (!compared) return false;
  // More than 35% unchanged → treat as failed translation for non-English targets.
  return same / compared > 0.35;
}

async function translateChunk(lang: string, lines: string[]): Promise<string[]> {
  const result = await invokeFunction<{ translations?: string[] }>("translate-strings", {
    texts: lines,
    target_lang: lang,
    target_label: languageLabel(lang),
  });
  const out = result.translations;
  if (!Array.isArray(out) || out.length !== lines.length) {
    throw new Error(`translate-strings returned ${out?.length ?? 0} items, expected ${lines.length}`);
  }
  return out.map((s, i) => (typeof s === "string" && s.trim() ? s.trim() : lines[i]!));
}

export async function translateUiTexts(lang: string, texts: string[]): Promise<string[]> {
  if (!texts.length || lang === "en") return texts;

  const indexed = texts.map((t, i) => ({ i, t: oneLine(t) }));
  const nonEmpty = indexed.filter((x) => x.t.length > 0);
  if (!nonEmpty.length) return texts;

  const CHUNK = 20;
  const next = [...texts];

  for (let start = 0; start < nonEmpty.length; start += CHUNK) {
    const chunk = nonEmpty.slice(start, start + CHUNK);
    const lines = chunk.map((x) => x.t);
    try {
      let translated = await translateChunk(lang, lines);
      if (looksUntranslated(lines, translated)) {
        // Retry smaller — rate limits / weak models sometimes echo English.
        translated = [];
        for (let i = 0; i < chunk.length; i += 5) {
          const mini = chunk.slice(i, i + 5);
          const part = await translateChunk(
            lang,
            mini.map((x) => x.t),
          );
          translated.push(...part);
        }
      }
      chunk.forEach((x, j) => {
        next[x.i] = translated[j] || texts[x.i]!;
      });
    } catch (err) {
      console.warn("translateUiTexts chunk failed", err);
      // Last resort: one at a time for this chunk
      for (const item of chunk) {
        try {
          const [one] = await translateChunk(lang, [item.t]);
          next[item.i] = one || texts[item.i]!;
        } catch (inner) {
          console.warn("translateUiTexts single failed", inner);
        }
      }
    }
  }

  return next;
}
