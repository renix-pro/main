/**
 * RENIX vNext — UI Primitive Patterns
 * 
 * THIS FILE DOCUMENTS EXISTING PATTERNS — NO NEW PRIMITIVES INVENTED.
 * Each pattern includes source file citations where the pattern is used.
 * 
 * Actual UI primitives are in @/components/ui/ (Shadcn components).
 * This file provides helpers for consistent usage of established patterns.
 */

// =============================================================================
// LAYOUT PATTERNS (commonly used class combinations)
// =============================================================================

/**
 * Standard frame container with vertical spacing
 * Used in: documents/index.tsx, execution/index.tsx, overview/index.tsx
 */
export const frameContainer = 'h-full space-y-4';

/**
 * Frame container with comfortable spacing and max-width
 * Used in: financing/index.tsx
 */
export const frameContainerLg = 'min-h-full space-y-6 max-w-6xl mx-auto p-4 md:p-6';

/**
 * Frame header with flex layout for title + actions
 * Used in: documents/index.tsx, execution/index.tsx, invoices/index.tsx
 */
export const frameHeader = 'flex items-center justify-between gap-4 flex-wrap';

/**
 * Responsive 12-column grid (collapses to 1 column on mobile)
 * Used in: overview/index.tsx
 */
export const responsiveGrid = 'grid grid-cols-12 max-md:grid-cols-1 gap-4';

/**
 * RENIX two-column grid (4:8 ratio)
 * Used in: budget/index.tsx
 * Source: index.css .renix-grid
 */
export const renixGrid = 'renix-grid';

// =============================================================================
// CARD PATTERNS
// =============================================================================

/**
 * Card header with action buttons (right-aligned)
 * Used in: quotes/QuoteCard.tsx, documents/DocumentCard.tsx
 */
export const cardHeaderWithActions = 'flex flex-row items-start justify-between gap-4 py-4';

// =============================================================================
// MOTION PRESETS (Framer Motion)
// =============================================================================

/**
 * Standard fade-in animation for frames
 * Used in: documents/index.tsx, execution/index.tsx, invoices/index.tsx
 */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.15 },
} as const;

/**
 * Slide-up fade animation for zones/sections
 * Used in: overview/OverviewLayout.tsx
 */
export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2 },
} as const;

// =============================================================================
// TEXT HIERARCHY (Tailwind utility classes)
// =============================================================================

/**
 * Primary text (highest contrast)
 * Source: Tailwind text-foreground
 */
export const textPrimary = 'text-foreground';

/**
 * Secondary text (medium contrast)
 * Source: index.css .text-secondary utility
 */
export const textSecondary = 'text-secondary';

/**
 * Muted text (lowest contrast)
 * Source: Tailwind text-muted-foreground
 */
export const textMuted = 'text-muted-foreground';

// =============================================================================
// SURFACE CLASSES (CSS utility classes from index.css)
// =============================================================================

/**
 * Primary surface (cards, panels)
 * Source: index.css .renix-surface
 */
export const surfacePrimary = 'renix-surface';

/**
 * Secondary surface (nested panels)
 * Source: index.css .renix-surface + .renix-surface-secondary
 */
export const surfaceSecondary = 'renix-surface renix-surface-secondary';

/**
 * Glass surface (translucent with blur)
 * Source: index.css .renix-glass
 */
export const surfaceGlass = 'renix-glass';

/**
 * Frame surface (main frame container)
 * Source: index.css .renix-frame
 */
export const surfaceFrame = 'renix-frame';
