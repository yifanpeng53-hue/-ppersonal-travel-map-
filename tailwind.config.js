/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        y2k: ['"Press Start 2P"', 'monospace'],
        candy: ['"Baloo 2"', 'cursive'],
      },
      colors: {
        bubblePink: '#ffb7ce',
        babyBlue: '#a1c4fd',
      },
      boxShadow: {
        ceramic: '0 10px 0 rgba(244, 98, 167, 0.35), 0 16px 42px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
};
