/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Dark Mode Surface Layers
        "surface": "#0b1326",
        "surface-dim": "#0b1326",
        "surface-bright": "#31394d",
        "surface-container-lowest": "#060e20",
        "surface-container-low": "#131b2e",
        "surface-container": "#171f33",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        "on-surface": "#dae2fd",
        "on-surface-variant": "#c7c4d7",
        "inverse-surface": "#dae2fd",
        "inverse-on-surface": "#283044",
        "outline": "#908fa0",
        "outline-variant": "#464554",
        "surface-tint": "#c0c1ff",
        
        // Primary Colors
        "primary": "#c0c1ff",
        "on-primary": "#1000a9",
        "primary-container": "#8083ff",
        "on-primary-container": "#0d0096",
        "inverse-primary": "#494bd6",
        "primary-fixed": "#e1e0ff",
        "primary-fixed-dim": "#c0c1ff",
        "on-primary-fixed": "#07006c",
        "on-primary-fixed-variant": "#2f2ebe",
        
        // Secondary Colors
        "secondary": "#b9c8de",
        "on-secondary": "#233143",
        "secondary-container": "#39485a",
        "on-secondary-container": "#a7b6cc",
        "secondary-fixed": "#d4e4fa",
        "secondary-fixed-dim": "#b9c8de",
        "on-secondary-fixed": "#0d1c2d",
        "on-secondary-fixed-variant": "#39485a",
        
        // Tertiary Colors
        "tertiary": "#d0bcff",
        "on-tertiary": "#3c0091",
        "tertiary-container": "#a078ff",
        "on-tertiary-container": "#340080",
        "tertiary-fixed": "#e9ddff",
        "tertiary-fixed-dim": "#d0bcff",
        "on-tertiary-fixed": "#23005c",
        "on-tertiary-fixed-variant": "#5516be",
        
        // Semantic Colors
        "error": "#ffb4ab",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
        
        // Background
        "background": "#0b1326",
        "on-background": "#dae2fd",
        "surface-variant": "#2d3449",
        
        // Status Colors (semantic)
        "success": "#10b981",
        "warning": "#f59e0b",
        "info": "#3b82f6",
      },
      fontFamily: {
        "headline-xl": ["Hanken Grotesk"],
        "headline-xl-mobile": ["Hanken Grotesk"],
        "headline-lg": ["Hanken Grotesk"],
        "headline-md": ["Hanken Grotesk"],
        "body-lg": ["Inter"],
        "body-md": ["Inter"],
        "body-sm": ["Inter"],
        "label-md": ["Geist"],
        "label-sm": ["Geist"],
      },
      fontSize: {
        "headline-xl": ["48px", { lineHeight: "56px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "headline-xl-mobile": ["32px", { lineHeight: "40px", fontWeight: "700", letterSpacing: "-0.02em" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600", letterSpacing: "-0.01em" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "16px", fontWeight: "500", letterSpacing: "0.02em" }],
        "label-sm": ["12px", { lineHeight: "14px", fontWeight: "500", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.5rem",
        "full": "9999px",
      },
      spacing: {
        "base": "4px",
        "xs": "4px",
        "sm": "8px",
        "md": "16px",
        "lg": "24px",
        "xl": "40px",
        "xxl": "64px",
        "gutter": "24px",
        "margin-mobile": "16px",
        "margin-desktop": "48px",
      },
    },
  },
  plugins: [],
};
