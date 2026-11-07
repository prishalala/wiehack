import { useSyncExternalStore } from "react";
import type { Lang } from "@/types";
import { isKnownLang, LANGUAGES } from "@/lib/languages";

export { LANGUAGES } from "@/lib/languages";

const chrome = {
  en: {
    live: "Live", lesson: "Lesson", currentTopic: "Current topic", notes: "Teacher's notes",
    explainSimply: "Explain simply", askPrivately: "Ask a private question",
    askHint: "Type in any language or script. Only your teacher sees it.",
    placeholder: "What's confusing you?", submit: "Submit question", yourQuestions: "Your questions",
    noQuestions: "No questions yet. Nothing is too small to ask.", pending: "Waiting", answered: "Answered", seen: "Seen by teacher",
    explanation: "Explanation for you", moreSimply: "Explain more simply", example: "Give me an example",
    loading: "Preparing your explanation…", error: "Couldn't load the explanation.", retry: "Try again",
    sharedActivity: "Activity from your teacher", noActivity: "When your teacher shares an activity, it will appear here.",
    quiz: "Quick check", done: "Activity complete", tryAgain: "Try again", chars: "characters",
    leave: "Leave", hello: "Hi", sample: "Sample explanation",
    whole: "Same-size whole", pieceOf: "One piece of", compare: "Compare", isBigger: "is bigger than",
    translating: "Translating lesson…",
  },
  hi: {
    live: "लाइव", lesson: "पाठ", currentTopic: "वर्तमान विषय", notes: "शिक्षक के नोट्स",
    explainSimply: "आसान भाषा में समझाएँ", askPrivately: "निजी प्रश्न पूछें",
    askHint: "किसी भी भाषा या लिपि में लिखें। केवल आपके शिक्षक इसे देखेंगे।",
    placeholder: "आपको क्या समझ नहीं आ रहा?", submit: "प्रश्न भेजें", yourQuestions: "आपके प्रश्न",
    noQuestions: "अभी कोई प्रश्न नहीं। कोई भी प्रश्न छोटा नहीं होता।", pending: "प्रतीक्षा में", answered: "उत्तर दिया गया", seen: "शिक्षक ने देखा",
    explanation: "आपके लिए व्याख्या", moreSimply: "और आसान भाषा में", example: "एक उदाहरण दें",
    loading: "आपकी व्याख्या तैयार हो रही है…", error: "व्याख्या लोड नहीं हो सकी।", retry: "फिर कोशिश करें",
    sharedActivity: "आपके शिक्षक की गतिविधि", noActivity: "जब शिक्षक कोई गतिविधि साझा करेंगे, वह यहाँ दिखेगी।",
    quiz: "छोटी जाँच", done: "गतिविधि पूरी हुई", tryAgain: "फिर कोशिश करें", chars: "अक्षर",
    leave: "बाहर जाएँ", hello: "नमस्ते", sample: "नमूना व्याख्या",
    whole: "एक जैसा पूरा", pieceOf: "एक टुकड़ा", compare: "तुलना", isBigger: "बड़ा है",
    translating: "पाठ अनुवाद हो रहा है…",
  },
  fr: {
    live: "En direct", lesson: "Leçon", currentTopic: "Sujet actuel", notes: "Notes de l'enseignant",
    explainSimply: "Explique simplement", askPrivately: "Poser une question privée",
    askHint: "Écris dans n'importe quelle langue. Seul ton enseignant la verra.",
    placeholder: "Qu'est-ce qui te pose problème ?", submit: "Envoyer la question", yourQuestions: "Tes questions",
    noQuestions: "Aucune question pour l'instant.", pending: "En attente", answered: "Répondu", seen: "Vue par l'enseignant",
    explanation: "Explication pour toi", moreSimply: "Explique plus simplement", example: "Donne-moi un exemple",
    loading: "Préparation de ton explication…", error: "Impossible de charger l'explication.", retry: "Réessayer",
    sharedActivity: "Activité de ton enseignant", noActivity: "Quand ton enseignant partagera une activité, elle apparaîtra ici.",
    quiz: "Petite vérification", done: "Activité terminée", tryAgain: "Réessayer", chars: "caractères",
    leave: "Quitter", hello: "Salut", sample: "Explication exemple",
    whole: "Tout de même taille", pieceOf: "Une part de", compare: "Comparer", isBigger: "est plus grand que",
    translating: "Traduction de la leçon…",
  },
} as const;

export type DictKey = keyof (typeof chrome)["en"];

/** Chrome UI strings: en/hi/fr localized; all other langs fall back to English. */
export const t = (lang: Lang, key: DictKey): string => {
  const table = (chrome as Record<string, Record<string, string>>)[lang];
  return table?.[key] ?? chrome.en[key];
};

/** Fallback static lesson (used only when AI translation is not yet available). */
export const lessonContent: Record<string, { topic: string; sections: { heading: string; body: string }[] }> = {
  en: {
    topic: "Comparing unit fractions",
    sections: [
      { heading: "What is a fraction?", body: "A fraction shows part of a whole. In 3/4, the whole is divided into 4 equal parts, and we have 3 of them." },
      { heading: "Numerator and denominator", body: "The top number is the numerator — how many parts we have. The bottom number is the denominator — how many equal parts make the whole." },
      { heading: "Comparing 1/4 and 1/8", body: "If two wholes are the same size, cutting one into more parts makes each part smaller. That is why 1/8 is smaller than 1/4." },
    ],
  },
};

export type ExplanationLevel = "standard" | "simple" | "example";
export const explanations: Record<string, Record<ExplanationLevel, string[]>> = {
  en: {
    standard: ["The denominator tells you how many equal parts the whole is split into.", "More parts means each part is smaller.", "So when the numerators are the same, the fraction with the bigger denominator is smaller: 1/8 < 1/4."],
    simple: ["Imagine one chocolate bar.", "Share it with 4 friends — everyone gets a big piece.", "Share it with 8 friends — everyone gets a small piece.", "More friends sharing = smaller piece."],
    example: ["Two identical pizzas.", "Pizza A is cut into 4 slices. Pizza B into 8 slices.", "One slice of A = 1/4. One slice of B = 1/8.", "Put them side by side: two slices of B fit inside one slice of A. So 1/4 = 2/8, and 1/4 > 1/8."],
  },
};

const LANG_KEY = "classbridge:lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  const v = typeof window === "undefined" ? null : window.localStorage.getItem(LANG_KEY);
  if (v && isKnownLang(v)) return v;
  return "en";
}

export function setLang(lang: Lang) {
  if (!isKnownLang(lang)) return;
  window.localStorage.setItem(LANG_KEY, lang);
  listeners.forEach((l) => l());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readLang,
    () => "en",
  );
}

export function langNative(code: Lang): string {
  return LANGUAGES.find((l) => l.code === code)?.native ?? code;
}
