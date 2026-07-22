import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGES, TRANSLATIONS, interpolate, lookup, type Language } from "./translations";

const STORAGE_KEY = "lexica.language";
const DEFAULT: Language = "en";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(v: unknown): v is Language {
  return typeof v === "string" && LANGUAGES.some((l) => l.code === v);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR renders in default locale; useEffect swaps to the stored preference
  // after hydration so we never mismatch HTML on first paint.
  const [language, setLanguageState] = useState<Language>(DEFAULT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLanguage(stored) && stored !== language) setLanguageState(stored);
    } catch {
      // ignore storage failures
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    const dict = TRANSLATIONS[language] ?? TRANSLATIONS[DEFAULT];
    return {
      language,
      setLanguage,
      t: (key, vars) => interpolate(lookup(dict, key), vars),
    };
  }, [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Graceful fallback so a stray call outside the provider doesn't crash.
    return {
      language: DEFAULT,
      setLanguage: () => {},
      t: (key, vars) => interpolate(lookup(TRANSLATIONS[DEFAULT], key), vars),
    };
  }
  return ctx;
}
