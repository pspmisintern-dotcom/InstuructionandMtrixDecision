"use client";

import React, { useState } from "react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { useServerInsertedHTML } from "next/navigation";
import { AppThemeProvider } from "../components/ThemeProvider";
import { LanguageProvider } from "../context/LanguageContext";

export default function Providers({ children }) {
  const [emotionCache] = useState(() => {
    const cache = createCache({ key: "css" });
    cache.compat = true;
    return cache;
  });

  useServerInsertedHTML(() => {
    const names = Object.keys(emotionCache.inserted);
    if (names.length === 0) return null;

    return (
      <style
        data-emotion={`${emotionCache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{
          __html: names.map((name) => emotionCache.inserted[name]).join(""),
        }}
      />
    );
  });

  return (
    <CacheProvider value={emotionCache}>
      <AppThemeProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </AppThemeProvider>
    </CacheProvider>
  );
}
