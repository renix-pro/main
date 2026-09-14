/**
 * RENIX vNext — Layout Schema
 * 
 * Canon v1.4 Compliant — Phase 4, Workstream B
 * 
 * This file defines the structural layout schema for the application.
 * 
 * Layout is:
 * - Invariant across all frames
 * - Purely structural (no visual styling)
 * - Non-semantic (no meaning attached to position)
 * 
 * Layout does NOT include:
 * - Visual styling, colors, typography, or motion
 * - Frame-specific layouts or behaviors
 * - Workflow or progress indicators
 * - Semantic emphasis or promotion
 */

/**
 * Layout Region Identifiers
 * 
 * Canonical regions within the application layout.
 * These are structural identifiers only — no visual semantics.
 */
export const LAYOUT_REGIONS = {
  PROJECTS_AREA: 'projects-area',
  PROJECT_SPACE: 'project-space',
  PROJECT_IDENTITY: 'project-identity',
  PROJECT_NAVIGATION: 'project-navigation',
  FRAME_CONTENT: 'frame-content',
  AI_COMPANION_ANCHOR: 'ai-companion-anchor',
} as const;

export type LayoutRegion = typeof LAYOUT_REGIONS[keyof typeof LAYOUT_REGIONS];

/**
 * Layout Area Types
 * 
 * Two distinct layout areas exist:
 * - projects: Outside any project (project list, global navigation)
 * - project: Inside a single project (Project Space)
 */
export type LayoutArea = 'projects' | 'project';

/**
 * Project Space Regions
 * 
 * Structural regions within the Project Space.
 * Order reflects document flow only — no semantic priority.
 */
export const PROJECT_SPACE_REGIONS = [
  LAYOUT_REGIONS.PROJECT_IDENTITY,
  LAYOUT_REGIONS.PROJECT_NAVIGATION,
  LAYOUT_REGIONS.FRAME_CONTENT,
  LAYOUT_REGIONS.AI_COMPANION_ANCHOR,
] as const;

/**
 * Region Role Mapping
 * 
 * Maps regions to their structural role.
 * No visual or semantic interpretation.
 */
export const REGION_ROLES: Record<LayoutRegion, string> = {
  [LAYOUT_REGIONS.PROJECTS_AREA]: 'main',
  [LAYOUT_REGIONS.PROJECT_SPACE]: 'main',
  [LAYOUT_REGIONS.PROJECT_IDENTITY]: 'banner',
  [LAYOUT_REGIONS.PROJECT_NAVIGATION]: 'navigation',
  [LAYOUT_REGIONS.FRAME_CONTENT]: 'main',
  [LAYOUT_REGIONS.AI_COMPANION_ANCHOR]: 'complementary',
};

/**
 * Layout Slot Names
 * 
 * Named slots for layout composition.
 */
export const LAYOUT_SLOTS = {
  HEADER: 'header',
  NAVIGATION: 'navigation',
  CONTENT: 'content',
  COMPANION: 'companion',
} as const;

export type LayoutSlot = typeof LAYOUT_SLOTS[keyof typeof LAYOUT_SLOTS];

/**
 * Project Space Structure
 * 
 * Defines the structural composition of the Project Space.
 * This is the invariant layout for all frames.
 */
export interface ProjectSpaceStructure {
  readonly identity: {
    readonly region: typeof LAYOUT_REGIONS.PROJECT_IDENTITY;
    readonly slot: typeof LAYOUT_SLOTS.HEADER;
  };
  readonly navigation: {
    readonly region: typeof LAYOUT_REGIONS.PROJECT_NAVIGATION;
    readonly slot: typeof LAYOUT_SLOTS.NAVIGATION;
  };
  readonly content: {
    readonly region: typeof LAYOUT_REGIONS.FRAME_CONTENT;
    readonly slot: typeof LAYOUT_SLOTS.CONTENT;
  };
  readonly companion: {
    readonly region: typeof LAYOUT_REGIONS.AI_COMPANION_ANCHOR;
    readonly slot: typeof LAYOUT_SLOTS.COMPANION;
  };
}

/**
 * Canonical Project Space Structure
 */
export const PROJECT_SPACE_STRUCTURE: ProjectSpaceStructure = {
  identity: {
    region: LAYOUT_REGIONS.PROJECT_IDENTITY,
    slot: LAYOUT_SLOTS.HEADER,
  },
  navigation: {
    region: LAYOUT_REGIONS.PROJECT_NAVIGATION,
    slot: LAYOUT_SLOTS.NAVIGATION,
  },
  content: {
    region: LAYOUT_REGIONS.FRAME_CONTENT,
    slot: LAYOUT_SLOTS.CONTENT,
  },
  companion: {
    region: LAYOUT_REGIONS.AI_COMPANION_ANCHOR,
    slot: LAYOUT_SLOTS.COMPANION,
  },
} as const;

/**
 * Get ARIA role for a layout region.
 */
export function getRegionRole(region: LayoutRegion): string {
  return REGION_ROLES[region] ?? 'region';
}

/**
 * Check if currently in Project Space (inside a project).
 */
export function isInProjectSpace(area: LayoutArea): boolean {
  return area === 'project';
}

/**
 * Check if currently in Projects Area (outside any project).
 */
export function isInProjectsArea(area: LayoutArea): boolean {
  return area === 'projects';
}
