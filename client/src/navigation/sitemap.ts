/**
 * RENIX vNext — Sitemap & Navigation Definition
 * 
 * Canon v1.4 Compliant — Phase 4, Workstream A
 * 
 * This file defines the canonical sitemap and navigation structure.
 * 
 * Navigation is:
 * - Flat (no hierarchy within areas)
 * - Non-semantic (no meaning attached to position)
 * - Non-prioritized (no ordering implies importance)
 * 
 * Navigation does NOT include:
 * - Visual styling or emphasis
 * - Badges, counts, or indicators
 * - Grouping or categorization
 * - Workflow logic or progress
 * - Conditional ordering
 */

import { CANONICAL_FRAMES, FRAME_METADATA, type CanonicalFrame } from '../spine/appSpine';

/**
 * Navigation Area Types
 * 
 * Two distinct navigation areas exist:
 * - projects: Global navigation for the Projects Area (project list)
 * - project: Project-scoped navigation for the Project Space (frames)
 */
export type NavigationArea = 'projects' | 'project';

/**
 * Navigation Item
 * 
 * A single navigable destination.
 * Contains only structural data — no visual or behavioral properties.
 */
export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

/**
 * Frame Navigation Item
 * 
 * A navigation item specific to project frames.
 * Extends NavigationItem with frame-specific data.
 */
export interface FrameNavigationItem extends NavigationItem {
  readonly frame: CanonicalFrame;
  readonly description: string;
}

/**
 * Projects Area Navigation
 * 
 * Global navigation for the top-level Projects Area.
 * This is the entry point before any project is selected.
 */
export const PROJECTS_AREA_NAVIGATION: readonly NavigationItem[] = [
  {
    id: 'projects-list',
    label: 'Projects',
    path: '/projects',
  },
] as const;

/**
 * Project Space Navigation
 * 
 * Project-scoped navigation for frames within a selected project.
 * Derived from CANONICAL_FRAMES to ensure consistency.
 * 
 * Order matches CANONICAL_FRAMES — no semantic meaning implied.
 */
export const PROJECT_SPACE_NAVIGATION: readonly FrameNavigationItem[] = CANONICAL_FRAMES.map(
  (frame): FrameNavigationItem => ({
    id: `frame-${frame}`,
    label: FRAME_METADATA[frame].label,
    path: `/project/:projectId/${frame}`,
    frame,
    description: FRAME_METADATA[frame].description,
  })
);

/**
 * Get navigation items for a specific area.
 */
export function getNavigationItems(area: NavigationArea): readonly NavigationItem[] {
  switch (area) {
    case 'projects':
      return PROJECTS_AREA_NAVIGATION;
    case 'project':
      return PROJECT_SPACE_NAVIGATION;
    default:
      return [];
  }
}

/**
 * Get frame navigation item by frame ID.
 */
export function getFrameNavigationItem(frame: CanonicalFrame): FrameNavigationItem | undefined {
  return PROJECT_SPACE_NAVIGATION.find(item => item.frame === frame);
}

/**
 * Build project-specific path for a frame.
 */
export function buildFramePath(projectId: string, frame: CanonicalFrame): string {
  return `/project/${projectId}/${frame}`;
}

/**
 * Build path to project overview (default entry point).
 */
export function buildProjectOverviewPath(projectId: string): string {
  return buildFramePath(projectId, 'overview');
}
