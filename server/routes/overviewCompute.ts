import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

export interface ComputedOverviewMetrics {
  costReality: {
    budgetDefined: boolean;
    totalBudget: number;
    totalAllocated: number;
    totalQuoted: number;
    totalInvoiced: number;
    totalPaid: number;
    allocatedRatio: number;
    invoicedRatio: number;
  };

  scopeClarity: {
    totalScopeNodes: number;
    nodesWithQuotes: number;
    nodesWithAllocations: number;
    nodesWithTasks: number;
    level: 1 | 2 | 3 | 4 | 5;
  };

  executionReadiness: {
    totalTasks: number;
    todoTasks: number;
    inProgressTasks: number;
    doneTasks: number;
    blockedTasks: number;
    level: 1 | 2 | 3 | 4 | 5;
  };

  assumptionsVsConfirmed: {
    totalScopeNodes: number;
    confirmedNodes: number;
    assumedNodes: number;
    confirmedRatio: number;
    assumedRatio: number;
  };

  financingCoverage: {
    totalFinancingSources: number;
    confirmedFinancing: number;
    plannedFinancing: number;
    totalFinancing: number;
    coverageRatio: number;
  };

  documentSummary: {
    totalDocuments: number;
    byType: Record<string, number>;
  };

  entityCounts: {
    scopeNodes: number;
    budgetAllocations: number;
    quotes: number;
    invoices: number;
    tasks: number;
    financingSources: number;
    documents: number;
    inspirations: number;
  };
}

function computeScopeClarityLevel(coverage: number, totalNodes: number): 1 | 2 | 3 | 4 | 5 {
  if (totalNodes === 0) return 1;
  if (coverage === 0) return 1;
  if (coverage < 0.25) return 2;
  if (coverage < 0.5) return 3;
  if (coverage < 0.75) return 4;
  return 5;
}

function computeExecutionLevel(doneTasks: number, totalTasks: number): 1 | 2 | 3 | 4 | 5 {
  if (totalTasks === 0) return 1;
  const ratio = doneTasks / totalTasks;
  if (ratio === 0) return 1;
  if (ratio <= 0.25) return 2;
  if (ratio <= 0.5) return 3;
  if (ratio <= 0.75) return 4;
  return 5;
}

export async function computeOverviewMetrics(projectId: string): Promise<ComputedOverviewMetrics> {
  const [
    budgetDataRows,
    budgetAllocationsRows,
    scopeNodesRows,
    quotesRows,
    quoteFinancialsRows,
    invoicesRows,
    invoiceLinesRows,
    invoicePaymentsRows,
    financingSourcesRows,
    executionTasksRows,
    documentsRows,
    visionInspirationsRows,
  ] = await Promise.all([
    db.select().from(schema.budgetData).where(eq(schema.budgetData.projectId, projectId)),
    db.select().from(schema.budgetAllocations).where(eq(schema.budgetAllocations.projectId, projectId)),
    db.select().from(schema.scopeNodes).where(eq(schema.scopeNodes.projectId, projectId)),
    db.select().from(schema.quotes).where(eq(schema.quotes.projectId, projectId)),
    db.select().from(schema.quoteFinancials).where(eq(schema.quoteFinancials.projectId, projectId)),
    db.select().from(schema.invoices).where(eq(schema.invoices.projectId, projectId)),
    db.select().from(schema.invoiceLines).where(eq(schema.invoiceLines.projectId, projectId)),
    db.select().from(schema.invoicePayments).where(eq(schema.invoicePayments.projectId, projectId)),
    db.select().from(schema.financingSources).where(eq(schema.financingSources.projectId, projectId)),
    db.select().from(schema.executionTasks).where(eq(schema.executionTasks.projectId, projectId)),
    db.select().from(schema.documents).where(eq(schema.documents.projectId, projectId)),
    db.select().from(schema.visionInspirations).where(eq(schema.visionInspirations.projectId, projectId)),
  ]);

  const budget = budgetDataRows[0];
  const totalBudget = budget?.totalBudget ?? 0;
  const budgetDefined = totalBudget > 0;

  const totalAllocated = budgetAllocationsRows.reduce((sum, a) => sum + (a.amount ?? 0), 0);
  const totalQuoted = quoteFinancialsRows.reduce((sum, qf) => sum + (qf.grossAmount ?? 0), 0) / 100;
  const totalInvoiced = invoiceLinesRows.reduce((sum, il) => sum + (il.amount ?? 0), 0) / 100;
  const totalPaid = invoicePaymentsRows.reduce((sum, ip) => sum + (ip.amount ?? 0), 0) / 100;

  const committedQuoteIds = new Set(
    quotesRows
      .filter(q => q.commitmentStatus === 'active' || q.commitmentStatus === 'accepted')
      .map(q => q.id)
  );
  const committedQuotedTotal = quoteFinancialsRows
    .filter(qf => committedQuoteIds.has(qf.quoteId))
    .reduce((sum, qf) => sum + (qf.grossAmount ?? 0), 0) / 100;

  const directCostScopeIds = new Set(
    scopeNodesRows.filter(n => n.costType === 'direct' && !n.isArchived).map(n => n.id)
  );

  let directCostTotal = 0;
  for (const alloc of budgetAllocationsRows) {
    const target = alloc.target as any;
    if (target && typeof target === 'object') {
      const scopeNodeId = target.scopeId || target.scopeNodeId;
      if (scopeNodeId && directCostScopeIds.has(scopeNodeId)) {
        directCostTotal += alloc.amount ?? 0;
      }
    }
  }

  const contingencyMode = budget?.contingencyMode ?? 'fixed';
  const contingencyValue = budget?.contingencyValue ?? 0;
  const contingencyAmount = contingencyMode === 'percent'
    ? (totalBudget * contingencyValue) / 100
    : contingencyValue;

  const committedTotal = directCostTotal + contingencyAmount + committedQuotedTotal;

  const costReality = {
    budgetDefined,
    totalBudget,
    totalAllocated,
    totalQuoted: committedQuotedTotal,
    totalInvoiced,
    totalPaid,
    allocatedRatio: budgetDefined ? totalAllocated / totalBudget : 0,
    invoicedRatio: budgetDefined ? totalInvoiced / totalBudget : 0,
    directCostTotal,
    contingencyAmount,
    committedTotal,
  };

  const activeScopeNodes = scopeNodesRows.filter(n => !n.isArchived);
  const activeScopeNodeIds = new Set(activeScopeNodes.map(n => n.id));

  const nodesWithQuotesSet = new Set<string>();
  for (const q of quotesRows) {
    if (q.scopeId && activeScopeNodeIds.has(q.scopeId)) {
      nodesWithQuotesSet.add(q.scopeId);
    }
  }

  const nodesWithAllocationsSet = new Set<string>();
  for (const a of budgetAllocationsRows) {
    const target = a.target as any;
    if (target && typeof target === 'object') {
      const scopeNodeId = target.scopeId || target.scopeNodeId;
      if (scopeNodeId && activeScopeNodeIds.has(scopeNodeId)) {
        nodesWithAllocationsSet.add(scopeNodeId);
      }
    }
  }

  const nodesWithTasksSet = new Set<string>();
  for (const t of executionTasksRows) {
    if (t.scopeItemId && activeScopeNodeIds.has(t.scopeItemId)) {
      nodesWithTasksSet.add(t.scopeItemId);
    }
  }

  const coveredNodes = new Set<string>();
  Array.from(nodesWithQuotesSet).forEach(id => coveredNodes.add(id));
  Array.from(nodesWithAllocationsSet).forEach(id => coveredNodes.add(id));
  Array.from(nodesWithTasksSet).forEach(id => coveredNodes.add(id));

  const totalActiveNodes = activeScopeNodes.length;
  const coverage = totalActiveNodes > 0 ? coveredNodes.size / totalActiveNodes : 0;

  const scopeClarity = {
    totalScopeNodes: totalActiveNodes,
    nodesWithQuotes: nodesWithQuotesSet.size,
    nodesWithAllocations: nodesWithAllocationsSet.size,
    nodesWithTasks: nodesWithTasksSet.size,
    level: computeScopeClarityLevel(coverage, totalActiveNodes),
  };

  const todoTasks = executionTasksRows.filter(t => t.status === 'to_do').length;
  const inProgressTasks = executionTasksRows.filter(t => t.status === 'in_progress').length;
  const doneTasks = executionTasksRows.filter(t => t.status === 'done').length;
  const blockedTasks = executionTasksRows.filter(t => t.status === 'blocked').length;
  const totalTasks = executionTasksRows.length;

  const executionReadiness = {
    totalTasks,
    todoTasks,
    inProgressTasks,
    doneTasks,
    blockedTasks,
    level: computeExecutionLevel(doneTasks, totalTasks),
  };

  const confirmedQuoteScopeIds = new Set<string>();
  for (const q of quotesRows) {
    if (q.scopeId && (q.status === 'committed' || q.status === 'accepted') && activeScopeNodeIds.has(q.scopeId)) {
      confirmedQuoteScopeIds.add(q.scopeId);
    }
  }

  const confirmedInvoiceScopeIds = new Set<string>();
  for (const inv of invoicesRows) {
    if (inv.scopeId && (inv.status === 'finalized' || inv.status === 'paid') && activeScopeNodeIds.has(inv.scopeId)) {
      confirmedInvoiceScopeIds.add(inv.scopeId);
    }
  }

  const directCostNodesWithAllocations = new Set<string>();
  for (const alloc of budgetAllocationsRows) {
    const target = alloc.target as any;
    if (target && typeof target === 'object') {
      const scopeNodeId = target.scopeId || target.scopeNodeId;
      if (scopeNodeId && directCostScopeIds.has(scopeNodeId) && activeScopeNodeIds.has(scopeNodeId)) {
        directCostNodesWithAllocations.add(scopeNodeId);
      }
    }
  }

  const confirmedNodeIds = new Set<string>();
  Array.from(confirmedQuoteScopeIds).forEach(id => confirmedNodeIds.add(id));
  Array.from(confirmedInvoiceScopeIds).forEach(id => confirmedNodeIds.add(id));
  Array.from(directCostNodesWithAllocations).forEach(id => confirmedNodeIds.add(id));

  const confirmedNodes = confirmedNodeIds.size;
  const assumedNodes = totalActiveNodes - confirmedNodes;
  const confirmedRatio = totalActiveNodes > 0 ? confirmedNodes / totalActiveNodes : 0;

  const assumptionsVsConfirmed = {
    totalScopeNodes: totalActiveNodes,
    confirmedNodes,
    assumedNodes,
    confirmedRatio,
    assumedRatio: 1 - confirmedRatio,
  };

  const confirmedFinancing = financingSourcesRows
    .filter(s => s.status === 'Confirmed')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const plannedFinancing = financingSourcesRows
    .filter(s => s.status === 'Planned')
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const totalFinancing = confirmedFinancing + plannedFinancing;

  const financingCoverage = {
    totalFinancingSources: financingSourcesRows.length,
    confirmedFinancing,
    plannedFinancing,
    totalFinancing,
    coverageRatio: budgetDefined ? totalFinancing / totalBudget : 0,
  };

  const confirmedDocs = documentsRows.filter(d => d.confirmed === true);
  const byType: Record<string, number> = {};
  for (const doc of confirmedDocs) {
    const t = doc.documentType ?? 'unknown';
    byType[t] = (byType[t] ?? 0) + 1;
  }

  const documentSummary = {
    totalDocuments: confirmedDocs.length,
    byType,
  };

  const entityCounts = {
    scopeNodes: scopeNodesRows.length,
    budgetAllocations: budgetAllocationsRows.length,
    quotes: quotesRows.length,
    invoices: invoicesRows.length,
    tasks: executionTasksRows.length,
    financingSources: financingSourcesRows.length,
    documents: documentsRows.length,
    inspirations: visionInspirationsRows.filter((i: any) => !i.archived).length,
  };

  return {
    costReality,
    scopeClarity,
    executionReadiness,
    assumptionsVsConfirmed,
    financingCoverage,
    documentSummary,
    entityCounts,
  };
}
