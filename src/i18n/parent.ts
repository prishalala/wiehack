import { useEffect, useState } from "react";
import { looksUntranslated } from "@/services/translateUi";

/** Parent portal interface text. Parents choose their language, and everything below follows it. */
const dict = {
  en: {
    portal: "Parent portal",
    linkTitle: "See your child's schoolwork",
    linkSub: "Sign in with the parent account issued by your school or university.",
    familyCode: "Family code",
    yourName: "Your name",
    relation: "You are the child's…",
    Mother: "Mother", Father: "Father", Guardian: "Guardian", Other: "Family member",
    language: "Your language",
    send: "Sign in",
    privacyNote: "You only see children your institution has linked to your parent account. Grades appear after the teacher releases them.",
    pendingTitle: "Waiting for the teacher to verify you",
    pendingBody: "We asked {child}'s teacher to confirm that you are their {relation}. This page updates by itself.",
    rejectedTitle: "Request not approved",
    rejectedBody: "The teacher could not verify this request. Please contact the school.",
    useOtherCode: "Use a different account",
    verified: "Linked family member",
    signInTitle: "Parent sign in",
    signInSub: "View released grades, homework and areas where your child needs support.",
    noChildren: "No students are linked to this parent account yet. Ask your school office to link you.",
    selectChild: "Child",
    hello: "Hello",
    headline: "Here is how {child} is doing",
    statQuestions: "Questions asked",
    statActivities: "Activities done",
    statCorrect: "Quick checks correct",
    helpTitle: "How you can help at home",
    helpSub: "Based on {child}'s grades, the teacher's feedback and their questions. No special knowledge needed.",
    gradesTitle: "Grades", gradesSub: "Homework, quizzes and tests marked by the teacher.", overall: "Overall",
    homework: "Homework", quiz: "Quiz", test: "Test", project: "Project",
    noGrades: "No grades yet.", notGraded: "Not graded yet", due: "Due", teacherFeedback: "Teacher's feedback",
    viewAssignment: "View assignment", hideAssignment: "Hide", noInstructions: "No instructions were added.",
    assignmentsTitle: "Homework & assignments", assignmentsSub: "What {child} has been asked to do, in your language.", noAssignments: "No assignments yet.",
    mistakesTitle: "Common mistakes in the class", mistakesSub: "Ideas many students found confusing. Marked where {child} found it hard too.",
    childToo: "{child} found this hard", noMistakes: "No common mistakes found yet.",
    weakTitle: "Where {child} needs help", whyLabel: "Why we think so", howHelp: "How to help", statGrade: "Average grade",
    helpButton: "Get ideas",
    helpLoading: "Preparing ideas for you…",
    tryAtHome: "Try at home",
    askChild: "Ask your child",
    learning: "What the class is learning",
    questionsTitle: "{child}'s questions",
    questionsSub: "{child} asked these privately. Only you and the teacher can see them.",
    noQuestions: "{child} hasn't asked any questions yet.",
    original: "Original",
    answerLabel: "Answer {child} received",
    activitiesTitle: "Activities from the teacher",
    noActivities: "No activities yet.",
    gotRight: "Answered correctly",
    gotWrong: "Needs another try",
    notYet: "Not answered yet",
    tryTogether: "Try it together",
    signOut: "Sign out",
    translatedNote: "Translated automatically into your language.",
    loading: "Loading…",
    error: "Something went wrong.",
    retry: "Try again",
    needsLive: "The parent portal needs the live ClassBridge server. Ask the person running the demo to start the backend.",
  },
  hi: {
    portal: "अभिभावक पोर्टल",
    linkTitle: "अपने बच्चे का स्कूल का काम देखें",
    linkSub: "स्कूल या विश्वविद्यालय द्वारा जारी अभिभावक खाते से साइन इन करें।",
    familyCode: "फ़ैमिली कोड",
    yourName: "आपका नाम",
    relation: "आप बच्चे के…",
    Mother: "माँ", Father: "पिता", Guardian: "अभिभावक", Other: "परिवार के सदस्य",
    language: "आपकी भाषा",
    send: "साइन इन",
    privacyNote: "आप केवल उन बच्चों को देख सकते हैं जिन्हें संस्थान ने आपके खाते से जोड़ा है। अंक शिक्षक के जारी करने पर दिखते हैं।",
    pendingTitle: "शिक्षक द्वारा आपकी पुष्टि की प्रतीक्षा है",
    pendingBody: "हमने {child} के शिक्षक से पुष्टि करने को कहा है कि आप उनके {relation} हैं। यह पेज अपने आप अपडेट होगा।",
    rejectedTitle: "अनुरोध स्वीकार नहीं हुआ",
    rejectedBody: "शिक्षक इस अनुरोध की पुष्टि नहीं कर सके। कृपया स्कूल से संपर्क करें।",
    useOtherCode: "दूसरा खाता उपयोग करें",
    verified: "जुड़े परिवार सदस्य",
    signInTitle: "अभिभावक साइन इन",
    signInSub: "जारी अंक, गृहकार्य और जहाँ मदद चाहिए देखें।",
    noChildren: "इस खाते से अभी कोई छात्र नहीं जुड़ा है। स्कूल कार्यालय से संपर्क करें।",
    selectChild: "बच्चा",
    hello: "नमस्ते",
    headline: "{child} की पढ़ाई ऐसी चल रही है",
    statQuestions: "पूछे गए प्रश्न",
    statActivities: "पूरी की गई गतिविधियाँ",
    statCorrect: "सही उत्तर",
    helpTitle: "आप घर पर कैसे मदद कर सकते हैं",
    helpSub: "{child} के अंकों, शिक्षक की टिप्पणी और उनके प्रश्नों पर आधारित। किसी खास ज्ञान की ज़रूरत नहीं।",
    gradesTitle: "अंक", gradesSub: "शिक्षक द्वारा जाँचे गए गृहकार्य, क्विज़ और टेस्ट।", overall: "कुल मिलाकर",
    homework: "गृहकार्य", quiz: "क्विज़", test: "टेस्ट", project: "प्रोजेक्ट",
    noGrades: "अभी कोई अंक नहीं।", notGraded: "अभी जाँचा नहीं गया", due: "जमा करने की तिथि", teacherFeedback: "शिक्षक की टिप्पणी",
    viewAssignment: "असाइनमेंट देखें", hideAssignment: "छिपाएँ", noInstructions: "कोई निर्देश नहीं जोड़े गए।",
    assignmentsTitle: "गृहकार्य और असाइनमेंट", assignmentsSub: "{child} को क्या करना है, आपकी भाषा में।", noAssignments: "अभी कोई असाइनमेंट नहीं।",
    mistakesTitle: "कक्षा की आम गलतियाँ", mistakesSub: "ऐसी बातें जिनमें कई बच्चे उलझे। जहाँ {child} को भी कठिनाई हुई, वह चिह्नित है।",
    childToo: "{child} को भी यह कठिन लगा", noMistakes: "अभी कोई आम गलती नहीं मिली।",
    weakTitle: "{child} को कहाँ मदद चाहिए", whyLabel: "हमें ऐसा क्यों लगता है", howHelp: "कैसे मदद करें", statGrade: "औसत अंक",
    helpButton: "सुझाव पाएँ",
    helpLoading: "आपके लिए सुझाव तैयार हो रहे हैं…",
    tryAtHome: "घर पर करके देखें",
    askChild: "अपने बच्चे से पूछें",
    learning: "कक्षा में क्या पढ़ाया जा रहा है",
    questionsTitle: "{child} के प्रश्न",
    questionsSub: "{child} ने ये प्रश्न निजी रूप से पूछे। इन्हें केवल आप और शिक्षक देख सकते हैं।",
    noQuestions: "{child} ने अभी तक कोई प्रश्न नहीं पूछा है।",
    original: "मूल",
    answerLabel: "{child} को मिला उत्तर",
    activitiesTitle: "शिक्षक की गतिविधियाँ",
    noActivities: "अभी कोई गतिविधि नहीं।",
    gotRight: "सही उत्तर दिया",
    gotWrong: "फिर से कोशिश करनी है",
    notYet: "अभी उत्तर नहीं दिया",
    tryTogether: "साथ में करके देखें",
    signOut: "बाहर निकलें",
    translatedNote: "आपकी भाषा में अपने आप अनुवादित।",
    loading: "लोड हो रहा है…",
    error: "कुछ गलत हो गया।",
    retry: "फिर कोशिश करें",
    needsLive: "अभिभावक पोर्टल के लिए लाइव ClassBridge सर्वर चाहिए। डेमो चलाने वाले व्यक्ति से बैकएंड शुरू करने को कहें।",
  },
  fr: {
    portal: "Espace parents",
    linkTitle: "Suivez le travail scolaire de votre enfant",
    linkSub: "Connectez-vous avec le compte parent fourni par l'école ou l'université.",
    familyCode: "Code famille",
    yourName: "Votre nom",
    relation: "Vous êtes…",
    Mother: "Mère", Father: "Père", Guardian: "Tuteur / tutrice", Other: "Membre de la famille",
    language: "Votre langue",
    send: "Se connecter",
    privacyNote: "Vous ne voyez que les enfants liés à votre compte par l'établissement. Les notes apparaissent après publication par l'enseignant.",
    pendingTitle: "En attente de vérification par l'enseignant",
    pendingBody: "Nous avons demandé à l'enseignant de {child} de confirmer votre lien ({relation}). Cette page se met à jour toute seule.",
    rejectedTitle: "Demande refusée",
    rejectedBody: "L'enseignant n'a pas pu vérifier cette demande. Veuillez contacter l'école.",
    useOtherCode: "Utiliser un autre compte",
    verified: "Membre de la famille lié",
    signInTitle: "Connexion parent",
    signInSub: "Consultez les notes publiées, les devoirs et les points à soutenir.",
    noChildren: "Aucun élève n'est encore lié à ce compte. Contactez le secrétariat.",
    selectChild: "Enfant",
    hello: "Bonjour",
    headline: "Voici comment {child} avance",
    statQuestions: "Questions posées",
    statActivities: "Activités faites",
    statCorrect: "Bonnes réponses",
    helpTitle: "Comment aider à la maison",
    helpSub: "Basé sur les notes de {child}, les commentaires de l'enseignant et ses questions. Aucune connaissance particulière requise.",
    gradesTitle: "Notes", gradesSub: "Devoirs, quiz et contrôles corrigés par l'enseignant.", overall: "Moyenne générale",
    homework: "Devoirs", quiz: "Quiz", test: "Contrôle", project: "Projet",
    noGrades: "Pas encore de notes.", notGraded: "Pas encore noté", due: "À rendre le", teacherFeedback: "Commentaire de l'enseignant",
    viewAssignment: "Voir le devoir", hideAssignment: "Masquer", noInstructions: "Aucune consigne ajoutée.",
    assignmentsTitle: "Devoirs et travaux", assignmentsSub: "Ce que {child} doit faire, dans votre langue.", noAssignments: "Pas encore de devoirs.",
    mistakesTitle: "Erreurs fréquentes dans la classe", mistakesSub: "Notions qui ont posé problème à plusieurs élèves. Signalé quand {child} a aussi eu du mal.",
    childToo: "{child} a eu du mal ici", noMistakes: "Aucune erreur fréquente pour l'instant.",
    weakTitle: "Là où {child} a besoin d'aide", whyLabel: "Pourquoi", howHelp: "Comment aider", statGrade: "Moyenne",
    helpButton: "Obtenir des idées",
    helpLoading: "Préparation des idées…",
    tryAtHome: "À essayer à la maison",
    askChild: "Demandez à votre enfant",
    learning: "Ce que la classe apprend",
    questionsTitle: "Les questions de {child}",
    questionsSub: "{child} les a posées en privé. Seuls vous et l'enseignant pouvez les voir.",
    noQuestions: "{child} n'a pas encore posé de question.",
    original: "Original",
    answerLabel: "Réponse reçue par {child}",
    activitiesTitle: "Activités de l'enseignant",
    noActivities: "Pas encore d'activité.",
    gotRight: "Bonne réponse",
    gotWrong: "À retravailler",
    notYet: "Pas encore répondu",
    tryTogether: "Essayez ensemble",
    signOut: "Se déconnecter",
    translatedNote: "Traduit automatiquement dans votre langue.",
    loading: "Chargement…",
    error: "Une erreur s'est produite.",
    retry: "Réessayer",
    needsLive: "L'espace parents nécessite le serveur ClassBridge en direct. Demandez à la personne qui lance la démo de démarrer le backend.",
  },
};

export type ParentKey = keyof (typeof dict)["en"];

/** Languages a parent can choose. en/hi/fr have built-in text; the rest are translated by the AI. */
export const PARENT_LANGUAGES: { code: string; native: string; label: string; rtl?: boolean }[] = [
  { code: "en", native: "English", label: "English" },
  { code: "hi", native: "हिन्दी", label: "Hindi" },
  { code: "fr", native: "Français", label: "French" },
  { code: "es", native: "Español", label: "Spanish" },
  { code: "ar", native: "العربية", label: "Arabic", rtl: true },
  { code: "zh", native: "中文", label: "Chinese" },
  { code: "pa", native: "ਪੰਜਾਬੀ", label: "Punjabi" },
  { code: "ta", native: "தமிழ்", label: "Tamil" },
  { code: "ur", native: "اردو", label: "Urdu", rtl: true },
  { code: "bn", native: "বাংলা", label: "Bengali" },
  { code: "pt", native: "Português", label: "Portuguese" },
  { code: "tl", native: "Tagalog", label: "Tagalog" },
  { code: "vi", native: "Tiếng Việt", label: "Vietnamese" },
  { code: "ko", native: "한국어", label: "Korean" },
];
export const isRtl = (lang: string) => PARENT_LANGUAGES.some((l) => l.code === lang && l.rtl);
type BuiltInLang = keyof typeof dict;
const builtIn = (lang: string): lang is BuiltInLang => lang === "en" || lang === "hi" || lang === "fr";

/** AI-translated portal labels for languages without built-in text, filled by useParentStrings(). */
const remote: Record<string, Partial<Record<ParentKey, string>>> = {};

/** Translate a parent-portal string, filling {placeholders}. Falls back to English while loading. */
export function pt(lang: string, key: ParentKey, vars: Record<string, string> = {}): string {
  const s: string = (builtIn(lang) ? dict[lang][key] : remote[lang]?.[key]) ?? dict.en[key];
  return s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

/**
 * Make sure the portal's labels exist in `lang`. Returns true once they are ready.
 * Placeholders like {child} are protected so the AI doesn't translate them.
 */
export function useParentStrings(lang: string, translate: (lang: string, texts: string[]) => Promise<string[]>): boolean {
  const [ready, setReady] = useState(() => builtIn(lang) || !!remote[lang]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (builtIn(lang) || remote[lang]) { setReady(true); return; }
    setReady(false);
    const cacheKey = `classbridge:parent-ui:v2:${lang}`;
    const keys = Object.keys(dict.en) as ParentKey[];
    const english = keys.map((k) => dict.en[k]);
    try {
      const saved = window.localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<ParentKey, string>;
        const values = keys.map((k) => parsed[k] ?? "");
        if (!looksUntranslated(english, values)) {
          remote[lang] = parsed;
          setTick((n) => n + 1);
          setReady(true);
          return;
        }
        window.localStorage.removeItem(cacheKey);
      }
    } catch { /* ignore */ }
    let alive = true;
    translate(lang, english)
      .then((out) => {
        const map: Partial<Record<ParentKey, string>> = {};
        keys.forEach((k, i) => {
          const t = out[i] ?? "";
          // Keep the English text if the AI dropped a {placeholder}.
          const need = dict.en[k].match(/\{\w+\}/g) ?? [];
          map[k] = need.every((ph) => t.includes(ph)) && t ? t : dict.en[k];
        });
        remote[lang] = map;
        if (!looksUntranslated(english, keys.map((k) => map[k] ?? ""))) {
          try { window.localStorage.setItem(cacheKey, JSON.stringify(map)); } catch { /* ignore */ }
        }
        if (alive) {
          setTick((n) => n + 1);
          setReady(true);
        }
      })
      .catch(() => { if (alive) setReady(true); }); // fall back to English labels
    return () => { alive = false; };
  }, [lang, translate]);
  // tick forces consumers to re-read pt() after remote labels land
  void tick;
  return ready;
}

export const RELATIONS = ["Mother", "Father", "Guardian", "Other"] as const;
/** Relations are stored in English (for the teacher) and shown in the parent's language. */
export const relationLabel = (lang: string, r: string) =>
  (RELATIONS as readonly string[]).includes(r) ? pt(lang, r as ParentKey) : r;
