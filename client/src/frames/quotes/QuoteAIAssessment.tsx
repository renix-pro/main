import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';

interface QuoteAIAssessmentProps {
  projectId: string;
  quoteId: string;
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function QuoteAIAssessment({ projectId, quoteId }: QuoteAIAssessmentProps) {
  const { data, isLoading, isError } = useQuery<{ assessment: string; cached: boolean; generatedAt: string }>({
    queryKey: ['api', 'projects', projectId, 'quotes', quoteId, 'assessment'],
    enabled: !!projectId && !!quoteId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isError) return null;

  if (isLoading) {
    return (
      <div className="flex items-start gap-2" data-testid="quote-ai-assessment">
        <div className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 rounded bg-muted animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
          <div className="h-3 w-3/5 rounded bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data?.assessment) return null;

  return (
    <div
      className="flex items-start gap-2 text-xs text-muted-foreground"
      data-testid="quote-ai-assessment"
    >
      <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
      <span
        data-testid="text-assessment-content"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(data.assessment) }}
      />
    </div>
  );
}
