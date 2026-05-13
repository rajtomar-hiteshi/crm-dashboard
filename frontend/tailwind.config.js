/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: 'var(--color-bg)',
          card: 'var(--color-card)',
          hover: 'var(--color-hover)',
        },
        edge: 'var(--color-border)',
        content: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-secondary)',
          faint: 'var(--color-text-tertiary)',
        },
      },
    },
  },
  plugins: [],
}
