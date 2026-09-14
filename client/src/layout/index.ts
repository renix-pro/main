/**
 * RENIX vNext — Layout Module
 * 
 * Canon v1.4 Compliant — Phase 4, Workstream B
 * 
 * Re-exports all layout-related functionality.
 */

export * from './schema';
export * from './cfs';
export { ProjectSpaceLayout, type ProjectSpaceLayoutProps } from './ProjectSpaceLayout';
export { ProjectsAreaLayout, type ProjectsAreaLayoutProps } from './ProjectsAreaLayout';
export {
  CFSFrameRoot,
  Zone1Posture,
  Zone1ATiles,
  Zone1BVisual,
  PostureTile,
  Zone2Explore,
  EntityTileGrid,
  EntityTile,
  Zone3Focus,
  useCFSZoneState,
} from './CFSLayout';
