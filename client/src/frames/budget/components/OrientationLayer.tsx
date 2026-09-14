/**
 * RENIX vNext — Zone1 Posture Layer (CFS Compliant)
 * 
 * Canon v1.4 Compliant — Common Frame Structure
 * 
 * Zone 1 Purpose: "Where do I stand right now?"
 * - MUST always be present
 * - MUST never be fully hidden
 * - MUST NOT require interaction to understand
 * 
 * Structure:
 * - Zone1A_PostureTiles: Vertical stack of posture tiles
 * - Zone1B_PrimaryVisual: BudgetDistributionDonut (constrained to tiles height)
 * 
 * Responsive:
 * - Desktop: Side-by-side (tiles left, visual right)
 * - Mobile: Stacked (tiles above, visual below)
 */

import { type ReactNode, type ReactElement, useRef, useState, useEffect, cloneElement, isValidElement } from 'react';
import { BudgetHeader } from './BudgetHeader';
import { OrientationTiles, type OrientationTilesProps } from './OrientationTiles';

export interface OrientationLayerProps extends OrientationTilesProps {
  children?: ReactNode;
}

export function OrientationLayer({
  totalBudget,
  currency,
  allocatedTotal,
  contingencyMode,
  contingencyValue,
  isReadOnly,
  onSaveTotalBudget,
  onEditContingency,
  children,
}: OrientationLayerProps) {
  const tilesRef = useRef<HTMLDivElement>(null);
  const [tilesHeight, setTilesHeight] = useState<number | undefined>(undefined);
  
  useEffect(() => {
    if (!tilesRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTilesHeight(entry.contentRect.height);
      }
    });
    
    observer.observe(tilesRef.current);
    return () => observer.disconnect();
  }, []);
  
  const childWithMaxHeight = isValidElement(children)
    ? cloneElement(children as ReactElement<{ maxHeight?: number }>, { maxHeight: tilesHeight })
    : children;
  
  return (
    <section
      data-testid="zone1-posture"
      data-cfs-zone="zone1-posture"
      className="w-full"
    >
      <BudgetHeader />
      
      <div className="renix-grid items-start mt-6">
        <div
          ref={tilesRef}
          data-testid="zone1a-tiles"
          data-cfs-zone="zone1a-tiles"
          className="renix-col-primary"
        >
          <OrientationTiles
            totalBudget={totalBudget}
            currency={currency}
            allocatedTotal={allocatedTotal}
            contingencyMode={contingencyMode}
            contingencyValue={contingencyValue}
            isReadOnly={isReadOnly}
            onSaveTotalBudget={onSaveTotalBudget}
            onEditContingency={onEditContingency}
          />
        </div>
        
        {children && (
          <div
            data-testid="zone1b-visual"
            data-cfs-zone="zone1b-visual"
            className="renix-col-secondary flex items-center justify-center"
          >
            {childWithMaxHeight}
          </div>
        )}
      </div>
    </section>
  );
}
