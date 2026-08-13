"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi (हिंदी)" },
  { code: "mr", label: "Marathi (मराठी)" },
];

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  languageLabel: "English",
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("preferredLanguage");
    if (saved) setLanguageState(saved);
  }, []);

  const setLanguage = (code) => {
    setLanguageState(code);
    localStorage.setItem("preferredLanguage", code);
  };

  const languageLabel = LANGUAGES.find((l) => l.code === language)?.label || "English";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languageLabel }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}