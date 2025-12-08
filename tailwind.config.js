/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",   // <-- correct path
  ],
  theme: {
    extend: {
      colors: {
        brandButton: "#23336A",
        menuBg: "#141C33",
        menuHover: "#19233F",
      },
    },
  },
  plugins: [],
};