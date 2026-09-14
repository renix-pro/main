/**
 * RENIX vNext — Budget History
 * 
 * Canon v1.4 Compliant
 * Collapsed by default. Shows timeline of budget changes.
 * Language: "updated", "adjusted" - never "fixed" or "corrected".
 */

import { useState } from 'react';
import { useFormatters } from '@/context/ProjectContext';

interface HistoryEntry {
  id: string;
  timestamp: number;
  action: 'budget_updated' | 'allocation_added' | 'allocation_adjusted' | 'allocation_removed' | 'contingency_updated';
  description: string;
  previousValue?: number;
  newValue?: number;
  actor?: string;
}

interface BudgetHistoryProps {
  entries: HistoryEntry[];
}

export function BudgetHistory({ entries }: BudgetHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { formatDate, formatCurrency } = useFormatters();

  if (entries.length === 0) return null;

  const getActionLabel = (action: HistoryEntry['action']): string => {
    switch (action) {
      case 'budget_updated': return 'Budget updated';
      case 'allocation_added': return 'Allocation added';
      case 'allocation_adjusted': return 'Allocation adjusted';
      case 'allocation_removed': return 'Allocation removed';
      case 'contingency_updated': return 'Contingency updated';
      default: return 'Change recorded';
    }
  };

  return (
    <section data-testid="budget-history">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-sm underline-offset-2 hover:underline"
        data-testid="button-toggle-history"
      >
        {isExpanded ? 'Hide changes over time' : 'View changes over time'}
      </button>

      {isExpanded && (
        <div className="mt-4 border-l border-subtle pl-4 space-y-4">
          {entries.map(entry => (
            <div 
              key={entry.id}
              className="text-sm"
              data-testid={`history-entry-${entry.id}`}
            >
              <div className="font-semibold">
                {getActionLabel(entry.action)}
              </div>
              <div className="text-xs text-secondary">
                {formatDate(new Date(entry.timestamp))}
                {entry.actor && ` · ${entry.actor}`}
              </div>
              <div className="mt-1">
                {entry.description}
              </div>
              {entry.previousValue !== undefined && entry.newValue !== undefined && (
                <div className="text-xs text-secondary mt-1">
                  {formatCurrency(entry.previousValue)} → {formatCurrency(entry.newValue)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export type { HistoryEntry };
