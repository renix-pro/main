/**
 * RENIX vNext — Cross-Frame Intelligence Engine
 * 
 * Canon v1.4 Compliant — Phase 7
 * 
 * Deterministic evaluation engine for cross-frame patterns.
 * 
 * CFI is:
 * - READ-ONLY
 * - DETERMINISTIC
 * - NON-AUTHORITATIVE
 * 
 * CFI must NEVER:
 * - Write to any frame
 * - Modify or persist data
 * - Create proposals, actions, or decisions
 * - Rank severity or urgency
 * - Persist signals
 * - Speak directly to the user
 * - Operate on closed projects (disabled post-closure)
 */

import type { CFISnapshot, CFISignal } from './types';
import { PATTERN_LIBRARY } from './patterns';

export function evaluateCFI(snapshot: CFISnapshot): CFISignal[] {
  if (snapshot.project.status === 'closed') {
    return [];
  }

  const signals: CFISignal[] = [];
  const evaluatedAt = snapshot.project.evaluatedAt;

  for (const pattern of PATTERN_LIBRARY) {
    try {
      if (pattern.trigger(snapshot)) {
        const emission = pattern.emit(snapshot);
        const signal: CFISignal = {
          patternId: pattern.id,
          class: pattern.class,
          observation: emission.observation,
          whyItMatters: emission.whyItMatters,
          paths: emission.paths,
          inspectable: {
            framesRead: pattern.frames,
            triggerFacts: buildTriggerFacts(pattern.id, snapshot),
            evaluatedAt,
          },
        };
        signals.push(signal);
      }
    } catch {
      continue;
    }
  }

  return signals;
}

function buildTriggerFacts(patternId: string, snapshot: CFISnapshot): string[] {
  const facts: string[] = [];

  switch (patternId) {
    case 'P-01':
      if (snapshot.scope && snapshot.budget) {
        facts.push(`scopeItemCount=${snapshot.scope.items.length}`);
        facts.push(`budgetLastModified=${snapshot.budget.lastModified}`);
      }
      break;
    case 'P-02':
      if (snapshot.budget && snapshot.quotes) {
        const acceptedTotal = snapshot.quotes.items
          .filter(q => q.accepted)
          .reduce((sum, q) => sum + (q.total?.value ?? 0), 0);
        facts.push(`acceptedQuoteTotal=${acceptedTotal}`);
        facts.push(`budgetTotalIntent=${snapshot.budget.totalIntent}`);
      }
      break;
    case 'P-03':
      if (snapshot.execution && snapshot.financing && snapshot.budget) {
        facts.push(`executionStatus=IN_PROGRESS`);
        facts.push(`financingCoverage=${snapshot.financing.totalCoverage}`);
        facts.push(`budgetIntent=${snapshot.budget.totalIntent}`);
      }
      break;
    case 'P-04':
      if (snapshot.quotes && snapshot.budget && snapshot.financing) {
        facts.push(`hasAcceptedQuote=true`);
        facts.push(`contingency=${snapshot.budget.contingency}`);
        facts.push(`unresolvedFinancing=${snapshot.financing.hasUnresolvedDependency}`);
      }
      break;
    case 'P-05':
      if (snapshot.execution && snapshot.invoices) {
        facts.push(`progressRatio=${snapshot.execution.progressRatio}`);
        facts.push(`invoiceCount=${snapshot.invoices.items.length}`);
      }
      break;
    case 'P-06':
      if (snapshot.scope) {
        facts.push(`scopeItemCount=${snapshot.scope.items.length}`);
      }
      break;
  }

  return facts;
}

export function createEmptySnapshot(projectId: string): CFISnapshot {
  return {
    project: {
      id: projectId,
      status: 'open',
      lastActivity: new Date().toISOString(),
      evaluatedAt: new Date().toISOString(),
    },
  };
}
