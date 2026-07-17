/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F9F8F6",
        surface: "#FFFFFF",
        "surface-soft": "#F2EFE9",
        "surface-deep": "#EBE6DE",
        primary: "#321232",
        "primary-2": "#522A52",
        accent: "#321232",
        lavender: "#D1CDC0",
        "soft-lilac": "#F2EFE9",
        border: "#E2DED0",
        "border-med": "#D1CDC0",
        text: "#1A1A1A",
        muted: "#6B665E",
        success: "#4E7D62",
        sale: "#B8325F",
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "none",
        hover: "0 20px 60px rgba(0, 0, 0, 0.05)",
      },
      borderRadius: {
        sm: "2px",
        md: "4px",
        lg: "8px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
