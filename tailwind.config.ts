import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0D1015",
        surface: "#1A1F2E",
        accent: "#00D9FF",
        teal: "#00B8A3",
        amber: "#FFB020",
        alert: "#FF4444",
      },
    },
  },
  plugins: [],
};
export default config;

