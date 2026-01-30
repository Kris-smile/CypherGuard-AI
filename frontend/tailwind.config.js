/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0f172a", // slate-900
        secondary: "#1e293b", // slate-800
        accent: "#3b82f6", // blue-500
      }
    },
  },
  plugins: [],
}
