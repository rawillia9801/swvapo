import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'serif']
      },
      colors: {
        brand: {
          50: '#F9F7F5', 100: '#F0EBE5', 200: '#E2D6C5', 300: '#CFB69B',
          400: '#B69673', 500: '#9C7B58', 600: '#7F6244', 700: '#634C35',
          800: '#463626', 900: '#2A2018'
        },
        accent: {
          gold: '#D4AF37', sage: '#8DA399', rose: '#E5B9B9'
        }
      },
      boxShadow: {
        luxury: '0 20px 40px -15px rgba(42, 32, 24, 0.12)',
        paper: '0 1px 2px rgba(0,0,0,0.05)',
        lift: '0 18px 40px -24px rgba(42, 32, 24, 0.22)'
      },
      backgroundImage: {
        texturePaper: "url('https://www.transparenttextures.com/patterns/cream-paper.png')"
      }
    },
  },
  plugins: [],
};
export default config;