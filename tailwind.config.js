/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@shadcn/ui/dist/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@shadcn/ui/plugin')
  ],
}