"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi (हिंदी)" },
  { code: "ta", label: "Tamil (தமிழ்)" },
  { code: "te", label: "Telugu (తెలుగు)" },
  { code: "mr", label: "Marathi (मराठी)" },
  { code: "kn", label: "Kannada (ಕನ್ನಡ)" },
  { code: "bn", label: "Bengali (বাংলা)" },
  { code: "gu", label: "Gujarati (ગુજરાતી)" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)" },
  { code: "ml", label: "Malayalam (മലയാളം)" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ja", label: "Japanese" },
  { code: "ar", label: "Arabic (العربية)" },
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
