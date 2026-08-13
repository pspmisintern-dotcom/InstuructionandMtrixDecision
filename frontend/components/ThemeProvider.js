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
          primary: { main: "#2196F3", light: "#90CAF9", dark: "#0D47A1" },
          secondary: { main: "#90CAF9", contrastText: "#0D47A1" },
          info: { main: "#2196F3" },
          success: { main: "#22c55e" },
          error: { main: "#ef4444" },
          warning: { main: "#f59e0b" },
          background: {
            default: darkMode ? "#0D1B2A" : "#E3F2FD",
            paper: darkMode ? "#12263A" : "#ffffff",
          },
          text: {
            primary: darkMode ? "#E3F2FD" : "#0D47A1",
            secondary: darkMode ? "#90CAF9" : "#1565C0",
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
                borderBottom: `1px solid ${darkMode ? "#1e3a5f" : "#E3F2FD"}`,
              },
              head: {
                fontWeight: 700,
                backgroundColor: darkMode ? "#0D1B2A" : "#E3F2FD",
                color: darkMode ? "#E3F2FD" : "#0D47A1",
              },
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: {
                "&:hover": {
                  backgroundColor: darkMode ? "#16233F" : "#E3F2FD",
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                backgroundColor: darkMode ? "#1e3a5f" : "#E3F2FD",
                color: darkMode ? "#E3F2FD" : "#0D47A1",
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
                  backgroundColor: darkMode ? "#12263A" : "#ffffff",
                },
              },
            },
          },
          MuiInputBase: {
            styleOverrides: {
              root: {
                color: darkMode ? "#E3F2FD" : "#0D47A1",
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: {
                backgroundColor: darkMode ? "#1e3a5f" : undefined,
                color: darkMode ? "#E3F2FD" : undefined,
              },
            },
          },
          MuiDivider: {
            styleOverrides: {
              root: {
                borderColor: darkMode ? "#1e3a5f" : "#E3F2FD",
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                backgroundColor: darkMode ? "#12263A" : "#ffffff",
                backgroundImage: "none",
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                backgroundColor: darkMode ? "#12263A" : "#ffffff",
                backgroundImage: "none",
              },
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: {
                "&:hover": {
                  backgroundColor: darkMode ? "#16233F" : "#E3F2FD",
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