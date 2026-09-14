import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Download,
  Edit,
  Eye,
  FileText,
  Heart,
  Home,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RenixLoader, RenixSpinner } from '@/components/RenixLoader';

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-foreground" data-testid={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function Swatch({ name, hex, darkHex, cssVar, className, textClass }: { name: string; hex: string; darkHex?: string; cssVar: string; className: string; textClass?: string }) {
  const [copied, setCopied] = useState(false);
  const copyHex = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="flex flex-col items-start gap-1 min-w-[120px] cursor-pointer group" onClick={copyHex} data-testid={`swatch-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={cn("w-full h-12 rounded-lg border border-border/50 transition-shadow group-hover:shadow-md", className)} />
      <span className={cn("text-xs font-semibold", textClass || "text-foreground")}>{name}</span>
      <span className="text-[10px] font-mono text-muted-foreground">{hex}{darkHex ? ` / ${darkHex}` : ''}</span>
      <span className="text-[10px] font-mono text-muted-foreground/60">{cssVar}</span>
      {copied && <span className="text-[10px] text-status-approved font-medium">Copied!</span>}
    </div>
  );
}

export default function UICatalogPage() {
  const [progressValue, setProgressValue] = useState(65);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [sliderValue, setSliderValue] = useState([50]);

  return (
    <div className="min-h-screen">
      <div id="renix-bg" className="fixed inset-0 z-0 pointer-events-none" />
      <div className="relative z-10">
        <header className="h-14 w-full renix-glass renix-global-header flex items-center px-6 sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-wide text-foreground">RENIX</span>
            <Separator orientation="vertical" className="h-5 mx-2" />
            <span className="text-sm text-muted-foreground">UI Catalog</span>
            <Badge variant="outline" className="ml-2 text-[10px] border-[var(--accent-copper)]/30 text-[var(--accent-copper)]">
              Direction 3 — Locked
            </Badge>
          </div>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <div className="max-w-6xl mx-auto px-6 py-10 space-y-16">

          <div className="renix-frame p-5">
            <p className="text-sm text-foreground font-medium mb-1">Cool Neutrals + Copper Accent</p>
            <p className="text-xs text-muted-foreground">
              Copper is accent-only, never backgrounds. Clean cool surfaces with no warm/yellow tint. Blue + aubergine glows for depth.
              All values below match the live CSS variables in <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">index.css</code>.
            </p>
          </div>

          {/* ============================
              TYPOGRAPHY
          ============================ */}
          <section>
            <SectionHeader title="Typography" description="Inter font family \u2014 locked. Weights 400\u2013700." />
            <div className="renix-surface p-8 space-y-6">
              <SubSection title="Headings">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold text-foreground">Heading 1 \u2014 Bold 36px</h1>
                  <h2 className="text-3xl font-semibold text-foreground">Heading 2 \u2014 Semibold 30px</h2>
                  <h3 className="text-2xl font-semibold text-foreground">Heading 3 \u2014 Semibold 24px</h3>
                  <h4 className="text-xl font-semibold text-foreground">Heading 4 \u2014 Semibold 20px</h4>
                  <h5 className="text-lg font-medium text-foreground">Heading 5 \u2014 Medium 18px</h5>
                  <h6 className="text-base font-medium text-foreground">Heading 6 \u2014 Medium 16px</h6>
                </div>
              </SubSection>

              <SubSection title="Body text">
                <div className="space-y-3 max-w-2xl">
                  <p className="text-base text-foreground">Body (base) \u2014 Primary text color. Used for main content and readable paragraphs.</p>
                  <p className="text-sm text-foreground">Body small \u2014 Primary text at 14px. Labels and compact content.</p>
                  <p className="text-base text-secondary">Secondary \u2014 Used for supporting information and descriptions.</p>
                  <p className="text-sm text-muted-foreground">Muted \u2014 Least prominent. Timestamps, captions, footnotes.</p>
                </div>
              </SubSection>

              <SubSection title="Numeric display">
                <div className="flex items-baseline gap-8">
                  <span className="text-3xl font-bold text-foreground tabular-nums">$124,500.00</span>
                  <span className="text-xl font-semibold text-foreground tabular-nums">45.7%</span>
                  <span className="text-lg font-medium text-foreground tabular-nums">1,234</span>
                  <span className="text-sm text-muted-foreground tabular-nums">0.00</span>
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              COLORS
          ============================ */}
          <section>
            <SectionHeader title="Colors" description="Locked RENIX palette. Click any swatch to copy its hex value." />
            <div className="space-y-10">
              <SubSection title="Backgrounds (Cool Neutrals)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="BG 1 (White)" hex="#ffffff" darkHex="#121621" cssVar="--bg-light-1 / --bg-dark-1" className="bg-[var(--bg-light-1)] dark:bg-[var(--bg-dark-1)]" />
                  <Swatch name="BG 2 (Cool Gray)" hex="#f6f7f9" darkHex="#0b0e14" cssVar="--bg-light-2 / --bg-dark-2" className="bg-[var(--bg-light-2)] dark:bg-[var(--bg-dark-2)]" />
                  <Swatch name="BG 3 (Deepest)" hex="#eceff3" darkHex="#000000" cssVar="--bg-light-3 / --bg-dark-3" className="bg-[var(--bg-light-3)] dark:bg-[var(--bg-dark-3)]" />
                </div>
              </SubSection>

              <SubSection title="Surfaces (3-tier depth)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Surface 1" hex="#FFFFFF" darkHex="#121621" cssVar="--surface-light-1 / --surface-dark-1" className="bg-[var(--surface-light-1)] dark:bg-[var(--surface-dark-1)]" />
                  <Swatch name="Surface 2" hex="#f1f3f6" darkHex="#1a1f2e" cssVar="--surface-light-2 / --surface-dark-2" className="bg-[var(--surface-light-2)] dark:bg-[var(--surface-dark-2)]" />
                  <Swatch name="Surface 3" hex="#e8ebf0" darkHex="#242a3a" cssVar="--surface-light-3 / --surface-dark-3" className="bg-[var(--surface-light-3)] dark:bg-[var(--surface-dark-3)]" />
                </div>
              </SubSection>

              <SubSection title="Text (Crisp Slate)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Primary" hex="#0f172a" darkHex="#e5e7eb" cssVar="--text-light-primary / --text-dark-primary" className="bg-[var(--text-light-primary)] dark:bg-[var(--text-dark-primary)]" />
                  <Swatch name="Secondary" hex="#475569" darkHex="#9ca3af" cssVar="--text-light-secondary / --text-dark-secondary" className="bg-[var(--text-light-secondary)] dark:bg-[var(--text-dark-secondary)]" />
                  <Swatch name="Muted" hex="#64748b" darkHex="#6b7280" cssVar="--text-light-muted / --text-dark-muted" className="bg-[var(--text-light-muted)] dark:bg-[var(--text-dark-muted)]" />
                </div>
              </SubSection>

              <SubSection title="Borders">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Border Light" hex="rgba(15,23,42,0.10)" darkHex="rgba(229,231,235,0.10)" cssVar="--border-light / --border-dark" className="bg-[var(--border-light)] dark:bg-[var(--border-dark)]" />
                </div>
              </SubSection>

              <SubSection title="Brand Accent">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Warm Copper" hex="#B8805A" cssVar="--accent-copper" className="bg-[var(--accent-copper)]" />
                  <Swatch name="Copper Hover" hex="#A06F4C" cssVar="--accent-copper-hover" className="bg-[var(--accent-copper-hover)]" />
                </div>
              </SubSection>

              <SubSection title="Signal Colors">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Success (Emerald)" hex="#34C759" cssVar="--signal-success" className="bg-[var(--signal-success)]" />
                  <Swatch name="Warning (Amber)" hex="#FFAA33" cssVar="--signal-warning" className="bg-[var(--signal-warning)]" />
                  <Swatch name="Danger (Coral)" hex="#E8503A" cssVar="--signal-danger" className="bg-[var(--signal-danger)]" />
                  <Swatch name="Info (Steel)" hex="#5B9BD5" cssVar="--signal-info" className="bg-[var(--signal-info)]" />
                </div>
              </SubSection>

              <SubSection title="Status">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Draft" hex="#FFAA33" cssVar="--status-draft" className="bg-[var(--status-draft)]" />
                  <Swatch name="Pending" hex="#5B9BD5" cssVar="--status-pending" className="bg-[var(--status-pending)]" />
                  <Swatch name="Approved" hex="#34C759" cssVar="--status-approved" className="bg-[var(--status-approved)]" />
                  <Swatch name="Declined" hex="#E8503A" cssVar="--status-declined" className="bg-[var(--status-declined)]" />
                </div>
              </SubSection>

              <SubSection title="Status backgrounds (subtle)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Draft Subtle" hex="rgba(255,170,51,0.08)" cssVar="--status-draft-bg" className="bg-status-draft-subtle" />
                  <Swatch name="Pending Subtle" hex="rgba(91,155,213,0.08)" cssVar="--status-pending-bg" className="bg-status-pending-subtle" />
                  <Swatch name="Approved Subtle" hex="rgba(52,199,89,0.08)" cssVar="--status-approved-bg" className="bg-status-approved-subtle" />
                  <Swatch name="Declined Subtle" hex="rgba(232,80,58,0.08)" cssVar="--status-declined-bg" className="bg-status-declined-subtle" />
                </div>
              </SubSection>

              <SubSection title="RENIX chart palette (8 distinguishable)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Copper" hex="#B8805A" cssVar="--renix-copper" className="bg-[var(--renix-copper)]" />
                  <Swatch name="Emerald" hex="#34C759" cssVar="--renix-emerald" className="bg-[var(--renix-emerald)]" />
                  <Swatch name="Amber" hex="#FFAA33" cssVar="--renix-amber" className="bg-[var(--renix-amber)]" />
                  <Swatch name="Coral" hex="#E8503A" cssVar="--renix-coral" className="bg-[var(--renix-coral)]" />
                  <Swatch name="Steel" hex="#5B9BD5" cssVar="--renix-steel" className="bg-[var(--renix-steel)]" />
                  <Swatch name="Sage" hex="#7BAE7F" cssVar="--renix-sage" className="bg-[var(--renix-sage)]" />
                  <Swatch name="Clay" hex="#D4915C" cssVar="--renix-clay" className="bg-[var(--renix-clay)]" />
                  <Swatch name="Slate" hex="#8E8E93" cssVar="--renix-slate" className="bg-[var(--renix-slate)]" />
                </div>
              </SubSection>

              <SubSection title="Landing page glows">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Glow Blue" hex="rgba(0,126,255,0.12)" darkHex="rgba(0,126,255,0.18)" cssVar="--landing-glow-blue" className="bg-[var(--landing-glow-blue)]" />
                  <Swatch name="Glow Aubergine" hex="rgba(124,58,237,0.08)" darkHex="rgba(124,58,237,0.14)" cssVar="--landing-glow-aubergine" className="bg-[var(--landing-glow-aubergine)]" />
                  <Swatch name="Glow Copper" hex="rgba(184,128,90,0.05)" darkHex="rgba(184,128,90,0.06)" cssVar="--landing-glow-copper" className="bg-[var(--landing-glow-copper)]" />
                </div>
              </SubSection>

              <SubSection title="AI companion surface">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="AI Tint" hex="rgba(91,155,213,0.03)" darkHex="rgba(91,155,213,0.05)" cssVar="--ai-surface-tint" className="bg-[var(--ai-surface-tint)]" />
                </div>
              </SubSection>

              <SubSection title="Shadcn theme tokens (HSL)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Swatch name="Background" hex="hsl(0 0% 100%)" darkHex="hsl(222 27% 6%)" cssVar="--background" className="bg-background" />
                  <Swatch name="Foreground" hex="hsl(222 47% 11%)" darkHex="hsl(220 13% 91%)" cssVar="--foreground" className="bg-foreground" />
                  <Swatch name="Primary" hex="hsl(222 47% 11%)" darkHex="hsl(220 13% 91%)" cssVar="--primary" className="bg-primary" />
                  <Swatch name="Secondary" hex="hsl(220 14% 96%)" darkHex="hsl(224 23% 14%)" cssVar="--secondary" className="bg-secondary" />
                  <Swatch name="Muted" hex="hsl(220 14% 96%)" darkHex="hsl(224 23% 14%)" cssVar="--muted" className="bg-muted" />
                  <Swatch name="Accent" hex="hsl(27 40% 54%)" cssVar="--accent" className="bg-accent" />
                  <Swatch name="Destructive" hex="hsl(10 77% 55%)" cssVar="--destructive" className="bg-destructive" />
                  <Swatch name="Border" hex="hsl(220 13% 91%)" darkHex="hsl(220 13% 18%)" cssVar="--border" className="bg-border" />
                  <Swatch name="Ring" hex="hsl(27 40% 54%)" darkHex="hsl(27 40% 54%)" cssVar="--ring" className="bg-ring" />
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              SURFACES & CONTAINERS
          ============================ */}
          <section>
            <SectionHeader title="Surfaces & containers" description="Layered surface treatments \u2014 glass, solid, frame." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="renix-surface p-6">
                <p className="text-sm font-medium text-foreground mb-1">renix-surface</p>
                <p className="text-xs text-muted-foreground">Primary surface with border. Cards, panels, data containers.</p>
              </div>
              <div className="renix-surface-secondary renix-surface p-6">
                <p className="text-sm font-medium text-foreground mb-1">renix-surface-secondary</p>
                <p className="text-xs text-muted-foreground">Subtle secondary surface for nested areas.</p>
              </div>
              <div className="renix-glass p-6 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-foreground mb-1">renix-glass</p>
                <p className="text-xs text-muted-foreground">Translucent glass panel with backdrop blur.</p>
              </div>
              <div className="renix-frame">
                <p className="text-sm font-medium text-foreground mb-1">renix-frame</p>
                <p className="text-xs text-muted-foreground">Frame-level glass morphism. 16px radius, 24px padding.</p>
              </div>
              <div className="renix-surface-solid p-6 border border-border/30">
                <p className="text-sm font-medium text-foreground mb-1">renix-surface-solid</p>
                <p className="text-xs text-muted-foreground">Solid inner data surface. Never translucent.</p>
              </div>
              <div className="bg-muted/30 p-6 rounded-lg border border-border/30">
                <p className="text-sm font-medium text-foreground mb-1">bg-muted/30</p>
                <p className="text-xs text-muted-foreground">Workspace area background tint.</p>
              </div>
            </div>
          </section>

          {/* ============================
              BUTTONS
          ============================ */}
          <section>
            <SectionHeader title="Buttons" description="All button variants and sizes. Elevation on hover/active is automatic." />
            <div className="renix-surface p-8 space-y-8">
              <SubSection title="Variants">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="default" data-testid="btn-default">Default</Button>
                  <Button variant="secondary" data-testid="btn-secondary">Secondary</Button>
                  <Button variant="outline" data-testid="btn-outline">Outline</Button>
                  <Button variant="ghost" data-testid="btn-ghost">Ghost</Button>
                  <Button variant="link" data-testid="btn-link">Link</Button>
                  <Button variant="destructive" data-testid="btn-destructive">Destructive</Button>
                </div>
              </SubSection>

              <SubSection title="Sizes">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="lg" data-testid="btn-lg">Large</Button>
                  <Button size="default" data-testid="btn-md">Default</Button>
                  <Button size="sm" data-testid="btn-sm">Small</Button>
                  <Button size="icon" data-testid="btn-icon"><Plus /></Button>
                </div>
              </SubSection>

              <SubSection title="With icons">
                <div className="flex flex-wrap items-center gap-3">
                  <Button><Upload className="mr-2 h-4 w-4" /> Upload</Button>
                  <Button variant="secondary"><Download className="mr-2 h-4 w-4" /> Download</Button>
                  <Button variant="outline"><Mail className="mr-2 h-4 w-4" /> Send email</Button>
                  <Button variant="ghost"><Settings className="mr-2 h-4 w-4" /> Settings</Button>
                </div>
              </SubSection>

              <SubSection title="States">
                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled>Disabled</Button>
                  <Button disabled variant="secondary">Disabled secondary</Button>
                  <Button>
                    <RenixSpinner className="mr-2" /> Loading...
                  </Button>
                </div>
              </SubSection>

              <SubSection title="Icon buttons">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="icon" variant="ghost"><Search /></Button>
                  <Button size="icon" variant="ghost"><Settings /></Button>
                  <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                  <Button size="icon" variant="ghost"><Copy /></Button>
                  <Button size="icon" variant="ghost"><Heart /></Button>
                  <Button size="icon" variant="outline"><Edit /></Button>
                  <Button size="icon" variant="destructive"><Trash2 /></Button>
                </div>
              </SubSection>

              <SubSection title="Custom CSS classes">
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn-primary rounded-lg px-4 py-2 font-medium text-sm">btn-primary</button>
                  <button className="btn-secondary rounded-lg px-4 py-2 text-sm">btn-secondary</button>
                  <button className="btn-danger rounded-lg px-4 py-2 font-medium text-sm">btn-danger</button>
                  <button className="btn-ghost rounded-lg px-4 py-2 text-sm">btn-ghost</button>
                  <button className="btn-link text-sm">btn-link</button>
                  <button className="btn-disabled btn-primary rounded-lg px-4 py-2 font-medium text-sm">btn-disabled</button>
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              BADGES & PILLS
          ============================ */}
          <section>
            <SectionHeader title="Badges & pills" description="Status indicators, labels, and tags." />
            <div className="renix-surface p-8 space-y-8">
              <SubSection title="Status badges">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="draft" data-testid="badge-draft">Draft</Badge>
                  <Badge variant="pending" data-testid="badge-pending">Pending</Badge>
                  <Badge variant="approved" data-testid="badge-approved">Approved</Badge>
                  <Badge variant="declined" data-testid="badge-declined">Declined</Badge>
                </div>
              </SubSection>

              <SubSection title="Other variants">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>
              </SubSection>

              <SubSection title="Custom CSS pills">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="pill pill-draft">Draft</span>
                  <span className="pill pill-pending">Pending</span>
                  <span className="pill pill-approved">Approved</span>
                  <span className="pill pill-declined">Declined</span>
                </div>
              </SubSection>

              <SubSection title="Status backgrounds (subtle)">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-status-draft-subtle text-foreground">Draft subtle</span>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-status-pending-subtle text-foreground">Pending subtle</span>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-status-approved-subtle text-foreground">Approved subtle</span>
                  <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-status-declined-subtle text-foreground">Declined subtle</span>
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              FORM INPUTS
          ============================ */}
          <section>
            <SectionHeader title="Form inputs" description="Text inputs, selects, checkboxes, switches, sliders." />
            <div className="renix-surface p-8 space-y-8">
              <SubSection title="Text inputs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
                  <div className="space-y-2">
                    <Label htmlFor="demo-input">Label</Label>
                    <Input id="demo-input" placeholder="Placeholder text" data-testid="input-demo" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-input-value">With value</Label>
                    <Input id="demo-input-value" defaultValue="Kitchen renovation" data-testid="input-demo-value" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-input-disabled">Disabled</Label>
                    <Input id="demo-input-disabled" placeholder="Cannot edit" disabled data-testid="input-demo-disabled" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-input-search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="demo-input-search" placeholder="Search..." className="pl-10" data-testid="input-demo-search" />
                    </div>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Textarea">
                <div className="max-w-lg space-y-2">
                  <Label htmlFor="demo-textarea">Description</Label>
                  <Textarea id="demo-textarea" placeholder="Enter a description..." data-testid="input-demo-textarea" />
                </div>
              </SubSection>

              <SubSection title="Select">
                <div className="max-w-xs space-y-2">
                  <Label>Project type</Label>
                  <Select defaultValue="renovation">
                    <SelectTrigger data-testid="select-demo">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="renovation">Renovation</SelectItem>
                      <SelectItem value="new-build">New Build</SelectItem>
                      <SelectItem value="extension">Extension</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SubSection>

              <SubSection title="Checkbox & Switch">
                <div className="flex flex-wrap items-center gap-8">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="demo-checkbox"
                      checked={checkboxChecked}
                      onCheckedChange={(v) => setCheckboxChecked(v === true)}
                      data-testid="checkbox-demo"
                    />
                    <Label htmlFor="demo-checkbox">Checkbox</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="demo-switch"
                      checked={switchChecked}
                      onCheckedChange={setSwitchChecked}
                      data-testid="switch-demo"
                    />
                    <Label htmlFor="demo-switch">Switch</Label>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Slider">
                <div className="max-w-sm">
                  <Slider
                    value={sliderValue}
                    onValueChange={setSliderValue}
                    max={100}
                    step={1}
                    data-testid="slider-demo"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Value: {sliderValue[0]}</p>
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              CARDS
          ============================ */}
          <section>
            <SectionHeader title="Cards" description="Card component with header, content, footer variants." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Simple card</CardTitle>
                  <CardDescription>A basic card with title and description.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">Card body content goes here. This uses the renix-surface treatment.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Card with footer</CardTitle>
                  <CardDescription>Includes action buttons.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">Some content that describes the card purpose.</p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm">Save</Button>
                  <Button size="sm" variant="ghost">Cancel</Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Card with badge</CardTitle>
                    <Badge variant="approved">Active</Badge>
                  </div>
                  <CardDescription>Status indicator in header.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Budget</span>
                      <span className="font-medium text-foreground tabular-nums">$85,000</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-medium text-foreground tabular-nums">$42,300</span>
                    </div>
                    <Progress value={50} className="h-2 rounded-full mt-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* ============================
              PROGRESS
          ============================ */}
          <section>
            <SectionHeader title="Progress" description="Linear progress bars at different values and styles." />
            <div className="renix-surface p-8 space-y-6 max-w-2xl">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Default</span>
                  <span className="text-foreground font-medium tabular-nums">{progressValue}%</span>
                </div>
                <Progress value={progressValue} className="h-2 rounded-full" />
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Empty</span>
                <Progress value={0} className="h-2 rounded-full" />
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Complete</span>
                <Progress value={100} className="h-2 rounded-full" />
              </div>
              <div className="space-y-2">
                <span className="text-sm text-muted-foreground">Thin</span>
                <Progress value={40} className="h-1 rounded-full" />
              </div>
              <div className="mt-4">
                <Slider
                  value={[progressValue]}
                  onValueChange={(v) => setProgressValue(v[0])}
                  max={100}
                  step={1}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">Drag to change progress value</p>
              </div>
            </div>
          </section>

          {/* ============================
              TABS
          ============================ */}
          <section>
            <SectionHeader title="Tabs" description="Tab navigation with content panels." />
            <div className="renix-surface p-8">
              <Tabs defaultValue="tab1" className="max-w-lg">
                <TabsList>
                  <TabsTrigger value="tab1" data-testid="tab-1">Overview</TabsTrigger>
                  <TabsTrigger value="tab2" data-testid="tab-2">Details</TabsTrigger>
                  <TabsTrigger value="tab3" data-testid="tab-3">Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="tab1" className="mt-4">
                  <p className="text-sm text-foreground">Overview tab content. This shows the primary view.</p>
                </TabsContent>
                <TabsContent value="tab2" className="mt-4">
                  <p className="text-sm text-foreground">Detail information would appear here.</p>
                </TabsContent>
                <TabsContent value="tab3" className="mt-4">
                  <p className="text-sm text-foreground">Activity log and recent changes.</p>
                </TabsContent>
              </Tabs>
            </div>
          </section>

          {/* ============================
              TABLES
          ============================ */}
          <section>
            <SectionHeader title="Tables" description="Data table using renix-table class." />
            <div className="renix-surface p-8">
              <div className="renix-scroll-x">
                <table className="renix-table">
                  <thead>
                    <tr>
                      <th className="pb-3 pr-6">Scope</th>
                      <th className="pb-3 pr-6">Vendor</th>
                      <th className="pb-3 pr-6 text-right">Amount</th>
                      <th className="pb-3 pr-6">Status</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="pr-6 text-sm text-foreground">Kitchen</td>
                      <td className="pr-6 text-sm text-foreground">Acme Builders</td>
                      <td className="pr-6 text-sm text-foreground text-right tabular-nums">$24,500.00</td>
                      <td className="pr-6"><Badge variant="approved">Approved</Badge></td>
                      <td>
                        <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-6 text-sm text-foreground">Bathroom</td>
                      <td className="pr-6 text-sm text-foreground">ProTile Co</td>
                      <td className="pr-6 text-sm text-foreground text-right tabular-nums">$12,800.00</td>
                      <td className="pr-6"><Badge variant="pending">Pending</Badge></td>
                      <td>
                        <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-6 text-sm text-foreground">Electrical</td>
                      <td className="pr-6 text-sm text-foreground">Spark Electric</td>
                      <td className="pr-6 text-sm text-foreground text-right tabular-nums">$8,200.00</td>
                      <td className="pr-6"><Badge variant="draft">Draft</Badge></td>
                      <td>
                        <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-6 text-sm text-foreground">Plumbing</td>
                      <td className="pr-6 text-sm text-foreground">FlowRight</td>
                      <td className="pr-6 text-sm text-foreground text-right tabular-nums">$6,750.00</td>
                      <td className="pr-6"><Badge variant="declined">Declined</Badge></td>
                      <td>
                        <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ============================
              DIALOGS & OVERLAYS
          ============================ */}
          <section>
            <SectionHeader title="Dialogs & overlays" description="Modal dialogs, dropdown menus, tooltips." />
            <div className="renix-surface p-8 space-y-8">
              <SubSection title="Dialog">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button data-testid="btn-open-dialog">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Example dialog</DialogTitle>
                      <DialogDescription>
                        This is a modal dialog with a title, description, and action buttons.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="space-y-2">
                        <Label htmlFor="dialog-input">Name</Label>
                        <Input id="dialog-input" placeholder="Enter a name" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost">Cancel</Button>
                      <Button>Confirm</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </SubSection>

              <SubSection title="Dropdown menu">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" data-testid="btn-dropdown">
                      Actions <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                    <DropdownMenuItem><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                    <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SubSection>

              <SubSection title="Tooltips">
                <div className="flex flex-wrap items-center gap-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">Hover me (top)</Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Tooltip on top</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm">Hover me (bottom)</Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost"><AlertCircle /></Button>
                    </TooltipTrigger>
                    <TooltipContent>More information</TooltipContent>
                  </Tooltip>
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              SEPARATORS
          ============================ */}
          <section>
            <SectionHeader title="Separators" description="Horizontal and vertical dividers." />
            <div className="renix-surface p-8 space-y-6">
              <div>
                <p className="text-sm text-muted-foreground mb-3">Horizontal</p>
                <Separator />
              </div>
              <div className="flex items-center gap-4 h-8">
                <span className="text-sm text-foreground">Item A</span>
                <Separator orientation="vertical" />
                <span className="text-sm text-foreground">Item B</span>
                <Separator orientation="vertical" />
                <span className="text-sm text-foreground">Item C</span>
              </div>
            </div>
          </section>

          {/* ============================
              BORDERS & RADIUS
          ============================ */}
          <section>
            <SectionHeader title="Borders & radius" description="Border radius tokens and border treatments." />
            <div className="renix-surface p-8">
              <SubSection title="Border radius scale">
                <div className="flex flex-wrap items-end gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted border border-border rounded-sm" />
                    <span className="text-[10px] text-muted-foreground mt-1 block">sm (6px)</span>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted border border-border rounded" />
                    <span className="text-[10px] text-muted-foreground mt-1 block">default (10px)</span>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted border border-border rounded-lg" />
                    <span className="text-[10px] text-muted-foreground mt-1 block">lg (14px)</span>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted border border-border rounded-xl" />
                    <span className="text-[10px] text-muted-foreground mt-1 block">xl (18px)</span>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-muted border border-border rounded-full" />
                    <span className="text-[10px] text-muted-foreground mt-1 block">full</span>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Shadows">
                <div className="flex flex-wrap items-end gap-8 mt-4">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-background rounded-lg shadow-subtle" />
                    <span className="text-[10px] text-muted-foreground mt-2 block">shadow-subtle</span>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 bg-background rounded-lg shadow-soft" />
                    <span className="text-[10px] text-muted-foreground mt-2 block">shadow-soft</span>
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 bg-background rounded-lg shadow-sm" />
                    <span className="text-[10px] text-muted-foreground mt-2 block">shadow-sm</span>
                  </div>
                </div>
              </SubSection>
            </div>
          </section>

          {/* ============================
              SPACING RHYTHM
          ============================ */}
          <section>
            <SectionHeader title="Spacing rhythm" description="Common spacing values used across the app." />
            <div className="renix-surface p-8">
              <div className="space-y-3">
                {[1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24].map((val) => (
                  <div key={val} className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">{val * 4}px</span>
                    <div
                      className="h-3 bg-accent-copper/30 rounded-sm"
                      style={{ width: val * 4 }}
                    />
                    <span className="text-xs text-muted-foreground">p-{val} / gap-{val} / m-{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================
              COMPOSITE PATTERNS
          ============================ */}
          <section>
            <SectionHeader title="Composite patterns" description="Common UI patterns composed from base elements." />
            <div className="space-y-8">

              <SubSection title="KPI tile row">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total budget', value: '$125,000', change: '+2.3%', positive: true },
                    { label: 'Allocated', value: '$98,500', change: '78.8%', positive: true },
                    { label: 'Quoted', value: '$87,200', change: '3 pending', positive: false },
                    { label: 'Invoiced', value: '$42,300', change: '33.8%', positive: true },
                  ].map((kpi) => (
                    <Card key={kpi.label}>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                        <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{kpi.value}</p>
                        <p className={cn(
                          "text-xs mt-1 font-medium",
                          kpi.positive ? "text-status-approved" : "text-muted-foreground"
                        )}>
                          {kpi.change}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </SubSection>

              <SubSection title="List item with actions">
                <Card>
                  <div className="divide-y divide-border">
                    {[
                      { name: 'Kitchen renovation', status: 'approved' as const, amount: '$24,500' },
                      { name: 'Bathroom remodel', status: 'pending' as const, amount: '$12,800' },
                      { name: 'Roof repair', status: 'draft' as const, amount: '$8,200' },
                    ].map((item) => (
                      <div key={item.name} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-foreground tabular-nums">{item.amount}</span>
                          <Badge variant={item.status}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Badge>
                          <Button size="icon" variant="ghost"><MoreHorizontal /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </SubSection>

              <SubSection title="Empty state">
                <Card>
                  <CardContent className="py-16 flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No documents yet</p>
                    <p className="text-xs text-muted-foreground mb-4">Upload a document to get started.</p>
                    <Button size="sm"><Upload className="mr-2 h-4 w-4" /> Upload document</Button>
                  </CardContent>
                </Card>
              </SubSection>

              <SubSection title="Inline alert / notice">
                <div className="space-y-3 max-w-lg">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-status-pending-subtle border border-status-pending/20">
                    <AlertCircle className="h-4 w-4 text-status-pending mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Pending review</p>
                      <p className="text-xs text-muted-foreground mt-0.5">This quote is awaiting your approval.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-status-approved-subtle border border-status-approved/20">
                    <Check className="h-4 w-4 text-status-approved mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Budget on track</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Spending is within the allocated budget.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-status-declined-subtle border border-status-declined/20">
                    <X className="h-4 w-4 text-status-declined mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Over budget</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Total quotes exceed the allocated amount by $3,200.</p>
                    </div>
                  </div>
                </div>
              </SubSection>

            </div>
          </section>

          {/* ============================
              LOADING & SKELETON
          ============================ */}
          <section>
            <SectionHeader title="Loading states" description="Spinners, skeleton loaders, and progress indicators." />
            <div className="renix-surface p-8 space-y-8">
              <SubSection title="RENIX Loader — Pulsating Logo">
                <p className="text-sm text-muted-foreground mb-4">
                  Branded loading animation using the canonical RENIX logo. The logo gently pulses to indicate activity. The original logo shape is preserved exactly as provided — no SVG approximations.
                </p>
                <div className="space-y-6">
                  <div className="flex items-end gap-10">
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="xs" />
                      <span className="text-xs text-muted-foreground">XS / Inline (14px)</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="sm" />
                      <span className="text-xs text-muted-foreground">Small (20px)</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="md" />
                      <span className="text-xs text-muted-foreground">Medium (32px)</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="lg" />
                      <span className="text-xs text-muted-foreground">Large (48px)</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="lg" showLabel />
                      <span className="text-xs text-muted-foreground">Large + label</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="xl" showLabel />
                      <span className="text-xs text-muted-foreground">XL + label (64px)</span>
                    </div>
                  </div>

                  <div className="dark rounded-lg bg-[#121621] p-6 flex items-end gap-10 text-[#e5e7eb]">
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="xs" />
                      <span className="text-xs text-gray-400">Dark xs</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="sm" />
                      <span className="text-xs text-gray-400">Dark sm</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="md" />
                      <span className="text-xs text-gray-400">Dark md</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="lg" />
                      <span className="text-xs text-gray-400">Dark lg</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <RenixLoader size="xl" showLabel />
                      <span className="text-xs text-gray-400">Dark xl + label</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Button disabled>
                      <RenixSpinner className="mr-2" />
                      Processing...
                    </Button>
                    <Button variant="outline" disabled>
                      <RenixSpinner className="mr-2" />
                      Uploading...
                    </Button>
                  </div>
                </div>
              </SubSection>


              <SubSection title="Skeleton cards">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-4 space-y-3">
                        <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
                        <div className="h-2 w-full bg-muted rounded animate-pulse" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Skeleton list">
                <Card>
                  <div className="divide-y divide-border">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-40 bg-muted rounded animate-pulse" />
                        <div className="flex-1" />
                        <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                        <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                      </div>
                    ))}
                  </div>
                </Card>
              </SubSection>
            </div>
          </section>

          <div className="h-16" />
        </div>
      </div>
    </div>
  );
}
