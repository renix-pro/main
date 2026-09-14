import type { Express, Request, Response } from "express";
import { completeJson } from "../ai/claude";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  requireAuth,
  requireProjectAccess,
} from "./shared/middleware";
import type { OverviewFrameContract, AIInterpretations } from "./overviewTypes";
import { computeOverviewMetrics, type ComputedOverviewMetrics } from "./overviewCompute";
import { getLocaleFromRegionalContext } from "../localeUtils";

const INTERPRETATION_SYSTEM_PROMPT = `You are an AI that writes brief interpretations for a construction project management dashboard called RENIX.

You will receive COMPUTED METRICS — real numbers calculated from the project database. Your job is to write SHORT textual interpretations of these numbers. You do NOT generate numbers — all numbers are already computed and final.

OUTPUT: You MUST output ONLY valid JSON matching this schema:
{
  "overallLabel": "string (3-6 words, project phase label like 'Early Planning Stage' or 'Active Budgeting Phase')",
  "overallExplanation": "string (1-2 sentences summarizing the project state based on the metrics)",
  "costRealityInterpretation": "string (1 sentence about budget allocation and spending)",
  "scopeClarityInterpretation": "string (1 sentence about scope definition progress)",
  "executionReadinessInterpretation": "string (1 sentence about task progress)",
  "assumptionsInterpretation": "string (1 sentence about what is confirmed vs assumed)",
  "attentionSignals": [{"title": "string (3-5 words)", "reason": "string (1 sentence)", "severity": "high | medium | low", "targetFrame": "string (one of: scope, budget, quotes, invoices, financing, execution, documents, vision) — the most relevant frame for this signal"}],
  "narrative": "string (3-5 sentences, factual summary of project state)",
  "reassurance": "string (1 sentence, neutral acknowledgment of progress)"
}

RULES:
- MAX 3 attention signals. Only include signals that are warranted by the data. If everything is at zero/early stage, include 0 signals.
- Use the ACTUAL NUMBERS from the metrics. Reference them (e.g., "3 of 14 scopes have quotes").
- No recommendation language. No prescriptive verbs (fix, resolve, should, must).
- No health/score judgments. FORBIDDEN words: healthy, on track, good, bad, successful, risky, safe, optimized.
- Be factual. State what IS, not what should be.
- If most metrics are zero, reflect early-stage reality honestly. Do not inflate.
- Keep all text concise and grounded in the numbers provided.
- When referencing monetary amounts, ALWAYS use the project's specified currency symbol and code. NEVER default to $ or USD unless that is the stated project currency.
- Each attention signal MUST include a targetFrame indicating which frame is most relevant to that signal. Choose from: scope, budget, quotes, invoices, financing, execution, documents, vision.`;

interface ProjectCurrencyInfo {
  currency: string;
  currencySymbol: string;
  locale: string;
}

function resolveProjectCurrency(regionalContext: unknown): ProjectCurrencyInfo {
  const localeConfig = getLocaleFromRegionalContext(regionalContext);
  const currency = localeConfig.currency;

  const ctx = (regionalContext && typeof regionalContext === 'object')
    ? regionalContext as Record<string, unknown>
    : {};
  const storedLocale = ctx.locale as string | undefined;

  const REGION_LOCALE_MAP: Record<string, string> = {
    AU: 'en-AU', US: 'en-US', GB: 'en-GB', UK: 'en-GB', CA: 'en-CA', NZ: 'en-NZ',
    DE: 'de-DE', FR: 'fr-FR', JP: 'ja-JP', AT: 'de-AT', CH: 'de-CH',
    IT: 'it-IT', ES: 'es-ES', NL: 'nl-NL', BE: 'nl-BE', PL: 'pl-PL',
  };
  const locale = storedLocale || REGION_LOCALE_MAP[localeConfig.region] || 'en-AU';

  let currencySymbol: string;
  try {
    const parts = new Intl.NumberFormat(locale, { style: 'currency', currency }).formatToParts(0);
    currencySymbol = parts.find(p => p.type === 'currency')?.value || currency;
  } catch {
    currencySymbol = currency;
  }

  return { currency, currencySymbol, locale };
}

function formatMoneyForDisplay(amount: number, info: ProjectCurrencyInfo): string {
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${info.currencySymbol}${amount.toLocaleString()}`;
  }
}

function formatMetricsForAI(metrics: ComputedOverviewMetrics, projectName: string, currencyInfo: ProjectCurrencyInfo): string {
  const lines: string[] = [];

  lines.push(`PROJECT: "${projectName}"`);
  lines.push(`PROJECT CURRENCY: ${currencyInfo.currency} (symbol: ${currencyInfo.currencySymbol})`);
  lines.push(`IMPORTANT: All monetary values below are in ${currencyInfo.currency}. When writing interpretations, use the ${currencyInfo.currencySymbol} symbol for this currency. Do NOT use $ unless the project currency is USD, AUD, CAD, or NZD.`);
  lines.push('');

  lines.push('COST REALITY:');
  if (metrics.costReality.budgetDefined) {
    lines.push(`  Total Budget: ${formatMoneyForDisplay(metrics.costReality.totalBudget, currencyInfo)}`);
    lines.push(`  Allocated to scopes: ${formatMoneyForDisplay(metrics.costReality.totalAllocated, currencyInfo)} (${Math.round(metrics.costReality.allocatedRatio * 100)}%)`);
    lines.push(`  Quoted by vendors: ${formatMoneyForDisplay(metrics.costReality.totalQuoted, currencyInfo)}`);
    lines.push(`  Invoiced: ${formatMoneyForDisplay(metrics.costReality.totalInvoiced, currencyInfo)} (${Math.round(metrics.costReality.invoicedRatio * 100)}%)`);
    lines.push(`  Paid: ${formatMoneyForDisplay(metrics.costReality.totalPaid, currencyInfo)}`);
  } else {
    lines.push('  No budget defined yet');
  }
  lines.push('');

  lines.push('SCOPE CLARITY:');
  lines.push(`  Total scope areas (non-archived): ${metrics.scopeClarity.totalScopeNodes}`);
  lines.push(`  With quotes: ${metrics.scopeClarity.nodesWithQuotes}`);
  lines.push(`  With budget allocations: ${metrics.scopeClarity.nodesWithAllocations}`);
  lines.push(`  With tasks: ${metrics.scopeClarity.nodesWithTasks}`);
  lines.push(`  Clarity level: ${metrics.scopeClarity.level}/5`);
  lines.push('');

  lines.push('EXECUTION READINESS:');
  lines.push(`  Total tasks: ${metrics.executionReadiness.totalTasks}`);
  if (metrics.executionReadiness.totalTasks > 0) {
    lines.push(`  To-do: ${metrics.executionReadiness.todoTasks}, In-progress: ${metrics.executionReadiness.inProgressTasks}, Done: ${metrics.executionReadiness.doneTasks}, Blocked: ${metrics.executionReadiness.blockedTasks}`);
  }
  lines.push(`  Readiness level: ${metrics.executionReadiness.level}/5`);
  lines.push('');

  lines.push('ASSUMPTIONS VS CONFIRMED:');
  lines.push(`  Total scope areas: ${metrics.assumptionsVsConfirmed.totalScopeNodes}`);
  lines.push(`  Confirmed (with committed/accepted quotes or finalized/paid invoices): ${metrics.assumptionsVsConfirmed.confirmedNodes}`);
  lines.push(`  Still assumed: ${metrics.assumptionsVsConfirmed.assumedNodes}`);
  lines.push(`  Confirmed ratio: ${Math.round(metrics.assumptionsVsConfirmed.confirmedRatio * 100)}%`);
  lines.push('');

  lines.push('FINANCING:');
  lines.push(`  Sources: ${metrics.financingCoverage.totalFinancingSources}`);
  lines.push(`  Confirmed: ${formatMoneyForDisplay(metrics.financingCoverage.confirmedFinancing, currencyInfo)}`);
  lines.push(`  Planned: ${formatMoneyForDisplay(metrics.financingCoverage.plannedFinancing, currencyInfo)}`);
  if (metrics.costReality.budgetDefined) {
    lines.push(`  Coverage of budget: ${Math.round(metrics.financingCoverage.coverageRatio * 100)}%`);
  }
  lines.push('');

  lines.push('DOCUMENTS:');
  lines.push(`  Total confirmed documents: ${metrics.documentSummary.totalDocuments}`);
  const types = Object.entries(metrics.documentSummary.byType);
  if (types.length > 0) {
    lines.push(`  By type: ${types.map(([t, c]) => `${t}(${c})`).join(', ')}`);
  }

  return lines.join('\n');
}

function validateInterpretations(raw: any): AIInterpretations {
  const result: AIInterpretations = {
    overallLabel: typeof raw.overallLabel === 'string' ? raw.overallLabel : 'Project Overview',
    overallExplanation: typeof raw.overallExplanation === 'string' ? raw.overallExplanation : 'Project data is being assessed.',
    costRealityInterpretation: typeof raw.costRealityInterpretation === 'string' ? raw.costRealityInterpretation : '',
    scopeClarityInterpretation: typeof raw.scopeClarityInterpretation === 'string' ? raw.scopeClarityInterpretation : '',
    executionReadinessInterpretation: typeof raw.executionReadinessInterpretation === 'string' ? raw.executionReadinessInterpretation : '',
    assumptionsInterpretation: typeof raw.assumptionsInterpretation === 'string' ? raw.assumptionsInterpretation : '',
    attentionSignals: [],
    narrative: typeof raw.narrative === 'string' ? raw.narrative : '',
    reassurance: typeof raw.reassurance === 'string' ? raw.reassurance : '',
  };

  if (Array.isArray(raw.attentionSignals)) {
    result.attentionSignals = raw.attentionSignals
      .filter((s: any) => typeof s.title === 'string' && typeof s.reason === 'string')
      .slice(0, 3)
      .map((s: any) => {
        const validFrames = ['scope', 'budget', 'quotes', 'invoices', 'financing', 'execution', 'documents', 'vision'];
        const signal: any = {
          title: s.title,
          reason: s.reason,
          severity: ['high', 'medium', 'low'].includes(s.severity) ? s.severity : 'medium',
        };
        if (typeof s.targetFrame === 'string' && validFrames.includes(s.targetFrame)) {
          signal.targetFrame = s.targetFrame;
        }
        return signal;
      });
  }

  return result;
}

export async function invalidateOverviewCache(projectId: string): Promise<void> {
  try {
    await db.delete(schema.overviewCache).where(eq(schema.overviewCache.projectId, projectId));
  } catch (err) {
    console.error(`[Overview] Failed to invalidate cache for project ${projectId}:`, err);
  }
}

function isCacheStale(
  cached: OverviewFrameContract['computed'] | undefined,
  fresh: ComputedOverviewMetrics
): boolean {
  if (!cached) return true;

  if (cached.costReality.budgetDefined !== fresh.costReality.budgetDefined) return true;

  if (Math.abs(cached.costReality.allocatedRatio - fresh.costReality.allocatedRatio) > 0.05) return true;
  if (Math.abs(cached.costReality.invoicedRatio - fresh.costReality.invoicedRatio) > 0.05) return true;

  if (cached.scopeClarity.totalScopeNodes !== fresh.scopeClarity.totalScopeNodes) return true;
  if (cached.scopeClarity.nodesWithQuotes !== fresh.scopeClarity.nodesWithQuotes) return true;
  if (cached.scopeClarity.nodesWithAllocations !== fresh.scopeClarity.nodesWithAllocations) return true;

  if (cached.executionReadiness.totalTasks !== fresh.executionReadiness.totalTasks) return true;
  if (cached.executionReadiness.doneTasks !== fresh.executionReadiness.doneTasks) return true;

  const cachedCounts = cached.entityCounts;
  const freshCounts = fresh.entityCounts;
  if (cachedCounts.quotes !== freshCounts.quotes) return true;
  if (cachedCounts.invoices !== freshCounts.invoices) return true;
  if (cachedCounts.financingSources !== freshCounts.financingSources) return true;

  if (Math.abs(cached.financingCoverage.coverageRatio - fresh.financingCoverage.coverageRatio) > 0.1) return true;

  return false;
}

export function registerOverviewRoutes(app: Express): void {
  app.get('/api/projects/:projectId/overview', requireAuth, requireProjectAccess, async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const forceRefresh = req.query.refresh === 'true';

      const metrics = await computeOverviewMetrics(projectId);

      const hasActionableData =
        metrics.entityCounts.budgetAllocations > 0 ||
        metrics.costReality.budgetDefined ||
        metrics.entityCounts.financingSources > 0 ||
        metrics.entityCounts.tasks > 0 ||
        metrics.entityCounts.documents > 0 ||
        metrics.entityCounts.quotes > 0 ||
        metrics.entityCounts.invoices > 0;

      if (!hasActionableData && metrics.entityCounts.scopeNodes === 0) {
        return res.json({ empty: true, reason: 'no_data' });
      }

      if (!forceRefresh) {
        const cachedRows = await db.select().from(schema.overviewCache).where(eq(schema.overviewCache.projectId, projectId));
        if (cachedRows.length > 0) {
          const cached = cachedRows[0];
          const cachedContract = cached.contractJson as OverviewFrameContract;

          const stale = isCacheStale(cachedContract.computed, metrics);
          if (!stale) {
            const refreshedContract: OverviewFrameContract = {
              ...cachedContract,
              snapshotAt: new Date().toISOString(),
              computed: {
                costReality: metrics.costReality,
                scopeClarity: metrics.scopeClarity,
                executionReadiness: metrics.executionReadiness,
                assumptionsVsConfirmed: metrics.assumptionsVsConfirmed,
                financingCoverage: metrics.financingCoverage,
                entityCounts: metrics.entityCounts,
              },
            };
            return res.json({
              ...refreshedContract,
              _cached: true,
              _generatedAt: cached.generatedAt.toISOString(),
            });
          }
          console.log(`[Overview] Cache stale for project ${projectId}, regenerating AI interpretations`);
        }
      }

      const [projectRows] = await Promise.all([
        db.select().from(schema.projects).where(eq(schema.projects.id, projectId)),
      ]);

      const project = projectRows[0];
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      const currencyInfo = resolveProjectCurrency(project.regionalContext);

      const metricsText = formatMetricsForAI(metrics, project.name, currencyInfo);

      let interpretations: AIInterpretations;
      try {
        const parsed = await completeJson<any>({
          system: INTERPRETATION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Write interpretations for these computed project metrics:\n\n${metricsText}` }],
          effort: 'low',
        });
        interpretations = validateInterpretations(parsed);
      } catch (aiError) {
        console.error('[Overview] AI interpretation failed, using fallback:', aiError);
        interpretations = generateFallbackInterpretations(metrics, currencyInfo);
      }

      const contract: OverviewFrameContract = {
        snapshotAt: new Date().toISOString(),
        computed: {
          costReality: metrics.costReality,
          scopeClarity: metrics.scopeClarity,
          executionReadiness: metrics.executionReadiness,
          assumptionsVsConfirmed: metrics.assumptionsVsConfirmed,
          financingCoverage: metrics.financingCoverage,
          entityCounts: metrics.entityCounts,
        },
        interpretations,
      };

      try {
        await db
          .insert(schema.overviewCache)
          .values({ projectId, contractJson: contract, generatedAt: new Date() })
          .onConflictDoUpdate({
            target: schema.overviewCache.projectId,
            set: { contractJson: contract, generatedAt: new Date() },
          });
      } catch (cacheErr) {
        console.error('[Overview] Failed to write cache:', cacheErr);
      }

      return res.json(contract);
    } catch (error: any) {
      console.error('Error generating overview:', error);
      if (error?.status === 401 || error?.code === 'invalid_api_key') {
        return res.status(502).json({ message: 'AI service authentication error' });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  });
}

function generateFallbackInterpretations(metrics: ComputedOverviewMetrics, currencyInfo: ProjectCurrencyInfo): AIInterpretations {
  const { costReality, scopeClarity, executionReadiness, assumptionsVsConfirmed } = metrics;
  const fmt = (amount: number) => formatMoneyForDisplay(amount, currencyInfo);

  let overallLabel = 'Project Overview';
  if (!costReality.budgetDefined && scopeClarity.totalScopeNodes === 0) {
    overallLabel = 'Getting Started';
  } else if (!costReality.budgetDefined) {
    overallLabel = 'Scope Definition Phase';
  } else if (costReality.allocatedRatio < 0.25) {
    overallLabel = 'Early Planning Stage';
  } else if (executionReadiness.totalTasks === 0) {
    overallLabel = 'Budget Planning Phase';
  } else {
    overallLabel = 'Active Project Phase';
  }

  return {
    overallLabel,
    overallExplanation: `The project has ${scopeClarity.totalScopeNodes} scope areas defined${costReality.budgetDefined ? ` with a budget of ${fmt(costReality.totalBudget)}` : ''}.`,
    costRealityInterpretation: costReality.budgetDefined
      ? `${Math.round(costReality.allocatedRatio * 100)}% of the budget has been allocated to specific scope areas.`
      : 'No budget has been defined yet.',
    scopeClarityInterpretation: scopeClarity.totalScopeNodes > 0
      ? `${scopeClarity.nodesWithQuotes} of ${scopeClarity.totalScopeNodes} scope areas have linked quotes.`
      : 'No scope areas have been defined yet.',
    executionReadinessInterpretation: executionReadiness.totalTasks > 0
      ? `${executionReadiness.doneTasks} of ${executionReadiness.totalTasks} tasks are completed.`
      : 'No tasks have been created yet.',
    assumptionsInterpretation: assumptionsVsConfirmed.totalScopeNodes > 0
      ? `${assumptionsVsConfirmed.confirmedNodes} of ${assumptionsVsConfirmed.totalScopeNodes} scope areas are confirmed with quotes or invoices.`
      : 'No scope areas to assess.',
    attentionSignals: [],
    narrative: `The project currently has ${scopeClarity.totalScopeNodes} scope areas${costReality.budgetDefined ? `, a defined budget of ${fmt(costReality.totalBudget)}` : ''}, and ${metrics.entityCounts.documents} document${metrics.entityCounts.documents !== 1 ? 's' : ''}.`,
    reassurance: 'All displayed metrics are computed directly from project data.',
  };
}
