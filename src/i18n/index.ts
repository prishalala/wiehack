import { useEffect, useState, useSyncExternalStore } from "react";
import type { Lang } from "@/types";
import { isKnownLang, LANGUAGES } from "@/lib/languages";
import { looksUntranslated, translateUiTexts } from "@/services/translateUi";

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
    noLessonContent: "Your instructor hasn't made any lesson content available yet.",
    noExplanation: "Explanations appear once your instructor shares lesson notes.",
    myCourses: "My courses", coursesHint: "Courses you're enrolled in this term.", liveNow: "Live now", joinLive: "Join live lesson",
    noLive: "No live lesson right now", homework: "Homework", quizzes: "Quizzes & tests", grades: "Grades", due: "Due",
    submitHw: "Submit homework", resubmit: "Update submission", submitted: "Submitted", graded: "Graded", notSubmitted: "Not submitted",
    noHomework: "No homework assigned yet.", noQuizzes: "No quizzes or tests yet.", noGrades: "No grades released yet.",
    startQuiz: "Start", submitQuiz: "Submit answers", yourScore: "Auto-marked score", awaitingRelease: "Final grade appears when your teacher releases it.",
    answerHere: "Your answer", marks: "marks", signOut: "Sign out", backToCourses: "All courses", feedback: "Teacher feedback",
    joining: "Joining…", noCourses: "You aren't enrolled in any courses yet.", released: "Released",
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
    noLessonContent: "आपके शिक्षक ने अभी कोई पाठ सामग्री उपलब्ध नहीं कराई है।",
    noExplanation: "जब शिक्षक पाठ नोट्स साझा करेंगे, व्याख्या यहाँ दिखेगी।",
    myCourses: "मेरे पाठ्यक्रम", coursesHint: "इस सत्र में आपके नामांकित पाठ्यक्रम।", liveNow: "अभी लाइव", joinLive: "लाइव पाठ में जुड़ें",
    noLive: "अभी कोई लाइव पाठ नहीं", homework: "गृहकार्य", quizzes: "क्विज़ और टेस्ट", grades: "अंक", due: "अंतिम तिथि",
    submitHw: "गृहकार्य जमा करें", resubmit: "जमा किया गया बदलें", submitted: "जमा किया", graded: "जाँचा गया", notSubmitted: "जमा नहीं किया",
    noHomework: "अभी कोई गृहकार्य नहीं।", noQuizzes: "अभी कोई क्विज़ या टेस्ट नहीं।", noGrades: "अभी कोई अंक जारी नहीं हुए।",
    startQuiz: "शुरू करें", submitQuiz: "उत्तर जमा करें", yourScore: "स्वतः जाँचे गए अंक", awaitingRelease: "अंतिम अंक शिक्षक के जारी करने पर दिखेंगे।",
    answerHere: "आपका उत्तर", marks: "अंक", signOut: "साइन आउट", backToCourses: "सभी पाठ्यक्रम", feedback: "शिक्षक की टिप्पणी",
    joining: "जुड़ रहे हैं…", noCourses: "आप अभी किसी पाठ्यक्रम में नामांकित नहीं हैं।", released: "जारी",
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
    noLessonContent: "Ton enseignant n'a pas encore partagé de contenu de leçon.",
    noExplanation: "Les explications apparaîtront quand ton enseignant partagera des notes.",
    myCourses: "Mes cours", coursesHint: "Les cours auxquels tu es inscrit ce trimestre.", liveNow: "En direct", joinLive: "Rejoindre la leçon",
    noLive: "Pas de leçon en direct", homework: "Devoirs", quizzes: "Quiz et tests", grades: "Notes", due: "À rendre",
    submitHw: "Rendre le devoir", resubmit: "Modifier le rendu", submitted: "Rendu", graded: "Corrigé", notSubmitted: "Non rendu",
    noHomework: "Aucun devoir pour l'instant.", noQuizzes: "Aucun quiz ni test pour l'instant.", noGrades: "Aucune note publiée.",
    startQuiz: "Commencer", submitQuiz: "Envoyer les réponses", yourScore: "Score corrigé automatiquement", awaitingRelease: "La note finale apparaîtra quand ton enseignant la publiera.",
    answerHere: "Ta réponse", marks: "points", signOut: "Se déconnecter", backToCourses: "Tous les cours", feedback: "Commentaire de l'enseignant",
    joining: "Connexion…", noCourses: "Tu n'es inscrit à aucun cours pour l'instant.", released: "Publiée",
  },
} as const;

export type DictKey = keyof (typeof chrome)["en"];

type BuiltInChrome = keyof typeof chrome;
const builtInChrome = (lang: string): lang is BuiltInChrome => lang === "en" || lang === "hi" || lang === "fr";

/** AI-filled UI labels for languages beyond the built-in en/hi/fr dictionaries. */
const remoteChrome: Record<string, Partial<Record<DictKey, string>>> = {};
let chromeTick = 0;

/** Chrome UI strings: en/hi/fr built-in; other langs use AI translation (or English until ready). */
export const t = (lang: Lang, key: DictKey): string => {
  if (builtInChrome(lang)) return chrome[lang][key];
  return remoteChrome[lang]?.[key] ?? chrome.en[key];
};

export type ExplanationLevel = "standard" | "simple" | "example";

const LANG_KEY = "classbridge:lang";
const listeners = new Set<() => void>();

function readLang(): Lang {
  const v = typeof window === "undefined" ? null : window.localStorage.getItem(LANG_KEY);
  if (v && isKnownLang(v)) return v;
  return "en";
}

function notify() {
  listeners.forEach((l) => l());
}

export function setLang(lang: Lang) {
  if (!isKnownLang(lang)) return;
  window.localStorage.setItem(LANG_KEY, lang);
  notify();
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

/** Ensures student UI chrome exists for `lang`. Call once under LanguageProvider / student shell. */
export function useChromeStrings(lang: Lang): boolean {
  const [ready, setReady] = useState(() => builtInChrome(lang) || !!remoteChrome[lang]);
  useEffect(() => {
    if (builtInChrome(lang) || remoteChrome[lang]) {
      setReady(true);
      return;
    }
    setReady(false);
    const cacheKey = `classbridge:chrome-ui:v2:${lang}`;
    const keys = Object.keys(chrome.en) as DictKey[];
    const english = keys.map((k) => chrome.en[k]);
    try {
      const saved = window.localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<DictKey, string>;
        const values = keys.map((k) => parsed[k] ?? "");
        if (!looksUntranslated(english, values)) {
          remoteChrome[lang] = parsed;
          chromeTick += 1;
          notify();
          setReady(true);
          return;
        }
        window.localStorage.removeItem(cacheKey);
      }
    } catch {
      /* ignore */
    }
    let alive = true;
    void translateUiTexts(lang, english)
      .then((out) => {
        const map: Partial<Record<DictKey, string>> = {};
        keys.forEach((k, i) => {
          map[k] = out[i]?.trim() || chrome.en[k];
        });
        remoteChrome[lang] = map;
        if (!looksUntranslated(english, keys.map((k) => map[k] ?? ""))) {
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(map));
          } catch {
            /* ignore */
          }
        }
        chromeTick += 1;
        notify();
        if (alive) setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [lang]);
  // Subscribe so consumers re-render when remote chrome arrives.
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => chromeTick,
    () => 0,
  );
  return ready;
}

export function langNative(code: Lang): string {
  return LANGUAGES.find((l) => l.code === code)?.native ?? code;
}
