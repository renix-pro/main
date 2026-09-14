export interface CostRealityMetrics {
  budgetDefined: boolean;
  totalBudget: number;
  totalAllocated: number;
  totalQuoted: number;
  totalInvoiced: number;
  totalPaid: number;
  allocatedRatio: number;
  invoicedRatio: number;
}

export interface ScopeClarityMetrics {
  totalScopeNodes: number;
  nodesWithQuotes: number;
  nodesWithAllocations: number;
  nodesWithTasks: number;
  level: 1 | 2 | 3 | 4 | 5;
}

export interface ExecutionReadinessMetrics {
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  blockedTasks: number;
  level: 1 | 2 | 3 | 4 | 5;
}

export interface AssumptionsVsConfirmedMetrics {
  totalScopeNodes: number;
  confirmedNodes: number;
  assumedNodes: number;
  confirmedRatio: number;
  assumedRatio: number;
}

export interface FinancingCoverageMetrics {
  totalFinancingSources: number;
  confirmedFinancing: number;
  plannedFinancing: number;
  totalFinancing: number;
  coverageRatio: number;
}

export interface AIInterpretations {
  overallLabel: string;
  overallExplanation: string;
  costRealityInterpretation: string;
  scopeClarityInterpretation: string;
  executionReadinessInterpretation: string;
  assumptionsInterpretation: string;
  attentionSignals: AttentionSignal[];
  narrative: string;
  reassurance: string;
}

export interface AttentionSignal {
  title: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  targetFrame?: 'scope' | 'budget' | 'quotes' | 'invoices' | 'financing' | 'execution' | 'documents' | 'vision';
}

export interface OverviewFrameContract {
  snapshotAt: string;
  computed: {
    costReality: CostRealityMetrics;
    scopeClarity: ScopeClarityMetrics;
    executionReadiness: ExecutionReadinessMetrics;
    assumptionsVsConfirmed: AssumptionsVsConfirmedMetrics;
    financingCoverage: FinancingCoverageMetrics;
    entityCounts: {
      scopeNodes: number;
      budgetAllocations: number;
      quotes: number;
      invoices: number;
      tasks: number;
      financingSources: number;
      documents: number;
    };
  };
  interpretations: AIInterpretations;
}
