/**
 * RENIX vNext — Frame Navigation
 * 
 * Canon v1.4 Compliant — Phase 12
 * 
 * Horizontal nav under context bar.
 * Active frame uses accent-primary underline.
 * Inactive frames use text-secondary.
 * No hover animations beyond color change.
 */

import { useProject } from '../context/ProjectContext';
import { CANONICAL_FRAMES, FRAME_METADATA, type CanonicalFrame } from '../spine/appSpine';
import { isFrameVisible } from '../navigation/visibility';

export function FrameNavigation() {
  const { activeFrame, setActiveFrame, projectStatus } = useProject();
  
  return (
    <nav 
      className="border-b border-divider bg-panel" 
      aria-label="Frame navigation"
      data-testid="nav-frames"
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center gap-1 overflow-x-auto">
          {CANONICAL_FRAMES.filter(frame => isFrameVisible(frame, projectStatus)).map((frame) => {
            const isActive = frame === activeFrame;
            const meta = FRAME_METADATA[frame];
            
            return (
              <button
                key={frame}
                onClick={() => setActiveFrame(frame)}
                className="relative px-4 py-3 text-sm whitespace-nowrap transition-colors duration-100"
                style={{
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))'
                }}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`tab-frame-${frame}`}
              >
                {meta.label}
                {isActive && (
                  <span 
                    className="absolute bottom-0 left-4 right-4 h-0.5 bg-accent-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export default FrameNavigation;
