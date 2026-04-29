/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'trackflow-bg': '#f9f9f8',
        'trackflow-bg-2': '#f2f2f0',
        'trackflow-bg-3': '#e8e8e4',
        'trackflow-border': '#ddddd8',
        'trackflow-border-2': '#c8c8c2',
        'trackflow-text': '#111110',
        'trackflow-text-2': '#555550',
        'trackflow-text-3': '#888882',
        'trackflow-accent': '#111110',
        'trackflow-accent-hover': '#333330',
        'trackflow-red': '#c0392b',
        'trackflow-green': '#27ae60',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'trackflow': '6px',
        'trackflow-lg': '10px',
      },
      boxShadow: {
        'trackflow': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'trackflow-md': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
