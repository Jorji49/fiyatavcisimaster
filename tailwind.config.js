/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/*.{html,js}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
      colors: { brand: '#0f172a' },
      animation: { 'fade-in': 'fadeIn 0.618s cubic-bezier(0.16, 1, 0.3, 1) forwards' }
    },
  },
  plugins: [],
}