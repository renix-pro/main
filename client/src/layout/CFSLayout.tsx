/**
 * RENIX vNext — Common Frame Structure Layout Components
 * 
 * Canon v1.4 Compliant — Mandatory Structural Scaffold
 * 
 * These components provide the CFS zone structure for:
 * Scope, Budget, Financing, Quotes frames.
 * 
 * Structure:
 * FrameRoot
 *  ├─ Zone1_Posture
 *  │   ├─ Zone1A_PostureTiles (vertical stack)
 *  │   └─ Zone1B_PrimaryVisual (single visual)
 *  ├─ Zone2_Explore (entity tile grid/carousel)
 *  └─ Zone3_Focus (single-entity editing surface)
 */

import { ReactNode, useState, useCallback, useMemo } from 'react';
import { CFS_ZONES, type ZoneVisibilityState, validateZoneVisibility, getDefaultZoneVisibility } from './cfs';

interface CFSFrameRootProps {
  children: ReactNode;
  'data-testid'?: string;
}

export function CFSFrameRoot({ children, 'data-testid': testId }: CFSFrameRootProps) {
  return (
    <div
      className="min-h-full renix-frame space-y-6 max-w-6xl mx-auto"
      data-testid={testId}
      data-cfs-frame="true"
    >
      {children}
    </div>
  );
}

interface Zone1PostureProps {
  children: ReactNode;
  'data-testid'?: string;
}

export function Zone1Posture({ children, 'data-testid': testId }: Zone1PostureProps) {
  return (
    <section
      data-cfs-zone={CFS_ZONES.ZONE1_POSTURE}
      data-testid={testId || 'zone1-posture'}
      className="w-full"
    >
      <div className="renix-grid items-start pt-[12px] pb-[12px]">
        {children}
      </div>
    </section>
  );
}

interface Zone1ATilesProps {
  children: ReactNode;
  'data-testid'?: string;
}

export function Zone1ATiles({ children, 'data-testid': testId }: Zone1ATilesProps) {
  return (
    <div
      data-cfs-zone={CFS_ZONES.ZONE1A_TILES}
      data-testid={testId || 'zone1a-tiles'}
      className="renix-col-primary flex flex-col gap-4"
    >
      {children}
    </div>
  );
}

interface Zone1BVisualProps {
  children: ReactNode;
  'data-testid'?: string;
}

export function Zone1BVisual({ children, 'data-testid': testId }: Zone1BVisualProps) {
  return (
    <div
      data-cfs-zone={CFS_ZONES.ZONE1B_VISUAL}
      data-testid={testId || 'zone1b-visual'}
      className="renix-col-secondary flex items-center justify-center"
    >
      {children}
    </div>
  );
}

interface PostureTileProps {
  label: string;
  value: string | number;
  subtext?: string;
  isEditable?: boolean;
  onEdit?: () => void;
  tint?: 'approved' | 'pending' | 'draft' | 'declined';
  'data-testid'?: string;
}

export function PostureTile({
  label,
  value,
  subtext,
  isEditable,
  onEdit,
  tint,
  'data-testid': testId,
}: PostureTileProps) {
  const tintClass = tint === 'approved' ? 'bg-status-approved-subtle'
    : tint === 'pending' ? 'bg-status-pending-subtle'
    : tint === 'draft' ? 'bg-status-draft-subtle'
    : tint === 'declined' ? 'bg-status-declined-subtle'
    : '';

  return (
    <div
      className={`renix-surface p-4 ${tintClass}`}
      data-testid={testId}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl font-semibold">
          {value}
        </div>
        {isEditable && onEdit && (
          <button
            onClick={onEdit}
            className="text-xs underline text-secondary hover:opacity-100 transition-opacity"
            data-testid={testId ? `${testId}-edit` : 'posture-tile-edit'}
          >
            Edit
          </button>
        )}
      </div>
      {subtext && (
        <div className="text-xs text-muted-foreground mt-2">
          {subtext}
        </div>
      )}
    </div>
  );
}

interface Zone2ExploreProps {
  children: ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  'data-testid'?: string;
}

export function Zone2Explore({
  children,
  isCollapsed = false,
  onToggleCollapse,
  'data-testid': testId,
}: Zone2ExploreProps) {
  if (isCollapsed) {
    return (
      <section
        data-cfs-zone={CFS_ZONES.ZONE2_EXPLORE}
        data-testid={testId || 'zone2-explore'}
        className="w-full"
      >
        <button
          onClick={onToggleCollapse}
          className="w-full renix-surface p-3 text-left text-xs uppercase tracking-wider text-secondary hover:opacity-100 transition-opacity"
          data-testid="zone2-expand-button"
        >
          Expand to explore
        </button>
      </section>
    );
  }

  return (
    <section
      data-cfs-zone={CFS_ZONES.ZONE2_EXPLORE}
      data-testid={testId || 'zone2-explore'}
      className="w-full"
    >
      {children}
    </section>
  );
}

interface EntityTileGridProps {
  children: ReactNode;
  viewMode?: 'grid' | 'carousel';
  'data-testid'?: string;
}

export function EntityTileGrid({
  children,
  viewMode = 'grid',
  'data-testid': testId,
}: EntityTileGridProps) {
  if (viewMode === 'carousel') {
    return (
      <div
        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory"
        data-testid={testId || 'entity-tile-carousel'}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      data-testid={testId || 'entity-tile-grid'}
    >
      {children}
    </div>
  );
}

interface EntityTileProps {
  id: string;
  name: string;
  color?: string;
  isSelected?: boolean;
  isAddNew?: boolean;
  onClick: () => void;
  'data-testid'?: string;
}

export function EntityTile({
  id,
  name,
  color,
  isSelected,
  isAddNew,
  onClick,
  'data-testid': testId,
}: EntityTileProps) {
  const borderStyle = isSelected ? 'border-2' : 'border';

  if (isAddNew) {
    return (
      <button
        onClick={onClick}
        className={`aspect-square ${borderStyle} border-dashed border-subtle rounded-lg renix-surface flex items-center justify-center p-4 hover-elevate transition-colors`}
        data-testid={testId || 'entity-tile-add-new'}
        data-entity-id="add-new"
      >
        <span className="text-3xl text-muted">+</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`aspect-square ${borderStyle} renix-surface p-4 hover-elevate transition-colors flex flex-col justify-between text-left`}
      data-testid={testId || `entity-tile-${id}`}
      data-entity-id={id}
      style={color ? { borderLeftColor: color, borderLeftWidth: '4px' } : undefined}
    >
      <div className="text-sm font-medium line-clamp-2">
        {name}
      </div>
    </button>
  );
}

interface Zone3FocusProps {
  children: ReactNode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  hasSelection?: boolean;
  placeholderText?: string;
  'data-testid'?: string;
}

export function Zone3Focus({
  children,
  isCollapsed = false,
  onToggleCollapse,
  hasSelection = false,
  placeholderText = 'Select an item above to view details',
  'data-testid': testId,
}: Zone3FocusProps) {
  if (isCollapsed) {
    return (
      <section
        data-cfs-zone={CFS_ZONES.ZONE3_FOCUS}
        data-testid={testId || 'zone3-focus'}
        className="w-full"
      >
        <button
          onClick={onToggleCollapse}
          className="w-full renix-surface p-3 text-left text-xs uppercase tracking-wider text-secondary hover:opacity-100 transition-opacity"
          data-testid="zone3-expand-button"
        >
          Expand to focus
        </button>
      </section>
    );
  }

  if (!hasSelection) {
    return (
      <section
        data-cfs-zone={CFS_ZONES.ZONE3_FOCUS}
        data-testid={testId || 'zone3-focus'}
        className="w-full renix-surface p-8 flex items-center justify-center mt-[12px] mb-[12px]"
      >
        <p className="text-sm text-muted">{placeholderText}</p>
      </section>
    );
  }

  return (
    <section
      data-cfs-zone={CFS_ZONES.ZONE3_FOCUS}
      data-testid={testId || 'zone3-focus'}
      className="w-full"
    >
      {children}
    </section>
  );
}

export function useCFSZoneState() {
  const [visibility, setVisibility] = useState<ZoneVisibilityState>(getDefaultZoneVisibility);

  const toggleZone2 = useCallback(() => {
    setVisibility((prev) => {
      const next = { ...prev, zone2Collapsed: !prev.zone2Collapsed };
      if (validateZoneVisibility(next)) {
        return next;
      }
      return { ...next, zone3Collapsed: false };
    });
  }, []);

  const toggleZone3 = useCallback(() => {
    setVisibility((prev) => {
      const next = { ...prev, zone3Collapsed: !prev.zone3Collapsed };
      if (validateZoneVisibility(next)) {
        return next;
      }
      return { ...next, zone2Collapsed: false };
    });
  }, []);

  return useMemo(() => ({
    visibility,
    toggleZone2,
    toggleZone3,
    isZone2Collapsed: visibility.zone2Collapsed,
    isZone3Collapsed: visibility.zone3Collapsed,
  }), [visibility, toggleZone2, toggleZone3]);
}
