'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, translate } from './translations.js';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'washlink_lang';

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LANGUAGES[stored]) setLangState(stored);
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
  }, [lang]);

  const setLang = useCallback((next) => {
    if (LANGUAGES[next]) setLangState(next);
  }, []);

  const t = useCallback((path, vars) => translate(lang, path, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}