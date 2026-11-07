import type { Activity, Lang, Localized } from "@/types";

/** Sandboxed interactive activity — never allow-same-origin. */
export function ActivityFrame({
  activity,
  lang,
  className,
}: {
  activity: Activity;
  lang?: Lang;
  className?: string;
}) {
  const explanation = pickLocalized(activity.explanation, lang ?? "en");
  return (
    <div className={className}>
      <iframe
        title="Interactive activity"
        srcDoc={activity.html}
        sandbox="allow-scripts"
        className="h-[420px] w-full rounded-xl border bg-card"
        referrerPolicy="no-referrer"
      />
      {explanation && (
        <p className="mt-4 rounded-xl bg-sky-soft p-4 text-[15px] leading-relaxed">{explanation}</p>
      )}
    </div>
  );
}

export function pickLocalized(loc: Localized, lang: string): string {
  return loc[lang] ?? loc["en"] ?? Object.values(loc)[0] ?? "";
}
