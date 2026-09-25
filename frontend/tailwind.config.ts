import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17171c",
        paper: "#faf9f6",
        accent: {
          DEFAULT: "#4f46e5",
          soft: "#eef0ff",
          hover: "#4338ca",
        },
        violet: {
          DEFAULT: "#7c3aed",
          soft: "#f3ebfe",
        },
        success: { DEFAULT: "#15803d", soft: "#ecfdf3", border: "#bbf3d0" },
        warning: { DEFAULT: "#92400e", soft: "#fff8e6", border: "#fde9b0" },
        danger: { DEFAULT: "#b91c1c", soft: "#fef2f2", border: "#fecaca" },
        info: { DEFAULT: "#1d4ed8", soft: "#eff6ff", border: "#bfdbfe" },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23, 23, 28, 0.04), 0 1px 12px rgba(23, 23, 28, 0.04)",
        raised: "0 8px 24px rgba(23, 23, 28, 0.08), 0 2px 6px rgba(23, 23, 28, 0.05)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
export default config;