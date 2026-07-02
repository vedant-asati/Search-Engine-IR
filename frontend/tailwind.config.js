/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc9fc',
          400: '#38adf8',
          500: '#0ea2e9',
          600: '#0281c7',
          700: '#0366a1',
          800: '#075685',
          900: '#0c486e',
          950: '#082e49',
        }
      }
    },
  },
  plugins: [],
}
