import "./globals.css";
import Providers from "./providers";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "WI Manager - Digital Work Instruction System",
  description: "AI-Powered Digital Work Instruction Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="emotion-insertion-point" content="emotion-insertion-point" />
      </head>
      <body className="min-h-screen bg-gray-50 dark:bg-slate-900">
        <Providers>
          <AuthProvider>{children}</AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
