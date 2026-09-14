/**
 * RENIX vNext — Routing Structure
 * 
 * Canon v1.4 Compliant — Phase 4, Workstream A
 * 
 * This file defines the canonical routing structure.
 * 
 * Routing rules:
 * - Project Overview is the default entry point
 * - Return path to Overview is guaranteed from all frames
 * - Invalid frame routes redirect to Overview
 * 
 * This file does NOT:
 * - Implement actual routing (that's FrameRouter's job)
 * - Apply visual styling or transitions
 * - Encode workflow or progress logic
 */

import { DEFAULT_FRAME, CANONICAL_FRAMES, isCanonicalFrame, type CanonicalFrame } from '../spine/appSpine';
import type { ProjectStatus } from '../spine/projectLifecycle';
import { isFrameVisible } from './visibility';

/**
 * Route Definition
 * 
 * Structural definition of a route.
 */
export interface RouteDefinition {
  readonly path: string;
  readonly frame?: CanonicalFrame;
  readonly isDefault?: boolean;
}

/**
 * Projects Area Routes
 * 
 * Routes for the global projects list area.
 */
export const PROJECTS_ROUTES: readonly RouteDefinition[] = [
  {
    path: '/',
    isDefault: true,
  },
  {
    path: '/projects',
  },
] as const;

/**
 * Project Space Routes
 * 
 * Routes for frames within a selected project.
 * Generated from CANONICAL_FRAMES for consistency.
 */
export const PROJECT_FRAME_ROUTES: readonly RouteDefinition[] = CANONICAL_FRAMES.map(
  (frame): RouteDefinition => ({
    path: `/project/:projectId/${frame}`,
    frame,
    isDefault: frame === DEFAULT_FRAME,
  })
);

/**
 * All Project Routes (including project root)
 */
export const PROJECT_ROUTES: readonly RouteDefinition[] = [
  {
    path: '/project/:projectId',
    frame: DEFAULT_FRAME,
    isDefault: true,
  },
  ...PROJECT_FRAME_ROUTES,
] as const;

/**
 * Default Entry Point
 * 
 * When entering a project, this is the default frame.
 * This is NOT configurable.
 */
export const DEFAULT_ENTRY_FRAME: CanonicalFrame = DEFAULT_FRAME;

/**
 * Return Path Frame
 * 
 * The frame to return to when exiting any other frame.
 * Guarantees return path to Overview from all frames.
 */
export const RETURN_PATH_FRAME: CanonicalFrame = 'overview';

/**
 * Resolve frame from URL or default.
 * 
 * @param frameParam - Frame parameter from URL (may be invalid)
 * @param projectStatus - Current project status (for visibility check)
 * @returns Valid frame to display
 */
export function resolveFrame(
  frameParam: string | undefined,
  projectStatus: ProjectStatus
): CanonicalFrame {
  if (!frameParam) {
    return DEFAULT_ENTRY_FRAME;
  }
  
  if (!isCanonicalFrame(frameParam)) {
    return DEFAULT_ENTRY_FRAME;
  }
  
  if (!isFrameVisible(frameParam, projectStatus)) {
    return DEFAULT_ENTRY_FRAME;
  }
  
  return frameParam;
}

/**
 * Get return path frame.
 * 
 * Returns the frame to navigate to when returning from any frame.
 * Always returns Overview.
 */
export function getReturnPath(): CanonicalFrame {
  return RETURN_PATH_FRAME;
}

/**
 * Check if current frame is the default entry point.
 */
export function isDefaultEntry(frame: CanonicalFrame): boolean {
  return frame === DEFAULT_ENTRY_FRAME;
}

/**
 * Build route path for a frame.
 */
export function buildRoutePath(projectId: string, frame: CanonicalFrame): string {
  return `/project/${projectId}/${frame}`;
}

/**
 * Build default entry route for a project.
 */
export function buildDefaultEntryPath(projectId: string): string {
  return buildRoutePath(projectId, DEFAULT_ENTRY_FRAME);
}
