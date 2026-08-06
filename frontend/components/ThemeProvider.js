"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const ThemeContext = createContext(null);

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function AppThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") {
        setDarkMode(true);
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("theme", next ? "dark" : "light");
        if (next) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
      return next;
    });
  };

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: "#1e40af", light: "#3b82f6", dark: "#172e6b" },
          secondary: { main: "#ffffff", contrastText: "#1e40af" },
          info: { main: "#3b82f6" },
          success: { main: "#22c55e" },
          error: { main: "#ef4444" },
          warning: { main: "#f59e0b" },
          background: {
            default: darkMode ? "#0b1220" : "#f4f7fb",
            paper: darkMode ? "#111c33" : "#ffffff",
          },
          text: {
            primary: darkMode ? "#e2e8f0" : "#0f172a",
            secondary: darkMode ? "#94a3b8" : "#475569",
          },
        },
        typography: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
shape: {
          borderRadius: 10,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: "none",
                fontWeight: 600,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom: `1px solid ${darkMode ? "#1e293b" : "#e2e8f0"}`,
              },
              head: {
                fontWeight: 700,
                backgroundColor: darkMode ? "#0f1a30" : "#f8fafc",
                color: darkMode ? "#e2e8f0" : "#0f172a",
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                "&:hover": {
                  backgroundColor: darkMode ? "#16233f" : "#f8fafc",
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                backgroundColor: darkMode ? "#1e293b" : "#f1f5f9",
                color: darkMode ? "#e2e8f0" : "#334155",
              },
              outlined: {
                backgroundColor: "transparent",
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                "& .MuiOutlinedInput-root": {
                  backgroundColor: darkMode ? "#111c33" : "#ffffff",
                },
              },
            },
          },
          MuiInputBase: {
            styleOverrides: {
              root: {
                color: darkMode ? "#e2e8f0" : "#0f172a",
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: {
                backgroundColor: darkMode ? "#1e293b" : undefined,
                color: darkMode ? "#e2e8f0" : undefined,
              },
            },
          },
          MuiDivider: {
            styleOverrides: {
              root: {
                borderColor: darkMode ? "#1e293b" : "#e2e8f0",
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                backgroundColor: darkMode ? "#111c33" : "#ffffff",
                backgroundImage: "none",
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                backgroundColor: darkMode ? "#111c33" : "#ffffff",
                backgroundImage: "none",
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                "&:hover": {
                  backgroundColor: darkMode ? "#16233f" : "#f8fafc",
                },
              },
            },
          },
        },
      }),
    [darkMode]
  );

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
