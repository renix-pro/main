import {
  TreePine,
  Wallet,
  FileText,
  ChevronRight,
  CheckCircle2,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Shield,
  BarChart3,
} from 'lucide-react';

export function ScopePreview() {
  const nodes = [
    { label: 'Kitchen Renovation', depth: 0, status: 'active', pct: 68, hasKids: true },
    { label: 'Demolition', depth: 1, status: 'done', pct: 100, hasKids: false },
    { label: 'Cabinets & Counters', depth: 1, status: 'active', pct: 45, hasKids: true },
    { label: 'Custom island', depth: 2, status: 'active', pct: 20, hasKids: false },
    { label: 'Backsplash tile', depth: 2, status: 'pending', pct: 0, hasKids: false },
    { label: 'Plumbing', depth: 1, status: 'active', pct: 60, hasKids: false },
    { label: 'Electrical', depth: 1, status: 'active', pct: 30, hasKids: false },
    { label: 'Flooring', depth: 1, status: 'pending', pct: 0, hasKids: false },
  ];

  return (
    <div className="renix-surface overflow-hidden select-none" data-testid="preview-scope">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/20">
        <TreePine className="h-3.5 w-3.5" style={{ color: '#B8805A' }} />
        <span className="text-xs font-semibold text-foreground">Scope</span>
        <span className="ml-auto text-[10px] text-muted-foreground">8 items</span>
      </div>
      <div className="p-2 space-y-0.5">
        {nodes.map((n) => (
          <div
            key={n.label}
            className="flex items-center gap-1.5 py-1.5 px-1.5 rounded hover:bg-muted/20 transition-colors"
            style={{ paddingLeft: `${n.depth * 14 + 6}px` }}
          >
            <ChevronRight
              className={`h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform ${n.hasKids ? 'rotate-90' : 'opacity-0'}`}
            />
            <span className="text-[11px] text-foreground truncate flex-1">{n.label}</span>
            <span
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                n.status === 'done'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : n.status === 'active'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-muted/40 text-muted-foreground'
              }`}
            >
              {n.status === 'done' ? 'Done' : n.pct > 0 ? `${n.pct}%` : 'Pending'}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 py-1.5 px-1.5 text-muted-foreground/40">
          <span className="text-[10px]">+ Add scope area</span>
        </div>
      </div>
    </div>
  );
}

export function BudgetPreview() {
  const allocations = [
    { scope: 'Cabinets & Counters', allocated: 18000, committed: 12400, color: '#B8805A' },
    { scope: 'Plumbing', allocated: 8000, committed: 3800, color: '#5B9BD5' },
    { scope: 'Electrical', allocated: 6000, committed: 2950, color: '#FFAA33' },
    { scope: 'Flooring', allocated: 5000, committed: 0, color: '#34C759' },
    { scope: 'Demolition', allocated: 3000, committed: 3000, color: '#8B5CF6' },
  ];
  const total = 85000;
  const allocated = allocations.reduce((s, a) => s + a.allocated, 0);
  const committed = allocations.reduce((s, a) => s + a.committed, 0);

  return (
    <div className="renix-surface overflow-hidden select-none" data-testid="preview-budget">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/20">
        <Wallet className="h-3.5 w-3.5" style={{ color: '#B8805A' }} />
        <span className="text-xs font-semibold text-foreground">Budget</span>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-muted/20 border border-border/30 rounded-lg p-2">
            <span className="text-[9px] text-muted-foreground block">Budget Intent</span>
            <span className="text-sm font-bold text-foreground">€{(total / 1000).toFixed(0)}K</span>
          </div>
          <div className="bg-muted/20 border border-border/30 rounded-lg p-2">
            <span className="text-[9px] text-muted-foreground block">Allocated</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-foreground">€{(allocated / 1000).toFixed(0)}K</span>
              <ArrowUpRight className="h-2.5 w-2.5 text-amber-500" />
            </div>
          </div>
          <div className="bg-muted/20 border border-border/30 rounded-lg p-2">
            <span className="text-[9px] text-muted-foreground block">Committed</span>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-foreground">€{(committed / 1000).toFixed(1)}K</span>
              <ArrowDownRight className="h-2.5 w-2.5 text-green-500" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {allocations.map((a) => {
            const pct = Math.round((a.committed / a.allocated) * 100);
            return (
              <div key={a.scope}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-muted-foreground truncate">{a.scope}</span>
                  <span className="text-[10px] font-medium text-foreground">
                    €{a.committed.toLocaleString()} / €{a.allocated.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: a.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-green-500" />
            <span className="text-[10px] text-muted-foreground">Contingency 5%</span>
          </div>
          <span className="text-[10px] font-medium text-foreground">€4,250</span>
        </div>
      </div>
    </div>
  );
}

export function QuotesPreview() {
  const quotes = [
    { vendor: 'SteinCraft GmbH', scope: 'Countertops', amount: 4200, status: 'accepted', items: 3 },
    { vendor: 'HydroFix AG', scope: 'Plumbing', amount: 3800, status: 'accepted', items: 5 },
    { vendor: 'SparkTech', scope: 'Electrical', amount: 2950, status: 'review', items: 4 },
    { vendor: 'FloorMasters', scope: 'Flooring', amount: 4100, status: 'new', items: 6 },
    { vendor: 'KüchenWerk', scope: 'Cabinets', amount: 12400, status: 'accepted', items: 8 },
  ];

  return (
    <div className="renix-surface overflow-hidden select-none" data-testid="preview-quotes">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/20">
        <FileText className="h-3.5 w-3.5" style={{ color: '#B8805A' }} />
        <span className="text-xs font-semibold text-foreground">Quotes</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{quotes.length} quotes</span>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0 text-[9px] text-muted-foreground/60 px-2 py-1 border-b border-border/20 font-medium uppercase tracking-wider">
          <span>Vendor</span>
          <span>Items</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        {quotes.map((q) => (
          <div
            key={q.vendor}
            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-2 py-1.5 border-b border-border/10 last:border-0 hover:bg-muted/10"
          >
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-foreground block truncate">{q.vendor}</span>
              <span className="text-[9px] text-muted-foreground">{q.scope}</span>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{q.items}</span>
            <span className="text-[11px] font-medium text-foreground tabular-nums">€{q.amount.toLocaleString()}</span>
            <span
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                q.status === 'accepted'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : q.status === 'review'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}
            >
              {q.status === 'accepted' ? 'Accepted' : q.status === 'review' ? 'In Review' : 'New'}
            </span>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 border-t border-border/30 bg-muted/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span className="text-[10px] text-muted-foreground">3 accepted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3" style={{ color: '#B8805A' }} />
          <span className="text-[10px] font-medium text-foreground">€27,450 committed</span>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-muted/5 border-t border-border/20">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="h-3 w-3 text-muted-foreground/40" />
          <span className="text-[9px] text-muted-foreground/60">AI extracted 26 line items across 5 documents</span>
        </div>
      </div>
    </div>
  );
}
