/**
 * RENIX vNext — Budget Frame Styles
 * 
 * Canon v1.4 Compliant
 * RENIX Design Tokens
 * 
 * Uses semantic tokens from index.css for consistent theming.
 */

export const budgetStyles = {
  surface: 'renix-surface',
  
  container: '',
  
  border: 'border border-subtle',
  
  borderTop: 'border-t border-subtle',
  
  text: '',
  
  textSemibold: 'font-semibold',
  
  link: 'underline-offset-2 hover:underline',
  
  badge: 'border border-subtle',
  
  section: '',
  
  card: 'renix-surface',
} as const;

export const svgStyles = {
  stroke: 'stroke-current',
  fill: 'fill-current',
  fillNone: 'fill-none',
} as const;
