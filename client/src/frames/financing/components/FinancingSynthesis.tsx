/**
 * RENIX vNext — Financing Synthesis
 * 
 * AI-generated contextual narrative that ties together:
 * - Expected Cost
 * - Confirmed Financing Capacity  
 * - Coverage Delta
 * - Cost certainty (budget vs quote)
 * 
 * Tone: Direct, calm, non-judgmental.
 * No advice unless asked. No moralizing.
 * 
 * MANDATORY: Actively closes the loop for the user.
 */

import { Card } from '@/components/ui/card';
import { useFormatters } from '../../../context/ProjectContext';
import type { ResolvedCostDemandResult, FinancingSource } from '../useFinancingData';

interface FinancingSynthesisProps {
  resolvedCostDemand: ResolvedCostDemandResult | null;
  sources: FinancingSource[];
  isLoading: boolean;
}

export function FinancingSynthesis({ resolvedCostDemand, sources, isLoading }: FinancingSynthesisProps) {
  const { formatCurrency } = useFormatters();

  if (isLoading) {
    return (
      <Card className="p-4" data-testid="synthesis-loading">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-3/4" />
        </div>
      </Card>
    );
  }

  if (!resolvedCostDemand) {
    return (
      <Card className="p-4" data-testid="synthesis-empty">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Financial Summary
        </div>
        <div className="text-sm text-muted-foreground">
          Add budget allocations and financing sources to see a summary of your project's funding status.
        </div>
      </Card>
    );
  }

  const { 
    totalResolvedCost, 
    breakdown, 
    confirmedFinancingCapacity, 
    plannedFinancingCapacity,
    coverageDelta,
    hasFinancingGap 
  } = resolvedCostDemand;

  const confirmedSources = sources.filter(s => s.status === 'confirmed');
  const plannedSources = sources.filter(s => s.status === 'planned');
  
  const quotePct = totalResolvedCost > 0 ? Math.round((breakdown.quoteBacked / totalResolvedCost) * 100) : 0;
  const coveragePct = totalResolvedCost > 0 ? Math.round((confirmedFinancingCapacity / totalResolvedCost) * 100) : 0;

  const generateSynthesis = (): string[] => {
    const lines: string[] = [];

    // Line 1: Expected cost and certainty
    if (totalResolvedCost > 0) {
      if (quotePct === 0) {
        lines.push(`Your expected project cost is ${formatCurrency(totalResolvedCost)}. All of this is still budget-based, representing higher uncertainty.`);
      } else if (quotePct === 100) {
        lines.push(`Your expected project cost is ${formatCurrency(totalResolvedCost)}, fully backed by supplier quotes.`);
      } else {
        lines.push(`Your expected project cost is ${formatCurrency(totalResolvedCost)}. ${quotePct}% is quote-backed; the remaining ${100 - quotePct}% is budget intent.`);
      }
    } else {
      lines.push(`No expected costs have been defined yet.`);
    }

    // Line 2: Financing capacity
    if (confirmedFinancingCapacity > 0) {
      lines.push(`You currently have ${formatCurrency(confirmedFinancingCapacity)} of confirmed financing capacity.`);
    } else if (confirmedSources.length === 0 && plannedSources.length > 0) {
      const plannedTotal = plannedSources.reduce((sum, s) => sum + s.amount, 0);
      lines.push(`Your ${plannedSources.length} planned source${plannedSources.length > 1 ? 's' : ''} total${plannedSources.length === 1 ? 's' : ''} ${formatCurrency(plannedTotal)}, but none are yet confirmed. Confirmed financing capacity is ${formatCurrency(0)}.`);
    } else {
      lines.push(`No financing sources have been added. Confirmed financing capacity is ${formatCurrency(0)}.`);
    }

    // Line 3: Coverage reality
    if (hasFinancingGap && totalResolvedCost > 0) {
      lines.push(`Confirmed financing covers ${coveragePct}% of expected cost, leaving a gap of ${formatCurrency(Math.abs(coverageDelta))}.`);
      lines.push(`Until additional financing is confirmed or costs are reduced, this plan remains unfundable.`);
    } else if (!hasFinancingGap && coverageDelta > 0 && totalResolvedCost > 0) {
      lines.push(`Confirmed financing exceeds expected cost by ${formatCurrency(coverageDelta)}.`);
    } else if (!hasFinancingGap && coverageDelta === 0 && totalResolvedCost > 0) {
      lines.push(`Confirmed financing exactly matches expected cost.`);
    }

    // Line 4: Planned sources context (if any)
    if (plannedSources.length > 0 && confirmedFinancingCapacity < totalResolvedCost) {
      const potentialIncrease = plannedSources.reduce((sum, s) => sum + s.amount, 0);
      if (potentialIncrease > 0) {
        const hypotheticalGap = totalResolvedCost - confirmedFinancingCapacity - potentialIncrease;
        if (hypotheticalGap <= 0) {
          lines.push(`Confirming your planned sources would provide an additional ${formatCurrency(potentialIncrease)}, which would cover the gap.`);
        } else {
          lines.push(`Confirming your planned sources would add ${formatCurrency(potentialIncrease)}, but would still leave a gap of ${formatCurrency(hypotheticalGap)}.`);
        }
      }
    }

    return lines;
  };

  const synthesis = generateSynthesis();

  return (
    <Card 
      className={`p-4 ${hasFinancingGap ? 'border-l-4 border-l-foreground' : ''}`}
      data-testid="financing-synthesis"
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        Financial Summary
      </div>
      <div className="space-y-2 text-sm" data-testid="synthesis-content">
        {synthesis.map((line, i) => (
          <p key={i} className={i === synthesis.length - 1 && hasFinancingGap ? 'font-medium' : ''}>
            {line}
          </p>
        ))}
      </div>
    </Card>
  );
}
