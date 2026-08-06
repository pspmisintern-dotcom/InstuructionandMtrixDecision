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
          blue: "#1e3a8a",
          grey: "#374151",
          white: "#ffffff",
          orange: "#f97316",
          green: "#16a34a",
          red: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};
