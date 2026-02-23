import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0b1220",
          panel: "#111b2f",
          accent: "#06b6d4",
          warm: "#f59e0b"
        }
      }
    }
  },
  plugins: []
};

export default config;
