import type { Config } from "tailwindcss";

export default {
  darkMode: "class",

  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}"
  ],

  theme: {
    extend: {
      /* =========================
         COLOR SYSTEM — RENIX MODERN COOL
         Clean Neutrals / Copper Accent
      ========================= */

      colors: {
        /* RENIX namespace */
        renix: {
          bg: {
            darkTop: "#121621",
            darkMid: "#0b0e14",
            darkBottom: "#000000",
          },
          surface: {
            primary: "#121621",
            secondary: "#1a1f2e",
            tertiary: "#242a3a",
          },
          text: {
            primary: "#e5e7eb",
            secondary: "#9ca3af",
            muted: "#6b7280",
          },
          accent: {
            copper: "#B8805A",
            copperHover: "#A06F4C",
          },
          signal: {
            success: "#34C759",
            warning: "#FFAA33",
            danger: "#E8503A",
            info: "#5B9BD5",
          },
          status: {
            draft: "#FFAA33",
            active: "#5B9BD5",
            healthy: "#34C759",
            risk: "#E8503A",
          },
        },

        /* Background gradients — clean cool */
        bgLight: {
          1: "#ffffff",
          2: "#f6f7f9",
          3: "#eceff3",
        },
        bgDark: {
          1: "#121621",
          2: "#0b0e14",
          3: "#000000",
        },

        /* Surfaces — clean neutrals */
        surfaceLight: {
          1: "#FFFFFF",
          2: "#f1f3f6",
          3: "#e8ebf0",
        },
        surfaceDark: {
          1: "#121621",
          2: "#1a1f2e",
          3: "#242a3a",
        },

        /* Text — crisp slate */
        textLight: {
          primary: "#0f172a",
          secondary: "#475569",
          muted: "#64748b",
        },
        textDark: {
          primary: "#e5e7eb",
          secondary: "#9ca3af",
          muted: "#6b7280",
        },

        /* Accent & Status */
        accent: {
          copper: "#B8805A",
          primary: "hsl(var(--accent-primary) / <alpha-value>)",
        },
        status: {
          draft: "#FFAA33",
          pending: "#5B9BD5",
          approved: "#34C759",
          declined: "#E8503A",
          ok: "hsl(var(--status-ok) / <alpha-value>)",
        },
        signal: {
          success: "#34C759",
          warning: "#FFAA33",
          danger: "#E8503A",
          info: "#5B9BD5",
        },

        /* Shadcn compatibility tokens */
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          ring: "hsl(var(--sidebar-ring) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
          primary: "hsl(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
        },
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
          "6": "hsl(var(--chart-6) / <alpha-value>)",
          "7": "hsl(var(--chart-7) / <alpha-value>)",
          "8": "hsl(var(--chart-8) / <alpha-value>)",
        },
      },

      /* =========================
         TYPOGRAPHY
      ========================= */

      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif"
        ],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },

      /* =========================
         BORDERS & RADIUS
      ========================= */

      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "10px",
        lg: "14px",
        xl: "18px",
      },

      borderColor: {
        light: "rgba(15,23,42,0.10)",
        dark: "rgba(229,231,235,0.10)",
      },

      /* =========================
         SHADOWS — 4-TIER ELEVATION SYSTEM
      ========================= */

      boxShadow: {
        "elevation-1": "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "elevation-2": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        "elevation-3": "0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)",
        "elevation-4": "0 16px 48px rgba(0,0,0,0.16), 0 8px 16px rgba(0,0,0,0.08)",
        soft: "0 6px 24px rgba(0,0,0,0.12)",
        subtle: "0 2px 10px rgba(0,0,0,0.08)",
        none: "none",
      },

      /* =========================
         OPACITY
      ========================= */

      opacity: {
        disabled: "0.45",
      },

      /* =========================
         BACKDROP BLUR
      ========================= */

      backdropBlur: {
        xs: "4px",
        sm: "8px",
        md: "12px",
      },

      /* =========================
         ANIMATIONS
      ========================= */

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },

  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
