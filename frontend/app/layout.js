import "./globals.css";
import { AppThemeProvider } from "../components/ThemeProvider";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "WI Manager - Digital Work Instruction System",
  description: "AI-Powered Digital Work Instruction Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <AppThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
