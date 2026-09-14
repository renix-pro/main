/**
 * RENIX vNext — Projects Area Layout
 * 
 * Canon v1.4 Compliant — Phase 4, Workstream B
 * 
 * This component defines the structural layout of the Projects Area.
 * This is the layout OUTSIDE any project — the global project list.
 * 
 * Structural regions:
 * - Header: Application identity and global controls
 * - Content: Projects list or global navigation
 * 
 * This component does NOT:
 * - Apply visual styling, colors, typography, or motion
 * - Add workflows or progress indicators
 */

import type { ReactNode } from 'react';
import { LAYOUT_REGIONS, getRegionRole } from './schema';

/**
 * Props for Projects Area Layout
 */
export interface ProjectsAreaLayoutProps {
  header: ReactNode;
  content: ReactNode;
}

/**
 * Projects Area Layout Component
 * 
 * Provides the structural layout for the area outside any project.
 * This is where users see the project list and global navigation.
 */
export function ProjectsAreaLayout({
  header,
  content,
}: ProjectsAreaLayoutProps) {
  return (
    <div
      data-layout-region={LAYOUT_REGIONS.PROJECTS_AREA}
      data-testid="layout-projects-area"
      className="min-h-screen flex flex-col"
    >
      <div
        data-testid="region-projects-header"
        role="banner"
        aria-label="Application header"
      >
        {header}
      </div>

      <div
        data-testid="region-projects-content"
        role={getRegionRole(LAYOUT_REGIONS.PROJECTS_AREA)}
        aria-label="Projects content"
        className="flex-1"
      >
        {content}
      </div>
    </div>
  );
}

export default ProjectsAreaLayout;
