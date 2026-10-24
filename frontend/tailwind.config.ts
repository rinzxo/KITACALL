import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "#0087FF",
          blue: "#0087FF",
          cyan: "#01C4FB",
          dark: "#006BD1",
          light: "#E0F4FE",
          50: "#F0F9FF",
          100: "#E0F4FE",
          200: "#BAE6FD",
          300: "#7DD3FC",
          400: "#38BDF8",
          500: "#01C4FB",
          600: "#0087FF",
          700: "#006BD1",
          800: "#0052A3",
          900: "#003E7E",
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0087FF 0%, #01C4FB 100%)',
        'brand-gradient-hover': 'linear-gradient(135deg, #0077E6 0%, #00B5EA 100%)',
        'tactical-gradient': 'linear-gradient(180deg, #0F172A 0%, #020617 100%)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '2xl': '1rem',
        xl: '0.75rem',
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'brand': '0 10px 25px -5px rgba(0, 135, 255, 0.25), 0 8px 10px -6px rgba(1, 196, 251, 0.2)',
        'ptt-glow': '0 0 50px rgba(0, 135, 255, 0.45)',
        'tx-glow': '0 0 60px rgba(239, 68, 68, 0.65)',
        'rx-glow': '0 0 60px rgba(16, 185, 129, 0.65)',
      },
      keyframes: {
        'pulse-subtle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
        'radar-ping': {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        }
      },
      animation: {
        'pulse-subtle': 'pulse-subtle 2s infinite ease-in-out',
        'radar-ping': 'radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
