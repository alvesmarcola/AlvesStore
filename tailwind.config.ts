import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        pitch: "#0A0A0A",
        lime: "#2563EB",
        paper: "#F5F5F5",
        muted: "#525252",
        graphite: { DEFAULT: "#171717", hover: "#262626" },
        border: "#E5E5E5",
        secondary: "#A3A3A3",
        action: { DEFAULT: "#2563EB", hover: "#1D4ED8", soft: "#DBEAFE" },
        success: "#16A34A",
        danger: "#DC2626",
      },
      fontFamily: {
        display: ["Impact", "Haettenschweiler", "Arial Narrow", "sans-serif"],
        sans: ["Inter", "Arial", "Helvetica", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 35px rgba(10, 10, 10, .08)",
      },
    },
  },
  plugins: [],
};

export default config;
