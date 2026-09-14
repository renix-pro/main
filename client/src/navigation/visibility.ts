/**
 * RENIX vNext — Navigation Visibility
 * 
 * Canon v1.4 Compliant
 * 
 * This file defines visibility gating logic for navigation items.
 * 
 * Visibility rules:
 * - All frames are always visible
 * 
 * This file does NOT:
 * - Apply visual styling or emphasis
 * - Calculate readiness or progress
 * - Enforce access control beyond visibility
 * - Gate based on content or completeness
 */

import type { CanonicalFrame } from '../spine/appSpine';
import type { ProjectStatus } from '../spine/projectLifecycle';

/**
 * Check if a frame is visible given the project status.
 * All frames are always visible.
 */
export function isFrameVisible(frame: CanonicalFrame, projectStatus: ProjectStatus): boolean {
  return true;
}

/**
 * Get list of visible frames for a given project status.
 * Returns all frames in canonical order.
 */
export function getVisibleFrames<T extends CanonicalFrame>(
  frames: readonly T[],
  projectStatus: ProjectStatus
): T[] {
  return frames.filter(frame => isFrameVisible(frame, projectStatus));
}

/**
 * Check if a frame has conditional visibility.
 */
export function hasConditionalVisibility(frame: CanonicalFrame): boolean {
  return false;
}

/**
 * Check if user can navigate to a frame.
 */
export function canNavigateToFrame(frame: CanonicalFrame, projectStatus: ProjectStatus): boolean {
  return isFrameVisible(frame, projectStatus);
}
