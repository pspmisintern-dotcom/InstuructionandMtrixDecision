/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./context/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
colors: {
        industrial: {
          blue: "#1e40af",
          navy: "#0b1220",
          grey: "#475569",
          white: "#ffffff",
          orange: "#f97316",
          green: "#22c55e",
          red: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
