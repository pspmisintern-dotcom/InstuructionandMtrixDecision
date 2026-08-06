"use client";

import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { AppThemeProvider } from "../components/ThemeProvider";

const clientSideEmotionCache = createCache({
  key: "css",
  insertionPoint:
    typeof document !== "undefined"
      ? document.querySelector('meta[name="emotion-insertion-point"]')
      : undefined,
});

export default function Providers({ children }) {
  return (
    <CacheProvider value={clientSideEmotionCache}>
      <AppThemeProvider>{children}</AppThemeProvider>
    </CacheProvider>
  );
}
