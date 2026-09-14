import {
  FileText,
  Brain,
  CheckCircle2,
  TrendingUp,
  Wallet,
  BarChart3,
  TreePine,
  ChevronRight,
  Shield,
  Compass,
  Lightbulb,
  Receipt,
  FolderOpen,
  HardHat,
} from 'lucide-react';

const LINE_ITEMS = [
  { item: 'Kitchen cabinets', amount: '€12,400' },
  { item: 'Countertops (quartz)', amount: '€4,200' },
  { item: 'Plumbing rough-in', amount: '€3,800' },
  { item: 'Electrical rewiring', amount: '€2,950' },
];

const BUDGET_BARS = [
  { label: 'Kitchen', pct: 72, color: '#B8805A' },
  { label: 'Bathroom', pct: 45, color: '#5B9BD5' },
  { label: 'Electrical', pct: 88, color: '#34C759' },
  { label: 'Plumbing', pct: 60, color: '#FFAA33' },
];

const SCOPE_NODES = [
  { label: 'Kitchen Renovation', depth: 0, progress: 68, children: true },
  { label: 'Demolition', depth: 1, progress: 100, children: false },
  { label: 'Cabinets & Counters', depth: 1, progress: 45, children: true },
  { label: 'Custom island build', depth: 2, progress: 20, children: false },
  { label: 'Plumbing & Electrical', depth: 1, progress: 30, children: false },
];

const SIDEBAR_ITEMS = [
  { icon: Compass, label: 'Overview' },
  { icon: Lightbulb, label: 'Vision' },
  { icon: TreePine, label: 'Scope' },
  { icon: Wallet, label: 'Budget' },
  { icon: FileText, label: 'Quotes' },
  { icon: Receipt, label: 'Invoices' },
  { icon: HardHat, label: 'Execution' },
  { icon: FolderOpen, label: 'Documents' },
];

export function HeroDemo() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-border/60 shadow-2xl select-none bg-background"
      data-testid="hero-demo"
      aria-label="Animated demonstration of RENIX product features cycling through upload, budget, and scope views"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/60 dark:bg-red-400/40" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60 dark:bg-yellow-400/40" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/60 dark:bg-green-400/40" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded bg-muted/50 border border-border/30">
            <span className="text-[9px] text-muted-foreground/60 font-mono">renix.app</span>
          </div>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex h-[260px] sm:h-[300px] lg:h-[340px]">
        <div className="hidden sm:flex flex-col w-12 border-r border-border/40 bg-muted/10 py-2 gap-0.5 shrink-0">
          {SIDEBAR_ITEMS.map((item, i) => (
            <div
              key={item.label}
              className={`flex items-center justify-center w-full py-1.5 ${
                i === 0 ? 'bg-muted/40 border-r-2 border-foreground/30' : ''
              }`}
              title={item.label}
            >
              <item.icon className={`h-3.5 w-3.5 ${i === 0 ? 'text-foreground' : 'text-muted-foreground/50'}`} />
            </div>
          ))}
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="hero-scene hero-scene-1 absolute inset-0 p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4 h-full">
                <div className="hero-s1-doc flex-1 min-w-0">
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 h-full">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] font-medium text-foreground truncate">vendor_quote_v3.pdf</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-muted/60 rounded-full w-full" />
                      <div className="h-2 bg-muted/60 rounded-full w-[85%]" />
                      <div className="h-2 bg-muted/60 rounded-full w-[92%]" />
                      <div className="h-2 bg-muted/40 rounded-full w-[70%]" />
                      <div className="h-2 bg-muted/40 rounded-full w-[88%]" />
                      <div className="h-2 bg-muted/60 rounded-full w-[78%]" />
                      <div className="h-2 bg-muted/40 rounded-full w-[65%]" />
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/30">
                      <div className="h-2 bg-muted/60 rounded-full w-[60%]" />
                      <div className="h-2 bg-muted/40 rounded-full w-[45%] mt-2" />
                    </div>
                  </div>
                </div>

                <div className="hero-s1-results flex-1 min-w-0">
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: '#B8805A' }} />
                      <span className="text-[11px] font-medium text-foreground">Extracted line items</span>
                    </div>
                    <div className="space-y-2 flex-1">
                      {LINE_ITEMS.map((li, i) => (
                        <div
                          key={li.item}
                          className="hero-s1-line flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-background/60 border border-border/30"
                          style={{ animationDelay: `${2.6 + i * 0.25}s` }}
                        >
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{li.item}</span>
                          <span className="text-[10px] sm:text-[11px] font-semibold text-foreground whitespace-nowrap">{li.amount}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hero-s1-total mt-2 pt-2 border-t border-border/30 flex items-center justify-between" style={{ animationDelay: '3.8s' }}>
                      <span className="text-[10px] font-medium text-muted-foreground">Total</span>
                      <span className="text-xs font-bold text-foreground">€23,350</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hero-s1-ai absolute left-1/2 -translate-x-1/2 top-[42%]  z-10">
                <div className="flex items-center gap-2 bg-background/95 dark:bg-background/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg border border-border/50">
                  <Brain className="h-3.5 w-3.5 shrink-0" style={{ color: '#B8805A' }} />
                  <span className="text-[10px] sm:text-[11px] font-medium text-foreground whitespace-nowrap">AI extracting data…</span>
                  <span className="flex gap-0.5">
                    <span className="hero-dot w-1 h-1 rounded-full" style={{ backgroundColor: '#B8805A' }} />
                    <span className="hero-dot w-1 h-1 rounded-full" style={{ backgroundColor: '#B8805A', animationDelay: '0.15s' }} />
                    <span className="hero-dot w-1 h-1 rounded-full" style={{ backgroundColor: '#B8805A', animationDelay: '0.3s' }} />
                  </span>
                </div>
              </div>

              <div className="hero-s1-badge absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
                <div className="flex items-center gap-2 bg-background/95 dark:bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-border/50">
                  <TrendingUp className="h-3 w-3 shrink-0" style={{ color: '#B8805A' }} />
                  <div>
                    <span className="text-[9px] text-muted-foreground block leading-tight">Budget impact</span>
                    <span className="text-[11px] font-semibold text-foreground">€23,350 committed</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-scene hero-scene-2 absolute inset-0 p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4 h-full">
                <div className="hero-s2-bars flex-1 min-w-0">
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0" style={{ color: '#B8805A' }} />
                      <span className="text-[11px] font-medium text-foreground">Budget Allocation</span>
                    </div>
                    <div className="space-y-3 flex-1">
                      {BUDGET_BARS.map((bar, i) => (
                        <div key={bar.label} className="hero-s2-bar" style={{ animationDelay: `${4.8 + i * 0.2}s` }}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] sm:text-[11px] text-muted-foreground">{bar.label}</span>
                            <span className="text-[10px] sm:text-[11px] font-medium text-foreground">{bar.pct}%</span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full hero-s2-bar-fill"
                              style={{ backgroundColor: bar.color, '--bar-width': `${bar.pct}%` } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hero-s2-contingency mt-2 pt-2 border-t border-border/30" style={{ animationDelay: '5.8s' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Contingency reserve</span>
                        <span className="text-[10px] font-medium text-foreground">5%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hero-s2-kpis flex-1 min-w-0">
                  <div className="space-y-2 h-full flex flex-col">
                    {[
                      { label: 'Total Budget', value: '€85,000', icon: Wallet, sub: 'Set' },
                      { label: 'Committed', value: '€52,350', icon: CheckCircle2, sub: '61.6%' },
                      { label: 'Remaining', value: '€32,650', icon: TrendingUp, sub: '38.4%' },
                    ].map((kpi, i) => (
                      <div
                        key={kpi.label}
                        className="hero-s2-kpi bg-muted/20 border border-border/40 rounded-lg p-3 flex-1"
                        style={{ animationDelay: `${5.0 + i * 0.25}s` }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                            <kpi.icon className="h-3.5 w-3.5 shrink-0" style={{ color: '#B8805A' }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[9px] text-muted-foreground block leading-tight">{kpi.label}</span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-bold text-foreground">{kpi.value}</span>
                              <span className="text-[9px] text-muted-foreground/60">{kpi.sub}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="hero-s2-health absolute bottom-3 sm:bottom-4 left-3 sm:left-4">
                <div className="flex items-center gap-2 bg-background/95 dark:bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-border/50">
                  <Shield className="h-3 w-3 shrink-0" style={{ color: '#34C759' }} />
                  <div>
                    <span className="text-[9px] text-muted-foreground block leading-tight">Project health</span>
                    <span className="text-[11px] font-semibold text-foreground">On track</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-scene hero-scene-3 absolute inset-0 p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4 h-full">
                <div className="hero-s3-tree flex-[1.2] min-w-0">
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <TreePine className="h-3.5 w-3.5 shrink-0" style={{ color: '#B8805A' }} />
                      <span className="text-[11px] font-medium text-foreground">Scope Tree</span>
                    </div>
                    <div className="space-y-1 flex-1">
                      {SCOPE_NODES.map((node, i) => (
                        <div
                          key={node.label}
                          className="hero-s3-node flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/20"
                          style={{
                            paddingLeft: `${node.depth * 12 + 6}px`,
                            animationDelay: `${8.8 + i * 0.2}s`,
                          }}
                        >
                          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${node.children ? 'rotate-90' : ''} text-muted-foreground/60`} />
                          <span className="text-[10px] sm:text-[11px] text-foreground truncate flex-1">{node.label}</span>
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                            node.progress === 100
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'text-muted-foreground bg-muted/40'
                          }`}>
                            {node.progress === 100 ? 'Done' : `${node.progress}%`}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="hero-s3-add mt-2 pt-2 border-t border-border/30" style={{ animationDelay: '10s' }}>
                      <div className="flex items-center gap-1.5 text-muted-foreground/50">
                        <span className="text-[10px]">+ Add scope</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hero-s3-progress flex-1 min-w-0">
                  <div className="bg-muted/20 border border-border/40 rounded-lg p-3 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3 className="h-3.5 w-3.5 shrink-0" style={{ color: '#B8805A' }} />
                      <span className="text-[11px] font-medium text-foreground">Progress</span>
                    </div>
                    <div className="space-y-3 flex-1">
                      {SCOPE_NODES.filter(n => n.depth <= 1).map((node, i) => (
                        <div
                          key={node.label}
                          className="hero-s3-pbar"
                          style={{ animationDelay: `${9.2 + i * 0.25}s` }}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{node.label}</span>
                            <span className="text-[10px] sm:text-[11px] font-medium text-foreground">{node.progress}%</span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full hero-s3-pbar-fill"
                              style={{
                                backgroundColor: node.progress === 100 ? '#34C759' : '#B8805A',
                                '--bar-width': `${node.progress}%`,
                              } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hero-s3-summary mt-2 pt-2 border-t border-border/30" style={{ animationDelay: '10.2s' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Tasks</span>
                        <span className="text-[10px] font-medium text-foreground">12 / 28</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hero-s3-badge absolute bottom-3 sm:bottom-4 right-3 sm:right-4">
                <div className="flex items-center gap-2 bg-background/95 dark:bg-background/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-border/50">
                  <CheckCircle2 className="h-3 w-3 shrink-0" style={{ color: '#34C759' }} />
                  <div>
                    <span className="text-[9px] text-muted-foreground block leading-tight">Overall</span>
                    <span className="text-[11px] font-semibold text-foreground">68% complete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-2 border-t border-border/40 bg-muted/10" data-testid="hero-scene-dots">
        <span className="hero-scene-dot hero-scene-dot-1 w-1.5 h-1.5 rounded-full" />
        <span className="hero-scene-dot hero-scene-dot-2 w-1.5 h-1.5 rounded-full" />
        <span className="hero-scene-dot hero-scene-dot-3 w-1.5 h-1.5 rounded-full" />
      </div>

      <style>{`
        .hero-scene {
          opacity: 0;
          will-change: opacity;
        }

        .hero-scene-1 { animation: hero-s1-vis 13s ease-in-out infinite; }
        .hero-scene-2 { animation: hero-s2-vis 13s ease-in-out infinite; }
        .hero-scene-3 { animation: hero-s3-vis 13s ease-in-out infinite; }

        @keyframes hero-s1-vis {
          0%    { opacity: 0; }
          2%    { opacity: 1; }
          31%   { opacity: 1; }
          35%   { opacity: 0; }
          100%  { opacity: 0; }
        }
        @keyframes hero-s2-vis {
          0%    { opacity: 0; }
          33%   { opacity: 0; }
          37%   { opacity: 1; }
          64%   { opacity: 1; }
          68%   { opacity: 0; }
          100%  { opacity: 0; }
        }
        @keyframes hero-s3-vis {
          0%    { opacity: 0; }
          66%   { opacity: 0; }
          70%   { opacity: 1; }
          96%   { opacity: 1; }
          100%  { opacity: 0; }
        }

        .hero-s1-doc {
          opacity: 0;
          transform: translateX(-20px);
          animation: hero-enter-left 0.6s ease-out 0.3s forwards;
        }
        .hero-s1-ai {
          opacity: 0;
          transform: scale(0.8);
          animation: hero-enter-scale 0.5s ease-out 1.2s forwards,
                     hero-s1-vis 13s ease-in-out infinite;
        }
        .hero-s1-results {
          opacity: 0;
          transform: translateX(20px);
          animation: hero-enter-right 0.6s ease-out 1.8s forwards;
        }
        .hero-s1-line {
          opacity: 0;
          transform: translateY(4px);
          animation: hero-enter-up 0.3s ease-out forwards;
        }
        .hero-s1-total {
          opacity: 0;
          animation: hero-enter-up 0.4s ease-out forwards;
        }
        .hero-s1-badge {
          opacity: 0;
          transform: translateY(8px);
          animation: hero-enter-up 0.5s ease-out 3.6s forwards,
                     hero-s1-vis 13s ease-in-out infinite;
        }

        .hero-s2-bars {
          opacity: 0;
          transform: translateX(-20px);
          animation: hero-enter-left 0.6s ease-out 4.6s forwards;
        }
        .hero-s2-bar {
          opacity: 0;
          transform: translateY(4px);
          animation: hero-enter-up 0.3s ease-out forwards;
        }
        .hero-s2-bar-fill {
          width: 0;
          animation: hero-bar-grow 0.8s ease-out 5.4s forwards;
        }
        .hero-s2-contingency {
          opacity: 0;
          animation: hero-enter-up 0.4s ease-out forwards;
        }
        .hero-s2-kpis {
          animation: hero-s2-vis 13s ease-in-out infinite;
        }
        .hero-s2-kpi {
          opacity: 0;
          transform: translateX(20px);
          animation: hero-enter-right 0.4s ease-out forwards;
        }
        .hero-s2-health {
          opacity: 0;
          transform: translateY(8px);
          animation: hero-enter-up 0.5s ease-out 6.2s forwards,
                     hero-s2-vis 13s ease-in-out infinite;
        }

        .hero-s3-tree {
          opacity: 0;
          transform: translateX(-20px);
          animation: hero-enter-left 0.6s ease-out 8.6s forwards;
        }
        .hero-s3-node {
          opacity: 0;
          transform: translateX(-6px);
          animation: hero-enter-left-sm 0.3s ease-out forwards;
        }
        .hero-s3-add {
          opacity: 0;
          animation: hero-enter-up 0.3s ease-out forwards;
        }
        .hero-s3-progress {
          opacity: 0;
          transform: translateX(20px);
          animation: hero-enter-right 0.6s ease-out 8.8s forwards;
        }
        .hero-s3-pbar {
          opacity: 0;
          transform: translateY(4px);
          animation: hero-enter-up 0.3s ease-out forwards;
        }
        .hero-s3-pbar-fill {
          width: 0;
          animation: hero-bar-grow 0.8s ease-out 9.8s forwards;
        }
        .hero-s3-summary {
          opacity: 0;
          animation: hero-enter-up 0.3s ease-out forwards;
        }
        .hero-s3-badge {
          opacity: 0;
          transform: translateY(8px);
          animation: hero-enter-up 0.5s ease-out 10.6s forwards,
                     hero-s3-vis 13s ease-in-out infinite;
        }

        .hero-scene-dot {
          background-color: hsl(var(--muted-foreground) / 0.25);
          transition: background-color 0.3s ease;
        }
        .hero-scene-dot-1 { animation: hero-dot1-active 13s ease-in-out infinite; }
        .hero-scene-dot-2 { animation: hero-dot2-active 13s ease-in-out infinite; }
        .hero-scene-dot-3 { animation: hero-dot3-active 13s ease-in-out infinite; }

        @keyframes hero-dot1-active {
          0%, 31%   { background-color: #B8805A; }
          35%, 100% { background-color: hsl(var(--muted-foreground) / 0.25); }
        }
        @keyframes hero-dot2-active {
          0%, 33%   { background-color: hsl(var(--muted-foreground) / 0.25); }
          37%, 64%  { background-color: #B8805A; }
          68%, 100% { background-color: hsl(var(--muted-foreground) / 0.25); }
        }
        @keyframes hero-dot3-active {
          0%, 66%   { background-color: hsl(var(--muted-foreground) / 0.25); }
          70%, 96%  { background-color: #B8805A; }
          100%      { background-color: hsl(var(--muted-foreground) / 0.25); }
        }

        .hero-dot {
          animation: hero-dot-pulse 0.6s ease-in-out infinite alternate;
        }

        @keyframes hero-enter-left {
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes hero-enter-left-sm {
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes hero-enter-right {
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes hero-enter-scale {
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes hero-enter-up {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-dot-pulse {
          from { opacity: 0.3; }
          to { opacity: 1; }
        }
        @keyframes hero-bar-grow {
          to { width: var(--bar-width); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-scene,
          .hero-scene-1,
          .hero-scene-2,
          .hero-scene-3,
          .hero-s1-doc,
          .hero-s1-ai,
          .hero-s1-results,
          .hero-s1-line,
          .hero-s1-total,
          .hero-s1-badge,
          .hero-s2-bars,
          .hero-s2-bar,
          .hero-s2-bar-fill,
          .hero-s2-contingency,
          .hero-s2-kpis,
          .hero-s2-kpi,
          .hero-s2-health,
          .hero-s3-tree,
          .hero-s3-node,
          .hero-s3-add,
          .hero-s3-progress,
          .hero-s3-pbar,
          .hero-s3-pbar-fill,
          .hero-s3-summary,
          .hero-s3-badge,
          .hero-scene-dot,
          .hero-scene-dot-1,
          .hero-scene-dot-2,
          .hero-scene-dot-3,
          .hero-dot {
            animation: none !important;
          }
          .hero-scene-1 { opacity: 1 !important; }
          .hero-scene-2,
          .hero-scene-3 { opacity: 0 !important; }
          .hero-s1-doc,
          .hero-s1-ai,
          .hero-s1-results,
          .hero-s1-line,
          .hero-s1-total,
          .hero-s1-badge {
            opacity: 1 !important;
            transform: none !important;
          }
          .hero-scene-dot-1 {
            background-color: #B8805A !important;
          }
          .hero-s2-bar-fill,
          .hero-s3-pbar-fill {
            width: var(--bar-width) !important;
          }
        }
      `}</style>
    </div>
  );
}
