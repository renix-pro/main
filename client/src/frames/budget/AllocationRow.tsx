/**
 * RENIX vNext — Budget Allocation Row
 * 
 * Canon v1.4 Compliant — Phase 10
 * 
 * Displays a single budget allocation. No enforcement or approval semantics.
 */

import { MoreHorizontal, Pencil, Trash2, Layers, AlertTriangle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFormatters } from '../../context/ProjectContext';
import type { BudgetAllocation } from './useBudgetData';

function getTargetIcon(type: string) {
  switch (type) {
    case 'scope':
      return <Layers className="h-4 w-4" />;
    case 'contingency':
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <HelpCircle className="h-4 w-4" />;
  }
}

function getTargetLabel(target: BudgetAllocation['target']): string {
  switch (target.type) {
    case 'scope':
      return target.scopeName || 'Scope';
    case 'contingency':
      return 'Contingency';
    default:
      return 'Unassigned';
  }
}

interface AllocationRowProps {
  allocation: BudgetAllocation;
  isReadOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function AllocationRow({ allocation, isReadOnly, onEdit, onDelete }: AllocationRowProps) {
  const { formatCurrency } = useFormatters();
  return (
    <div
      className="flex items-center justify-between gap-4 py-3 px-4 border-b border-border last:border-b-0 group"
      data-testid={`allocation-row-${allocation.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium text-foreground" data-testid={`text-allocation-label-${allocation.id}`}>
            {allocation.label}
          </span>
          <Badge variant="secondary" className="text-xs gap-1" data-testid={`badge-target-${allocation.id}`}>
            {getTargetIcon(allocation.target.type)}
            {getTargetLabel(allocation.target)}
          </Badge>
        </div>
        {allocation.notes && (
          <p className="text-sm mt-0.5 truncate text-secondary" data-testid={`text-allocation-notes-${allocation.id}`}>
            {allocation.notes}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-base font-medium text-foreground tabular-nums" data-testid={`text-allocation-amount-${allocation.id}`}>
          {formatCurrency(allocation.amount)}
        </span>

        {!isReadOnly && (
          <div className="visible md:invisible md:group-hover:visible">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-allocation-menu-${allocation.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-allocation-${allocation.id}`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`button-delete-allocation-${allocation.id}`}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
