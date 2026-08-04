/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces
        surface: {
          light: "#F6F7FB",
          card: "#FFFFFF",
          dark: "#0B0E17",
          "dark-card": "#12172A",
        },
        // Brand: violet -> blue gradient identity (money moving forward)
        brand: {
          50: "#F2EEFE",
          100: "#E4DBFD",
          300: "#B7A0FA",
          500: "#7C5CF5", // primary
          600: "#6942F0",
          700: "#5631D6",
          900: "#2B1866",
        },
        accentBlue: "#3B82F6",
        success: "#17B26A",
        warning: "#F5A524",
        danger: "#F04438",
        ink: {
          900: "#0D1021",
          700: "#3A3F55",
          500: "#6B7086",
          300: "#A7ABBD",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(13,16,33,0.04), 0 8px 24px -8px rgba(13,16,33,0.10)",
        "card-dark": "0 1px 2px rgba(0,0,0,0.3), 0 8px 30px -8px rgba(0,0,0,0.55)",
        glow: "0 0 0 1px rgba(124,92,245,0.15), 0 8px 30px -4px rgba(124,92,245,0.35)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #7C5CF5 0%, #3B82F6 100%)",
        "mesh-light": "radial-gradient(60% 50% at 10% 0%, rgba(124,92,245,0.10) 0%, rgba(124,92,245,0) 60%), radial-gradient(50% 40% at 100% 0%, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0) 60%)",
        "mesh-dark": "radial-gradient(60% 50% at 10% 0%, rgba(124,92,245,0.20) 0%, rgba(124,92,245,0) 60%), radial-gradient(50% 40% at 100% 0%, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0) 60%)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
