/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    './src/**/*.{js,jsx,ts,tsx}', // 修正されたパス
    './src/**/*.css', // 修正されたパス
    "./public/css/**/*.{css}"
  ],
  theme: {
    extend: {},
  },
}