/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-primary": "#ffffff",
        "on-tertiary": "#ffffff",
        "surface-variant": "#d6e3ff",
        "on-secondary-container": "#55637d",
        "on-surface": "#0d1c32",
        "outline-variant": "#c1c6d7",
        "inverse-surface": "#233148",
        "on-tertiary-container": "#fffbff",
        "secondary-fixed": "#d6e3ff",
        "primary": "#0059bb",
        "surface-dim": "#ccdaf8",
        "on-background": "#0d1c32",
        "inverse-primary": "#adc7ff",
        "on-tertiary-fixed": "#351000",
        "secondary-fixed-dim": "#b9c7e4",
        "on-error": "#ffffff",
        "surface-container-high": "#dfe8ff",
        "secondary-container": "#d2e0fe",
        "on-secondary": "#ffffff",
        "tertiary": "#9e3d00",
        "surface-container-lowest": "#ffffff",
        "surface-container": "#e8eeff",
        "primary-container": "#0070ea",
        "primary-fixed": "#d8e2ff",
        "on-error-container": "#93000a",
        "secondary": "#515f78",
        "on-primary-fixed-variant": "#004493",
        "on-secondary-fixed-variant": "#39475f",
        "tertiary-fixed-dim": "#ffb695",
        "tertiary-container": "#c64f00",
        "surface-tint": "#005bc0",
        "inverse-on-surface": "#ecf0ff",
        "on-tertiary-fixed-variant": "#7c2e00",
        "outline": "#717786",
        "error-container": "#ffdad6",
        "on-surface-variant": "#414754",
        "on-secondary-fixed": "#0d1c32",
        "primary-fixed-dim": "#adc7ff",
        "surface-bright": "#f9f9ff",
        "surface-container-low": "#f0f3ff",
        "surface": "#f9f9ff",
        "surface-container-highest": "#d6e3ff",
        "on-primary-fixed": "#001a41",
        "tertiary-fixed": "#ffdbcc",
        "background": "#f9f9ff",
        "error": "#ba1a1a",
        "on-primary-container": "#fefcff"
      },
      fontFamily: {
        "headline": ["Manrope", "sans-serif"],
        "body": ["Inter", "sans-serif"],
        "label": ["Inter", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.5rem",
        "lg": "0.75rem",
        "full": "9999px"
      },
      boxShadow: {
        "ambient": "0px 12px 32px rgba(13, 28, 50, 0.06)"
      }
    },
  },
  plugins: [],
}
