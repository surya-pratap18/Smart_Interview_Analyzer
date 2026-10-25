/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
      },
      colors: {
        brand:   '#4f8eff',
        accent:  '#00e5c3',
        warn:    '#ffb347',
        danger:  '#ff5f7e',
        surface: '#162040',
      }
    }
  },
  plugins: []
}
