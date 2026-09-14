/**
 * RENIX vNext — KPI Band Component
 * 
 * Canon v1.4 Compliant — Phase 12
 * 
 * Placement: Immediately below frame header, full width
 * Background: bg-surface
 * 
 * Structure:
 * - Grid of KPIs (3–4 items)
 * - Each KPI includes:
 *   - Label (text-xs text-muted)
 *   - Value (large, bold)
 *   - Optional ring or bar
 */

interface KPIRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: 'primary' | 'secondary' | 'ok' | 'warning' | 'critical';
}

function KPIRing({ value, max, size = 48, strokeWidth = 4, color = 'primary' }: KPIRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const offset = circumference - (percentage * circumference);
  
  const colorClasses: Record<typeof color, string> = {
    primary: 'stroke-accent-primary',
    secondary: 'stroke-accent-secondary',
    ok: 'stroke-status-ok',
    warning: 'stroke-status-warning',
    critical: 'stroke-status-critical',
  };
  
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--divider))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={colorClasses[color]}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

interface KPIBarProps {
  value: number;
  max: number;
  color?: 'primary' | 'secondary' | 'ok' | 'warning' | 'critical';
}

function KPIBar({ value, max, color = 'primary' }: KPIBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const colorClasses: Record<typeof color, string> = {
    primary: 'bg-accent-primary',
    secondary: 'bg-accent-secondary',
    ok: 'bg-status-ok',
    warning: 'bg-status-warning',
    critical: 'bg-status-critical',
  };
  
  return (
    <div className="w-full h-2 bg-divider overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${colorClasses[color]}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export interface KPIItem {
  id: string;
  label: string;
  value: string | number;
  subtext?: string;
  ring?: { value: number; max: number; color?: KPIRingProps['color'] };
  bar?: { value: number; max: number; color?: KPIBarProps['color'] };
}

interface KPIBandProps {
  items: KPIItem[];
  columns?: 3 | 4;
}

/**
 * KPI Band — STATUS STRIP
 * Phase 12 Corrective: 40-50% shorter, denser, high contrast
 * NOT a hero section. Compact status display.
 */
export function KPIBand({ items, columns = 4 }: KPIBandProps) {
  const gridCols = columns === 3 ? 'grid-cols-3' : 'grid-cols-4';
  
  return (
    <div 
      className="w-full bg-surface border-b border-divider"
      data-testid="kpi-band"
    >
      <div className="max-w-7xl mx-auto px-8 py-2">
        <div className={`grid ${gridCols} gap-4`}>
          {items.map((item) => (
            <div 
              key={item.id} 
              className="flex items-center gap-2"
              data-testid={`kpi-item-${item.id}`}
              title={item.subtext}
            >
              {item.ring && (
                <KPIRing
                  value={item.ring.value}
                  max={item.ring.max}
                  size={32}
                  strokeWidth={3}
                  color={item.ring.color}
                />
              )}
              
              <div className="flex-1 min-w-0">
                <div 
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {item.label}
                </div>
                <div 
                  className="text-lg font-semibold leading-tight text-foreground"
                >
                  {item.value}
                </div>
                {item.bar && (
                  <div className="mt-1">
                    <KPIBar
                      value={item.bar.value}
                      max={item.bar.max}
                      color={item.bar.color}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { KPIRing, KPIBar };
export default KPIBand;
