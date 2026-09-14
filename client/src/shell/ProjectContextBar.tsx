/**
 * RENIX vNext — Project Context Bar
 * 
 * AUTHORITATIVE DESIGN: Mission-first identity anchor.
 * 
 * STRUCTURE (TWO ELEMENTS):
 * 1. Project Name (HERO) — the mission title
 * 2. Last Meaningful Update (SECONDARY) — recency signal
 * 
 * PLACEMENT:
 * - Directly below Global Shell Bar
 * - Sticky while inside a project
 * - Hidden outside a project
 * 
 * NOTE: Navigation toggle moved to FrameNavigationPanel (ChatGPT-style).
 * Toggle is now integrated into the nav panel header itself.
 * 
 * EXPLICIT EXCLUSIONS:
 * - Project type, country/region, currency, status
 * - Progress indicators, metrics, alerts, AI signals
 * - Settings access, breadcrumbs, tabs
 * 
 * PURPOSE: "I know exactly which mission I'm in — and can focus when I need to."
 */

import { useProject } from '../context/ProjectContext';

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  if (hours < 24) return `Updated ${hours}h ago`;
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  if (days < 30) return `Updated ${Math.floor(days / 7)} weeks ago`;
  return `Updated ${Math.floor(days / 30)} months ago`;
}

export function ProjectContextBar() {
  const { projectName, lastMeaningfulUpdate } = useProject();
  
  const relativeTime = formatRelativeTime(lastMeaningfulUpdate ?? Date.now());

  return (
    <div 
      className="h-10 renix-glass renix-project-bar sticky top-12 z-40 select-none"
      data-testid="project-context-bar"
    >
      <div className="h-full px-4 flex items-center gap-4">
        <span 
          className="font-semibold truncate flex-1 text-2xl"
          data-testid="text-project-name"
        >
          {projectName}
        </span>
        
        <span 
          className="text-xs whitespace-nowrap flex-shrink-0 text-muted"
          data-testid="text-last-update"
        >
          {relativeTime}
        </span>
      </div>
    </div>
  );
}

export default ProjectContextBar;
