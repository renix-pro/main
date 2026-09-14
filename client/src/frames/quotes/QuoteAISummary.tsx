import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import type { ExtractedQuote, NativeExtraction } from './QuoteWorkspaceTypes';

interface QuoteAISummaryProps {
  extractedData: ExtractedQuote | null;
  nativeData: NativeExtraction | null;
}

export function QuoteAISummary({ extractedData, nativeData }: QuoteAISummaryProps) {
  const summary = useMemo(() => {
    if (!extractedData && !nativeData) return null;

    const lineItems = extractedData?.lineItems || [];
    const nativeRows = nativeData?.nativeRows?.filter(r => r.rowType === 'line_item') || [];
    const itemCount = lineItems.length || nativeRows.length;

    if (itemCount === 0) return null;

    return `Covers ${itemCount} line item${itemCount !== 1 ? 's' : ''}.`;
  }, [extractedData, nativeData]);

  if (!summary) return null;

  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      data-testid="quote-ai-summary"
    >
      <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
      <span data-testid="text-summary-content">{summary}</span>
    </div>
  );
}
