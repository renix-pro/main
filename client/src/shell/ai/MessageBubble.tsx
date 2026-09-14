import { CheckCircle2, FileText, Lightbulb, HelpCircle, AlertCircle } from 'lucide-react';
import { RenixSpinner } from '@/components/RenixLoader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RichTextContent } from './RichTextContent';
import { DynamicAssistOptions, SuggestionButtons } from './SuggestedActions';
import { ProposalActivityBadge, IngestionSuccessCard, DocumentClassificationCard, PreConfirmSummaryCard } from './MessageCards';
import { AIAvatar } from './AIAvatar';
import { StructuredCard } from './StructuredCards';
import type { Message, AssistOption } from './types';

interface MessageBubbleProps {
  message: Message;
  isLastAssistantMessage: boolean;
  projectId?: string;
  onSendMessage: (message: string) => void;
  onNavigate: (path: string) => void;
  onDismissAssistOptions: (messageId: string) => void;
  onConfirmQuote?: (quoteData: { documentId: string; scopeId: string; scopeName?: string; objectPath?: string; forceReplace?: boolean }) => void;
  onConfirmQuoteVersion?: (data: { documentId: string; existingQuoteId: string; objectPath?: string }) => void;
  onConfirmInvoice?: (invoiceData: { documentId: string; objectPath?: string; scopeId?: string; scopeName?: string; forceReplace?: boolean }) => void;
  onCancelIngestion?: (data: { documentId: string }) => void;
  onRetryExtraction?: (data: { documentId: string }) => void;
}

type SpecialState = 'success' | 'error' | 'document' | 'proposal' | 'explore' | null;

function getSpecialState(message: Message): SpecialState {
  if (message.ingestionSuccess) return 'success';
  if (message.responseType === 'error') return 'error';
  if (message.classificationData || message.preConfirmData) return 'document';
  if (message.hasProposal) return 'proposal';
  if (message.responseType === 'explore' || message.responseType === 'needs_evidence') return 'explore';
  return null;
}

function SpecialStateOverlay({ state }: { state: SpecialState }) {
  if (!state) return null;

  const config: Record<NonNullable<SpecialState>, { Icon: typeof CheckCircle2; bg: string; fg: string }> = {
    success: { Icon: CheckCircle2, bg: 'bg-status-approved', fg: 'text-white' },
    error: { Icon: AlertCircle, bg: 'bg-destructive', fg: 'text-white' },
    document: { Icon: FileText, bg: 'bg-foreground/60', fg: 'text-background' },
    proposal: { Icon: Lightbulb, bg: 'bg-foreground/60', fg: 'text-background' },
    explore: { Icon: HelpCircle, bg: 'bg-foreground/60', fg: 'text-background' },
  };

  const { Icon, bg, fg } = config[state];

  return (
    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${bg} flex items-center justify-center ring-1 ring-background`}>
      <Icon className={`w-2 h-2 ${fg}`} />
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { className: 'bg-[var(--accent-copper)]', tooltip: 'High confidence' },
    medium: { className: 'bg-[var(--accent-copper)]/50', tooltip: 'Medium confidence' },
    low: { className: 'border border-[var(--accent-copper)]/60 bg-transparent', tooltip: 'Based on assumptions' },
  };

  const { className, tooltip } = config[level];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${className}`}
          data-testid={`confidence-badge-${level}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function MessageBubble({
  message,
  isLastAssistantMessage,
  projectId,
  onSendMessage,
  onNavigate,
  onDismissAssistOptions,
  onConfirmQuote,
  onConfirmQuoteVersion,
  onConfirmInvoice,
  onCancelIngestion,
  onRetryExtraction,
}: MessageBubbleProps) {
  if (message.role === 'assistant') {
    const specialState = getSpecialState(message);

    return (
      <div className="space-y-2" data-testid={`assistant-bubble-${message.id}`}>
        <div className="flex items-start gap-2.5">
          <div className="relative flex-shrink-0 mt-0.5">
            <AIAvatar size="sm" />
            <SpecialStateOverlay state={specialState} />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden space-y-2">
            <div className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                {message.content?.trim() && <RichTextContent content={message.content} />}
              </div>
              {message.confidence && (
                <div className="pt-1 shrink-0">
                  <ConfidenceBadge level={message.confidence} />
                </div>
              )}
            </div>
            {message.structuredData && (
              <StructuredCard
                data={message.structuredData}
                onSendMessage={onSendMessage}
                onNavigate={onNavigate}
              />
            )}
            {message.ingestionSuccess && (
              <IngestionSuccessCard {...message.ingestionSuccess} projectId={projectId} onNavigate={onNavigate} />
            )}
            {message.classificationData && (
              <DocumentClassificationCard {...message.classificationData} />
            )}
            {message.preConfirmData && (
              <PreConfirmSummaryCard {...message.preConfirmData} />
            )}
            {message.sessionOrientation && (
              <div className="text-xs text-muted-foreground italic">
                {message.sessionOrientation}
              </div>
            )}
            {message.hasProposal && message.affectedFrames && (
              <ProposalActivityBadge frames={message.affectedFrames} />
            )}
            {message.assistOptions && message.assistOptions.length > 0 && isLastAssistantMessage && (
              <DynamicAssistOptions
                options={message.assistOptions}
                attentionDetail={message.attentionDetail}
                onSendMessage={onSendMessage}
                onNavigate={(frame) => {
                  if (projectId) {
                    onNavigate(`/project/${projectId}/${frame.toLowerCase()}`);
                  }
                }}
                onDismiss={() => onDismissAssistOptions(message.id)}
                onConfirmQuote={onConfirmQuote}
                onConfirmQuoteVersion={onConfirmQuoteVersion}
                onConfirmInvoice={onConfirmInvoice}
                onCancelIngestion={onCancelIngestion}
                onRetryExtraction={onRetryExtraction}
              />
            )}
            {message.suggestedActions && message.suggestedActions.length > 0 && (
              <SuggestionButtons 
                suggestions={message.suggestedActions}
                onSelect={onSendMessage}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
  
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="p-2.5 border border-border/30 overflow-hidden bg-[#496580] text-white max-w-[85%] w-fit font-light text-sm leading-relaxed" style={{ borderRadius: 'var(--radius)' }}>
          <p className="whitespace-pre-wrap break-words text-xs">{message.content}</p>
        </div>
      </div>
    );
  }
  
  if (message.role === 'system') {
    return (
      <div className="text-xs text-muted-foreground px-2 overflow-hidden">
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    );
  }
  
  return null;
}

export function LoadingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-6 h-6 rounded-full bg-foreground/8 flex items-center justify-center flex-shrink-0 mt-0.5">
        <RenixSpinner />
      </div>
      <div className="text-sm text-muted-foreground py-0.5">Thinking...</div>
    </div>
  );
}
