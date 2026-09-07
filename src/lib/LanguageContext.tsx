'use client';

import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';

type Language = 'en' | 'fr';
type Dictionary = typeof en;

const dictionaries: Record<Language, Dictionary> = { en, fr };

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof Dictionary) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const DEFAULT_LANGUAGE: Language = 'en';

function subscribeToLanguageChanges(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSavedLanguage(): Language {
  const saved = localStorage.getItem('app-lang');
  return saved === 'en' || saved === 'fr' ? saved : DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribeToLanguageChanges, getSavedLanguage, () => DEFAULT_LANGUAGE);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (newLang: Language) => {
    localStorage.setItem('app-lang', newLang);
    window.dispatchEvent(new StorageEvent('storage', { key: 'app-lang', newValue: newLang }));
  };

  const t = (key: keyof Dictionary): string => {
    return dictionaries[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
