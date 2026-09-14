import { Button } from "@/components/ui/button";
import { AlertTriangle, CircleAlert, Lightbulb, Shield, CheckCircle, ArrowLeft, Lock } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

const ACTIVE_PALETTE = {
  label: "Direction 3: Cool Neutrals + Copper Accent",
  backgrounds: [
    { name: "bg-light-1", value: "#ffffff", desc: "Clean white" },
    { name: "bg-light-2", value: "#f6f7f9", desc: "Cool gray" },
    { name: "bg-light-3", value: "#eceff3", desc: "Deepest cool" },
  ],
  darkBackgrounds: [
    { name: "bg-dark-1", value: "#121621", desc: "Deep navy" },
    { name: "bg-dark-2", value: "#0b0e14", desc: "Darker navy" },
    { name: "bg-dark-3", value: "#000000", desc: "Black" },
  ],
  surfaces: [
    { name: "surface-1", value: "#ffffff", desc: "Cards (primary)" },
    { name: "surface-2", value: "#f1f3f6", desc: "Recessed" },
    { name: "surface-3", value: "#e8ebf0", desc: "Tertiary" },
  ],
  darkSurfaces: [
    { name: "surface-dark-1", value: "#121621", desc: "Cards (primary)" },
    { name: "surface-dark-2", value: "#1a1f2e", desc: "Recessed" },
    { name: "surface-dark-3", value: "#242a3a", desc: "Tertiary" },
  ],
  text: [
    { name: "primary", value: "#0f172a" },
    { name: "secondary", value: "#475569" },
    { name: "muted", value: "#64748b" },
  ],
  darkText: [
    { name: "primary", value: "#e5e7eb" },
    { name: "secondary", value: "#9ca3af" },
    { name: "muted", value: "#6b7280" },
  ],
  accent: { name: "Warm Copper", value: "#B8805A" },
  accentHover: { name: "Copper Hover", value: "#A06F4C" },
  signals: [
    { name: "Success (Emerald)", value: "#34C759" },
    { name: "Warning (Amber)", value: "#FFAA33" },
    { name: "Danger (Coral)", value: "#E8503A" },
    { name: "Info (Steel)", value: "#5B9BD5" },
  ],
  chart: [
    { name: "Copper", value: "#B8805A" },
    { name: "Emerald", value: "#34C759" },
    { name: "Amber", value: "#FFAA33" },
    { name: "Coral", value: "#E8503A" },
    { name: "Steel", value: "#5B9BD5" },
    { name: "Sage", value: "#7BAE7F" },
    { name: "Clay", value: "#D4915C" },
    { name: "Slate", value: "#8E8E93" },
  ],
  glows: [
    { name: "Blue glow", value: "rgba(0, 126, 255, 0.12)" },
    { name: "Aubergine glow", value: "rgba(124, 58, 237, 0.08)" },
    { name: "Copper glow", value: "rgba(184, 128, 90, 0.05)" },
  ],
  borders: { light: "rgba(15, 23, 42, 0.10)", dark: "rgba(229, 231, 235, 0.10)" },
};

function SwatchRow({ colors }: { colors: { name: string; value: string; desc?: string }[] }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {colors.map((c) => (
        <div key={c.name} className="flex flex-col items-center gap-1">
          <div
            className="w-16 h-16 rounded-lg border border-border/50 shadow-sm"
            style={{ backgroundColor: c.value }}
            data-testid={`swatch-${c.name}`}
          />
          <span className="text-[10px] font-medium text-foreground">{c.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{c.value}</span>
          {c.desc && <span className="text-[9px] text-muted-foreground/70">{c.desc}</span>}
        </div>
      ))}
    </div>
  );
}

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}


export default function DesignPreviewPage() {
  const p = ACTIVE_PALETTE;

  return (
    <div className="min-h-screen" data-testid="design-preview-page">
      <div id="renix-bg" className="fixed inset-0 z-0 pointer-events-none" />
      <div className="relative z-10">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/ui-catalog">
              <Button variant="ghost" size="sm" data-testid="link-back-catalog">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to UI Catalog
              </Button>
            </Link>
          </div>

          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
                RENIX Design Palette
              </h1>
              <Badge variant="outline" className="gap-1.5 text-xs border-[var(--accent-copper)]/30 text-[var(--accent-copper)]">
                <Lock className="w-3 h-3" />
                Direction 3 — Locked
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              The canonical palette for RENIX vNext. Cool neutral backgrounds with warm copper as an accent-only color.
              All values here match the live CSS variables in <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">index.css</code>.
            </p>
          </div>

          <div className="renix-frame mb-10">
            <h2 className="text-sm font-semibold text-foreground mb-4">Design Principles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="renix-surface p-4 space-y-1">
                <p className="text-sm font-medium text-foreground">Copper is accent-only</p>
                <p className="text-xs text-muted-foreground">Never use copper for backgrounds or surfaces. It's reserved for highlights, CTAs, links, and brand moments.</p>
              </div>
              <div className="renix-surface p-4 space-y-1">
                <p className="text-sm font-medium text-foreground">Cool neutral surfaces</p>
                <p className="text-xs text-muted-foreground">All backgrounds and surfaces use clean white-to-gray tones with no warm/yellow tinting. Crisp and modern.</p>
              </div>
              <div className="renix-surface p-4 space-y-1">
                <p className="text-sm font-medium text-foreground">Blue + aubergine glows</p>
                <p className="text-xs text-muted-foreground">Subtle radial gradients using blue and aubergine create depth. A trace of copper glow adds warmth without shifting the base.</p>
              </div>
            </div>
          </div>

          <div className="renix-frame mb-10">
            <h2 className="text-sm font-semibold text-foreground mb-2">Project Card — Redesigned</h2>
            <p className="text-xs text-muted-foreground mb-6">
              The hero-image project card design has been implemented. See live cards on the Projects page.
            </p>
          </div>

          <div className="space-y-10">
            <div className="renix-surface p-6 space-y-8">
              <PaletteSection title="Backgrounds — Light Mode (Cool Neutrals)">
                <SwatchRow colors={p.backgrounds} />
              </PaletteSection>

              <PaletteSection title="Backgrounds — Dark Mode (Deep Navy)">
                <SwatchRow colors={p.darkBackgrounds} />
              </PaletteSection>

              <PaletteSection title="Surfaces — Light Mode (3-tier depth)">
                <SwatchRow colors={p.surfaces} />
              </PaletteSection>

              <PaletteSection title="Surfaces — Dark Mode">
                <SwatchRow colors={p.darkSurfaces} />
              </PaletteSection>

              <PaletteSection title="Text — Light Mode (Crisp Slate)">
                <div className="flex gap-4">
                  {p.text.map((t) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded" style={{ backgroundColor: t.value }} />
                      <span className="text-sm font-medium" style={{ color: t.value }}>{t.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{t.value}</span>
                    </div>
                  ))}
                </div>
              </PaletteSection>

              <PaletteSection title="Text — Dark Mode">
                <div className="flex gap-4">
                  {p.darkText.map((t) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-border/50" style={{ backgroundColor: t.value }} />
                      <span className="text-sm font-medium text-muted-foreground">{t.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{t.value}</span>
                    </div>
                  ))}
                </div>
              </PaletteSection>

              <PaletteSection title="Brand Accent — Warm Copper (accent-only, never backgrounds)">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg shadow-sm" style={{ backgroundColor: p.accent.value }} />
                    <div>
                      <span className="text-sm font-medium" style={{ color: p.accent.value }}>{p.accent.name}</span>
                      <p className="text-[10px] font-mono text-muted-foreground">{p.accent.value}</p>
                      <p className="text-[10px] text-muted-foreground">--accent-copper</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg shadow-sm" style={{ backgroundColor: p.accentHover.value }} />
                    <div>
                      <span className="text-sm font-medium" style={{ color: p.accentHover.value }}>{p.accentHover.name}</span>
                      <p className="text-[10px] font-mono text-muted-foreground">{p.accentHover.value}</p>
                      <p className="text-[10px] text-muted-foreground">--accent-copper-hover</p>
                    </div>
                  </div>
                </div>
              </PaletteSection>

              <PaletteSection title="Signal Colors">
                <SwatchRow colors={p.signals} />
              </PaletteSection>

              <PaletteSection title="Chart Palette (8 distinguishable)">
                <SwatchRow colors={p.chart} />
              </PaletteSection>

              <PaletteSection title="Background Glows">
                <div className="flex gap-3">
                  {p.glows.map((g) => (
                    <div key={g.name} className="flex flex-col items-center gap-1">
                      <div
                        className="w-24 h-14 rounded-lg border border-border/30"
                        style={{ background: `radial-gradient(ellipse at center, ${g.value}, transparent)` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{g.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/60">{g.value}</span>
                    </div>
                  ))}
                </div>
              </PaletteSection>

              <PaletteSection title="Borders">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: p.borders.light }} />
                    <span className="text-xs text-muted-foreground">Light: {p.borders.light}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-border/50" style={{ backgroundColor: p.borders.dark }} />
                    <span className="text-xs text-muted-foreground">Dark: {p.borders.dark}</span>
                  </div>
                </div>
              </PaletteSection>
            </div>

            <div className="renix-surface p-6 space-y-6">
              <h2 className="text-sm font-semibold text-foreground">Live Preview</h2>

              <PaletteSection title="Sample Card">
                <div
                  className="rounded-xl p-4 space-y-3 max-w-sm"
                  style={{
                    backgroundColor: p.surfaces[0].value,
                    border: `1px solid ${p.borders.light}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: p.text[0].value }}>
                      Kitchen Renovation
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: p.signals[0].value }}
                    >
                      Active
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: p.text[1].value }}>
                    Full kitchen redesign with custom cabinetry and premium finishes.
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]" style={{ color: p.text[2].value }}>
                      <span>Budget progress</span>
                      <span>72%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: p.backgrounds[2].value }}>
                      <div
                        className="h-full rounded-full"
                        style={{ backgroundColor: p.accent.value, width: "72%" }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: p.backgrounds[2].value, color: p.text[1].value }}
                    >
                      Residential
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: `${p.signals[3].value}15`, color: p.signals[3].value }}
                    >
                      3 quotes pending
                    </span>
                  </div>
                </div>
              </PaletteSection>

              <PaletteSection title="Sample Buttons">
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: p.text[0].value }}
                  >
                    Primary
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{ border: `1px solid ${p.borders.light}`, color: p.text[0].value }}
                  >
                    Secondary
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: p.accent.value }}
                  >
                    Accent
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ backgroundColor: p.signals[2].value }}
                  >
                    Danger
                  </button>
                </div>
              </PaletteSection>

              <PaletteSection title="Signal Icons">
                <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" style={{ color: p.signals[2].value }} />
                    <span className="text-xs" style={{ color: p.text[1].value }}>High</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CircleAlert className="h-4 w-4" style={{ color: p.signals[1].value }} />
                    <span className="text-xs" style={{ color: p.text[1].value }}>Medium</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Lightbulb className="h-4 w-4" style={{ color: p.signals[3].value }} />
                    <span className="text-xs" style={{ color: p.text[1].value }}>Low</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4" style={{ color: p.signals[0].value }} />
                    <span className="text-xs" style={{ color: p.text[1].value }}>Safe</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" style={{ color: p.signals[0].value }} />
                    <span className="text-xs" style={{ color: p.text[1].value }}>Done</span>
                  </div>
                </div>
              </PaletteSection>

              <PaletteSection title="Badges">
                <div className="flex gap-2 flex-wrap">
                  {p.signals.map((s) => (
                    <span
                      key={s.name}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: `${s.value}18`, color: s.value }}
                    >
                      {s.name}
                    </span>
                  ))}
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: `${p.accent.value}18`, color: p.accent.value }}
                  >
                    Accent
                  </span>
                </div>
              </PaletteSection>

              <PaletteSection title="Page Background Preview">
                <div
                  className="h-32 rounded-xl border border-border/30 overflow-hidden relative"
                  style={{
                    background: `
                      radial-gradient(ellipse 80% 60% at 20% 10%, ${p.glows[0].value}, transparent 70%),
                      radial-gradient(ellipse 60% 50% at 80% 30%, ${p.glows[1].value}, transparent 70%),
                      radial-gradient(ellipse 90% 40% at 50% 90%, ${p.glows[2].value}, transparent 60%),
                      linear-gradient(to bottom, ${p.backgrounds[0].value}, ${p.backgrounds[1].value}, ${p.backgrounds[2].value})
                    `,
                  }}
                >
                  <div
                    className="absolute bottom-3 left-3 right-3 rounded-lg p-3"
                    style={{
                      backgroundColor: `${p.surfaces[0].value}cc`,
                      backdropFilter: "blur(8px)",
                      border: `1px solid ${p.borders.light}`,
                    }}
                  >
                    <span className="text-xs font-medium" style={{ color: p.text[0].value }}>
                      Glass card on gradient background
                    </span>
                  </div>
                </div>
              </PaletteSection>
            </div>
          </div>

          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}
