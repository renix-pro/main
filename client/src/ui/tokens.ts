/**
 * RENIX vNext — UI Design Tokens
 * 
 * THIS FILE MIRRORS EXISTING VALUES — NO NEW TOKENS INVENTED.
 * 
 * SOURCE OF TRUTH:
 * - Colors, surfaces, text, borders: index.css (CSS variables)
 * - Border radius, shadows, blur: tailwind.config.ts (theme.extend)
 * - Motion durations: Observed from Framer Motion usage in frames
 * 
 * PALETTE: Modern Cool — Clean Neutrals / Copper Accent
 * 
 * IMPORTANT: If values drift, update index.css/tailwind.config.ts first,
 * then sync this file. CSS variables are the canonical source.
 */

// =============================================================================
// SPACING (Tailwind defaults - documented for programmatic reference)
// =============================================================================

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// =============================================================================
// COLORS — Mirrors index.css CSS variables exactly
// Palette: Modern Cool — Clean Neutrals / Copper Accent
// =============================================================================

export const colors = {
  background: {
    light: {
      1: '#ffffff',    // --bg-light-1 (clean white)
      2: '#f6f7f9',    // --bg-light-2 (cool gray)
      3: '#eceff3',    // --bg-light-3 (deepest cool)
    },
    dark: {
      1: '#121621',    // --bg-dark-1 (deep navy)
      2: '#0b0e14',    // --bg-dark-2 (darker navy)
      3: '#000000',    // --bg-dark-3 (black)
    },
  },
  
  surface: {
    light: {
      primary: '#FFFFFF',    // --surface-light-1
      secondary: '#f1f3f6',  // --surface-light-2
      tertiary: '#e8ebf0',   // --surface-light-3
    },
    dark: {
      primary: '#121621',    // --surface-dark-1
      secondary: '#1a1f2e',  // --surface-dark-2
      tertiary: '#242a3a',   // --surface-dark-3
    },
  },
  
  text: {
    light: {
      primary: '#0f172a',    // --text-light-primary
      secondary: '#475569',  // --text-light-secondary
      muted: '#64748b',      // --text-light-muted
    },
    dark: {
      primary: '#e5e7eb',    // --text-dark-primary
      secondary: '#9ca3af',  // --text-dark-secondary
      muted: '#6b7280',      // --text-dark-muted
    },
  },
  
  accent: {
    copper: '#B8805A',       // --accent-copper
    copperHover: '#A06F4C',  // --accent-copper-hover
  },
  
  status: {
    draft: '#FFAA33',    // --status-draft (amber)
    pending: '#5B9BD5',  // --status-pending (steel blue)
    approved: '#34C759', // --status-approved (emerald)
    declined: '#E8503A', // --status-declined (coral red)
  },

  signal: {
    success: '#34C759',  // --signal-success (emerald)
    warning: '#FFAA33',  // --signal-warning (amber)
    danger: '#E8503A',   // --signal-danger (coral red)
    info: '#5B9BD5',     // --signal-info (steel blue)
  },
  
  palette: {
    copper: '#B8805A',    // --renix-copper
    emerald: '#34C759',   // --renix-emerald
    amber: '#FFAA33',     // --renix-amber
    coral: '#E8503A',     // --renix-coral
    steel: '#5B9BD5',     // --renix-steel
    sage: '#7BAE7F',      // --renix-sage
    clay: '#D4915C',      // --renix-clay
    slate: '#8E8E93',     // --renix-slate
  },
  
  border: {
    light: 'rgba(15, 23, 42, 0.10)',  // --border-light
    dark: 'rgba(229, 231, 235, 0.10)', // --border-dark
  },
} as const;

// =============================================================================
// ELEVATION (Shadows) — 4-tier system
// =============================================================================

export const elevation = {
  none: 'none',
  level1: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  level2: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
  level3: '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)',
  level4: '0 16px 48px rgba(0,0,0,0.16), 0 8px 16px rgba(0,0,0,0.08)',
  subtle: '0 2px 10px rgba(0,0,0,0.08)',
  soft: '0 6px 24px rgba(0,0,0,0.12)',
} as const;

// =============================================================================
// BORDER RADIUS
// =============================================================================

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '18px',
  full: '9999px',
} as const;

// =============================================================================
// MOTION
// =============================================================================

export const motion = {
  duration: {
    fast: 0.15,
    normal: 0.2,
    slow: 0.25,
  },
  easing: {
    easeOut: 'easeOut',
    easeInOut: 'easeInOut',
  },
} as const;

// =============================================================================
// OPACITY
// =============================================================================

export const opacity = {
  disabled: 0.45,
  glass: 0.75,
} as const;

// =============================================================================
// BACKDROP BLUR
// =============================================================================

export const blur = {
  xs: '4px',
  sm: '8px',
  md: '12px',
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Spacing = keyof typeof spacing;
export type FontSize = keyof typeof typography.fontSize;
export type StatusColor = keyof typeof colors.status;
export type Elevation = keyof typeof elevation;
export type Radius = keyof typeof radius;
