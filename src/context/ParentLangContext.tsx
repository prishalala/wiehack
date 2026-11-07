import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useParentStrings } from "@/i18n/parent";
import { translateUiTexts } from "@/services/translateUi";

const LANG_KEY = "classbridge:parent-lang";

const ParentLangContext = createContext<{ lang: string; setLang: (l: string) => void; labelsReady: boolean } | null>(null);

export function ParentLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window === "undefined") return "en";
    return window.localStorage.getItem(LANG_KEY) || "en";
  });
  function setLang(l: string) {
    window.localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }
  const translate = useCallback((code: string, texts: string[]) => translateUiTexts(code, texts), []);
  // Loads AI UI labels for languages beyond the built-in en/hi/fr dictionaries.
  const labelsReady = useParentStrings(lang, translate);
  return <ParentLangContext.Provider value={{ lang, setLang, labelsReady }}>{children}</ParentLangContext.Provider>;
}

export function useParentLang() {
  const ctx = useContext(ParentLangContext);
  if (!ctx) throw new Error("useParentLang must be used within ParentLangProvider");
  return ctx;
}
