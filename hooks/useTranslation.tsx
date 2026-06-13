'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Basic mock dictionary for testing
const dictionaries: Record<string, Record<string, string>> = {
  it: {
    hello: 'Ciao',
    welcome: 'Benvenuto'
  },
  en: {
    hello: 'Hello',
    welcome: 'Welcome'
  }
};

interface TranslationContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ 
  children, 
  defaultLanguage = 'it' 
}: { 
  children: ReactNode; 
  defaultLanguage?: string;
}) {
  const [language, setLanguage] = useState(defaultLanguage);

  const t = (key: string) => {
    const dictionary = dictionaries[language] || dictionaries['it'];
    return dictionary[key] || key;
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
