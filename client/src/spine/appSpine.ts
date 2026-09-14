/**
 * RENIX vNext — Application Spine
 * 
 * Canon v1.4 Compliant
 * 
 * This file defines the hard-locked frame list and core application structure.
 * No dynamic frames. No flags. No "future" ideas.
 */

/**
 * Canonical Frame List (Hard-Locked)
 * 
 * These are the ONLY frames in RENIX vNext.
 * This list is immutable and cannot be extended without canon change.
 */
export const CANONICAL_FRAMES = [
  'overview',
  'vision',
  'scope',
  'budget',
  'financing',
  'quotes',
  'invoices',
  'execution',
  'documents',
] as const;

export type CanonicalFrame = typeof CANONICAL_FRAMES[number];

/**
 * Frame metadata for display purposes only.
 * No workflow logic. No gating. No readiness checks.
 */
export const FRAME_METADATA: Record<CanonicalFrame, { label: string; description: string }> = {
  overview: {
    label: 'Overview',
    description: 'Signals, momentum, attention',
  },
  vision: {
    label: 'Vision',
    description: 'Intent and inspiration',
  },
  scope: {
    label: 'Scope',
    description: 'What is being changed',
  },
  budget: {
    label: 'Budget',
    description: 'Intent and scenarios',
  },
  quotes: {
    label: 'Quotes',
    description: 'External estimates',
  },
  invoices: {
    label: 'Invoices',
    description: 'Financial reality',
  },
  financing: {
    label: 'Financing',
    description: 'Cash-flow constraints',
  },
  execution: {
    label: 'Execution',
    description: 'Current happenings',
  },
  documents: {
    label: 'Documents',
    description: 'Memory and evidence',
  },
};

/**
 * Default frame on project entry, refresh, or frame exit.
 * This is NOT configurable.
 */
export const DEFAULT_FRAME: CanonicalFrame = 'overview';

/**
 * Validates if a string is a valid canonical frame.
 */
export function isCanonicalFrame(frame: string): frame is CanonicalFrame {
  return CANONICAL_FRAMES.includes(frame as CanonicalFrame);
}
