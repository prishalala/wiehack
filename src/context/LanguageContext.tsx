import { createContext, useContext, type ReactNode } from "react";
import { setLang, useChromeStrings, useLang } from "@/i18n";
import type { Lang } from "@/types";

type LanguageContextValue = {
  lang: Lang;
  setLanguage: (lang: Lang) => void;
  labelsReady: boolean;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLanguage: setLang,
  labelsReady: true,
});

/** Global language state (localStorage-backed) for all student-facing Localized content. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useLang();
  const labelsReady = useChromeStrings(lang);
  return (
    <LanguageContext.Provider value={{ lang, setLanguage: setLang, labelsReady }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
