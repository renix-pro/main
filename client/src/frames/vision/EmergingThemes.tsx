import { Lightbulb, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RenixSpinner } from '@/components/RenixLoader';

interface EmergingThemesProps {
  themes: string[];
  isGenerating?: boolean;
}

function buildSynthesis(themes: string[]): string {
  if (themes.length === 1) return `Your vision centers around ${themes[0].toLowerCase()}.`;
  if (themes.length === 2)
    return `Your vision blends ${themes[0].toLowerCase()} with ${themes[1].toLowerCase()}.`;
  const leading = themes.slice(0, -1).map(t => t.toLowerCase()).join(', ');
  const last = themes[themes.length - 1].toLowerCase();
  return `Your vision weaves together ${leading}, and ${last}.`;
}

export function EmergingThemes({ themes, isGenerating }: EmergingThemesProps) {
  if (themes.length === 0) {
    return (
      <div className="space-y-3" data-testid="section-emerging-themes-empty">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60">Emerging Themes</h3>
        </div>
        {isGenerating ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-emerging-themes-generating">
            <RenixSpinner />
            <span>Analyzing your inspirations...</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic" data-testid="text-emerging-themes-prompt">
            Add inspirations to discover emerging themes
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="section-emerging-themes">
      <div className="flex items-center gap-2">
        <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60">Emerging Themes</h3>
        {isGenerating ? (
          <RenixSpinner className="ml-auto" data-testid="icon-themes-refreshing" />
        ) : (
          <Badge variant="secondary" className="ml-auto" data-testid="badge-theme-count">
            {themes.length}
          </Badge>
        )}
      </div>

      <div className="flex items-start gap-2 text-sm text-secondary leading-relaxed" data-testid="text-theme-synthesis">
        <Sparkles className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <span>{buildSynthesis(themes)}</span>
      </div>

      <ul className="space-y-2" data-testid="list-emerging-themes">
        {themes.map((theme, i) => (
          <li key={i} className="text-sm flex items-start gap-2.5 text-secondary leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/25 mt-[7px] shrink-0" />
            <span data-testid={`text-theme-${i}`}>{theme}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
