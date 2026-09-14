/**
 * RENIX vNext — Frame Container
 * 
 * Matches reference design: Clean frame header with title and menu
 */

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FrameContainerProps {
  projectName: string;
  frameName: string;
  metadata?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function FrameContainer({
  frameName,
  children,
  footer,
  className,
}: FrameContainerProps) {
  return (
    <div 
      className={cn("h-full flex flex-col overflow-hidden bg-background/80 backdrop-blur-sm", className)}
      data-testid="frame-container"
    >
      {/* Frame Header - matches reference: just title and menu */}
      <header 
        className="flex-shrink-0 h-12 px-4 hidden md:flex items-center justify-between border-b border-border/30"
        data-testid="frame-header"
      >
        <h1 
          className="text-lg font-semibold text-foreground"
          data-testid="frame-header-frame"
        >
          {frameName}
        </h1>
        
      </header>

      {/* Frame Body */}
      <div 
        className="flex-1 overflow-y-auto p-4"
        data-testid="frame-body"
      >
        {children}
      </div>

      {/* Frame Footer - optional */}
      {footer && (
        <footer 
          className="flex-shrink-0 border-t border-border/30"
          data-testid="frame-footer"
        >
          {footer}
        </footer>
      )}
    </div>
  );
}

export default FrameContainer;
