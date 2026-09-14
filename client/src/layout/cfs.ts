/**
 * RENIX vNext — Common Frame Structure (CFS)
 * 
 * Canon v1.4 Compliant — Authoritative Structural Scaffold
 * 
 * This structure is MANDATORY for: Scope, Budget, Financing, Quotes
 * This structure is NOT applied to: Overview, Timeline/Execution, AI-only frames
 * 
 * CFS defines INFORMATION ARCHITECTURE, not business logic.
 * Individual frames may specialize content, never structure.
 */

/**
 * CFS Zone Identifiers
 * 
 * Semantic zones that are NOT interchangeable, reorderable, or optional.
 */
export const CFS_ZONES = {
  ZONE1_POSTURE: 'zone1-posture',
  ZONE1A_TILES: 'zone1a-tiles',
  ZONE1B_VISUAL: 'zone1b-visual',
  ZONE2_EXPLORE: 'zone2-explore',
  ZONE3_FOCUS: 'zone3-focus',
} as const;

export type CFSZone = typeof CFS_ZONES[keyof typeof CFS_ZONES];

/**
 * Zone Purposes (Read-Only Reference)
 */
export const ZONE_PURPOSES = {
  [CFS_ZONES.ZONE1_POSTURE]: 'Where do I stand right now?',
  [CFS_ZONES.ZONE1A_TILES]: 'Orientation tiles (totals, posture, assumptions)',
  [CFS_ZONES.ZONE1B_VISUAL]: 'Spatial explanation (distribution, mix, relationship)',
  [CFS_ZONES.ZONE2_EXPLORE]: 'What objects exist, and which one should I look at?',
  [CFS_ZONES.ZONE3_FOCUS]: 'What am I deciding or editing right now?',
} as const;

/**
 * Zone Visibility Rules (NON-NEGOTIABLE)
 * 
 * - Zone 1 MUST NEVER be fully hidden or collapsed
 * - Zone 2 MAY be collapsed
 * - Zone 3 MAY be collapsed
 * - Zone 2 and Zone 3 MUST NEVER both be collapsed simultaneously
 */
export interface ZoneVisibilityState {
  zone1Visible: true;
  zone2Collapsed: boolean;
  zone3Collapsed: boolean;
}

export function validateZoneVisibility(state: ZoneVisibilityState): boolean {
  if (!state.zone1Visible) return false;
  if (state.zone2Collapsed && state.zone3Collapsed) return false;
  return true;
}

export function getDefaultZoneVisibility(): ZoneVisibilityState {
  return {
    zone1Visible: true,
    zone2Collapsed: false,
    zone3Collapsed: false,
  };
}

/**
 * CFS Tile Types
 * 
 * Zone1A tiles and Zone2 tiles have different purposes:
 * - Zone1A: Posture tiles (read-only or lightly editable)
 * - Zone2: Entity tiles (selection triggers Zone3)
 */
export interface PostureTile {
  id: string;
  type: 'number' | 'message';
  label: string;
  value: string | number;
  subtext?: string;
  isEditable?: boolean;
  onEdit?: () => void;
}

export interface EntityTile {
  id: string;
  name: string;
  color?: string;
  isAddNew?: boolean;
}

/**
 * CFS Color Rules
 * 
 * Color represents IDENTITY, not evaluation.
 * Same entity MUST use the same color across all zones.
 * Color MUST NOT indicate risk, error, priority, urgency, or status.
 */
export const CFS_COLOR_RULES = {
  USE_FOR: ['identity', 'categorization', 'visual continuity'],
  NEVER_USE_FOR: ['risk', 'error', 'priority', 'urgency', 'status', 'success', 'failure'],
} as const;

/**
 * CFS Anti-Drift Prohibitions (HARD FAIL)
 * 
 * These behaviors are STRICTLY FORBIDDEN in CFS-compliant frames.
 */
export const CFS_PROHIBITIONS = [
  'Treating Zone 1 as a dashboard',
  'KPI scoring language',
  'Red/green indicators',
  'Icons that imply correctness or error',
  'Editing inside Zone 2 tiles',
  'Multi-entity editing in Zone 3',
  'Reordering entities automatically',
  'Hiding unselected entities entirely',
  'Collapsing all zones except Zone 1',
] as const;

/**
 * CFS Success Criteria
 * 
 * A frame is CFS-compliant only if:
 * - User can orient in <5 seconds without scrolling
 * - Exploration does not disrupt posture awareness
 * - Focused editing is distraction-free
 * - Cross-frame behavior feels identical in structure
 * - Frame logic is predictable and learnable
 * - No semantic drift occurs as complexity grows
 */
export const CFS_SUCCESS_CRITERIA = [
  'Orient in <5 seconds without scrolling',
  'Exploration preserves posture awareness',
  'Focused editing is distraction-free',
  'Cross-frame structural consistency',
  'Predictable and learnable logic',
  'No semantic drift with complexity',
] as const;

/**
 * Frames that MUST use CFS
 */
export const CFS_APPLICABLE_FRAMES = ['scope', 'budget', 'financing', 'quotes'] as const;

/**
 * Check if a frame should use CFS
 */
export function isCFSApplicable(frameId: string): boolean {
  return (CFS_APPLICABLE_FRAMES as readonly string[]).includes(frameId.toLowerCase());
}
