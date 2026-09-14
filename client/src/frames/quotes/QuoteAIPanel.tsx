import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import { RenixSpinner } from '@/components/RenixLoader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Quote, QuoteVersion } from './useQuotesData';
import type { ExtractedQuote } from './QuoteWorkspaceTypes';

interface QuoteAIPanelProps {
  projectId: string;
  quote: Quote;
  selectedVersion: QuoteVersion | undefined;
  extractedData: ExtractedQuote | null;
  vendorName: string;
  formatCurrency: (amount: number) => string;
  onClose: () => void;
}

const PROMPT_CHIPS = [
  { label: 'What is missing?', question: 'What items or scope elements appear to be missing from this quote compared to what would typically be expected?' },
  { label: 'Why more expensive?', question: 'Why might this quote be more expensive than expected? Analyze the pricing of the line items.' },
  { label: 'Summarize key risks', question: 'What are the key risks or concerns in the terms and pricing of this quote?' },
  { label: 'Coverage gaps', question: 'Are there any coverage gaps? Check if all expected scope items are addressed by the line items in this quote.' },
];

export function QuoteAIPanel({
  projectId,
  quote,
  selectedVersion,
  extractedData,
  vendorName,
  formatCurrency,
  onClose,
}: QuoteAIPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollTop = 0;
    }
  }, [response]);

  const buildContextMessage = useCallback((userQuestion: string): string => {
    const version = selectedVersion;
    const versionLabel = version ? `v${version.versionNumber}` : '';
    const totalLabel = version ? formatCurrency(version.total) : 'N/A';

    let lineItemsSummary = 'No line items available.';
    if (extractedData?.lineItems && extractedData.lineItems.length > 0) {
      const items = extractedData.lineItems.slice(0, 10);
      lineItemsSummary = items
        .map(item => {
          const amt = item.amount !== undefined ? ` — ${formatCurrency(item.amount)}` : '';
          return `- ${item.description}${amt}`;
        })
        .join('\n');
      if (extractedData.lineItems.length > 10) {
        lineItemsSummary += `\n... and ${extractedData.lineItems.length - 10} more items`;
      }
    }

    return `[Quote Context: ${vendorName} — ${quote.description || 'Untitled'} ${versionLabel}, Total: ${totalLabel}]
[Line Items:
${lineItemsSummary}]

User question: ${userQuestion}

Instructions: Only reference data from the extracted quote. Do not make recommendations or suggest actions. Focus on factual analysis.`;
  }, [selectedVersion, extractedData, vendorName, quote.description, formatCurrency]);

  const handleSend = useCallback(async (questionText: string) => {
    if (!questionText.trim() || isLoading) return;

    const contextMessage = buildContextMessage(questionText.trim());
    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/ai/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          message: contextMessage,
          activeFrame: 'Quotes',
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.statusText}`);
      }

      const data = await res.json();
      setResponse(data.content || data.response || 'No response received.');
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : 'Failed to get AI response.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, buildContextMessage, projectId]);

  const handleChipClick = useCallback((chipQuestion: string) => {
    setQuestion('');
    handleSend(chipQuestion);
  }, [handleSend]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) {
      handleSend(question);
      setQuestion('');
    }
  }, [question, handleSend]);

  return (
    <Card
      className="border-t border-subtle bg-background flex flex-col"
      style={{ height: '300px', flexShrink: 0 }}
      data-testid="panel-quote-ai"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-subtle">
        <span className="text-sm font-medium" data-testid="text-ai-panel-title">Ask AI about this quote</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-ai-panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="px-4 py-2 flex flex-wrap gap-2">
        {PROMPT_CHIPS.map((chip) => (
          <Badge
            key={chip.label}
            variant="outline"
            className="cursor-pointer hover-elevate border-subtle text-xs"
            onClick={() => handleChipClick(chip.question)}
            data-testid={`chip-${chip.label.toLowerCase().replace(/\s+/g, '-').replace(/\?/g, '')}`}
          >
            {chip.label}
          </Badge>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-2 flex items-center gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this quote..."
          disabled={isLoading}
          className="flex-1"
          data-testid="input-ai-question"
        />
        <Button
          type="submit"
          size="icon"
          disabled={isLoading || !question.trim()}
          data-testid="button-send-ai-question"
        >
          {isLoading ? <RenixSpinner /> : <Send className="w-4 h-4" />}
        </Button>
      </form>

      <div
        ref={responseRef}
        className="flex-1 overflow-auto px-4 py-2"
        data-testid="area-ai-response"
      >
        {isLoading && !response && (
          <div className="flex items-center gap-2 text-sm text-muted" data-testid="ai-loading-indicator">
            <RenixSpinner />
            <span>Analysing quote...</span>
          </div>
        )}
        {response && (
          <div className="text-sm whitespace-pre-wrap" data-testid="text-ai-response">
            {response}
          </div>
        )}
        {!isLoading && !response && (
          <p className="text-sm text-muted italic" data-testid="text-ai-placeholder">
            Select a prompt above or type your own question to analyse this quote.
          </p>
        )}
      </div>
    </Card>
  );
}
