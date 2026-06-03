/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0B0F19',
          800: '#151B2C',
          700: '#1F293D',
          600: '#2C3A57',
        },
        accent: {
          green: '#10B981',
          blue: '#3B82F6',
          purple: '#8B5CF6'
        }
      }
    },
  },
  plugins: [],
}
