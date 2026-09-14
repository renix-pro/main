/**
 * RENIX vNext — Project Space Layout
 * 
 * Canon v1.4 Compliant — Phase 4, Workstream D
 * 
 * This component defines the structural layout of the Project Space.
 * Visual styling applied using Tailwind CSS.
 * 
 * Structural regions:
 * - Project Identity: Persistent project context
 * - Project Navigation: Frame navigation tabs
 * - Frame Content: Current frame container
 * - AI Companion Anchor: Stable position for AI presence
 */

import type { ReactNode } from 'react';
import { LAYOUT_REGIONS, getRegionRole } from './schema';

export interface ProjectSpaceLayoutProps {
  identity: ReactNode;
  navigation: ReactNode;
  content: ReactNode;
  companion?: ReactNode;
}

export function ProjectSpaceLayout({
  identity,
  navigation,
  content,
  companion,
}: ProjectSpaceLayoutProps) {
  return (
    <div
      data-layout-region={LAYOUT_REGIONS.PROJECT_SPACE}
      data-testid="layout-project-space"
      className="min-h-screen flex flex-col"
    >
      <div
        data-layout-region={LAYOUT_REGIONS.PROJECT_IDENTITY}
        data-testid="region-project-identity"
        role={getRegionRole(LAYOUT_REGIONS.PROJECT_IDENTITY)}
        aria-label="Project identity"
      >
        {identity}
      </div>

      <div
        data-layout-region={LAYOUT_REGIONS.PROJECT_NAVIGATION}
        data-testid="region-project-navigation"
        role={getRegionRole(LAYOUT_REGIONS.PROJECT_NAVIGATION)}
        aria-label="Project navigation"
      >
        {navigation}
      </div>

      <div
        data-layout-region={LAYOUT_REGIONS.FRAME_CONTENT}
        data-testid="region-frame-content"
        role={getRegionRole(LAYOUT_REGIONS.FRAME_CONTENT)}
        aria-label="Frame content"
        className="flex-1"
      >
        {content}
      </div>

      <div
        data-layout-region={LAYOUT_REGIONS.AI_COMPANION_ANCHOR}
        data-testid="region-ai-companion-anchor"
        role={getRegionRole(LAYOUT_REGIONS.AI_COMPANION_ANCHOR)}
        aria-label="AI companion"
        className="fixed bottom-6 right-6 z-40"
      >
        {companion}
      </div>
    </div>
  );
}

export default ProjectSpaceLayout;
