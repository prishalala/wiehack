import { createContext, useContext, type ReactNode } from "react";
import { setLang, useLang } from "@/i18n";
import type { Lang } from "@/types";

type LanguageContextValue = {
  lang: Lang;
  setLanguage: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLanguage: setLang,
});

/** Global language state (localStorage-backed) for all student-facing Localized content. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useLang();
  return (
    <LanguageContext.Provider value={{ lang, setLanguage: setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
