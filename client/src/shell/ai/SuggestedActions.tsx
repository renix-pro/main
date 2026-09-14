/**
 * RENIX vNext — Suggested Actions Components
 * 
 * Components for rendering dynamic assist options and legacy suggestion buttons.
 */

import { Button } from '@/components/ui/button';
import { FramePill } from './RichTextContent';
import { VersionChoiceCard } from './MessageCards';
import type { AssistOption } from './types';

interface DynamicAssistOptionsProps {
  options: AssistOption[];
  attentionDetail?: { what: string; where: string };
  onSendMessage: (message: string) => void;
  onNavigate: (frame: string) => void;
  onDismiss: () => void;
  onConfirmQuote?: (quoteData: { documentId: string; scopeId: string; scopeName?: string; objectPath?: string; forceReplace?: boolean }) => void;
  onConfirmQuoteVersion?: (data: { documentId: string; existingQuoteId: string; objectPath?: string }) => void;
  onConfirmInvoice?: (invoiceData: { documentId: string; objectPath?: string; scopeId?: string; scopeName?: string; forceReplace?: boolean; extractedData?: any }) => void;
  onCancelIngestion?: (data: { documentId: string }) => void;
  onRetryExtraction?: (data: { documentId: string }) => void;
}

export function DynamicAssistOptions({ 
  options,
  attentionDetail,
  onSendMessage,
  onNavigate,
  onDismiss,
  onConfirmQuote,
  onConfirmQuoteVersion,
  onConfirmInvoice,
  onCancelIngestion,
  onRetryExtraction,
}: DynamicAssistOptionsProps) {
  if (!options || options.length === 0) return null;
  
  const handleOption = (option: AssistOption) => {
    switch (option.action) {
      case 'send_message':
        if (option.payload) onSendMessage(option.payload);
        onDismiss();
        break;
      case 'navigate':
        if (option.payload) onNavigate(option.payload);
        onDismiss();
        break;
      case 'confirm_quote':
        console.log('[AssistOptions] confirm_quote clicked, quoteData:', option.quoteData);
        if (option.quoteData && onConfirmQuote) {
          onConfirmQuote(option.quoteData);
        } else {
          console.error('[AssistOptions] Missing quoteData or onConfirmQuote handler');
        }
        onDismiss();
        break;
      case 'confirm_quote_version':
        console.log('[AssistOptions] confirm_quote_version clicked, quoteVersionData:', option.quoteVersionData);
        if (option.quoteVersionData && onConfirmQuoteVersion) {
          onConfirmQuoteVersion(option.quoteVersionData);
        } else {
          console.error('[AssistOptions] Missing quoteVersionData or onConfirmQuoteVersion handler');
        }
        onDismiss();
        break;
      case 'confirm_invoice':
        console.log('[AssistOptions] confirm_invoice clicked, invoiceData:', option.invoiceData);
        if (option.invoiceData && onConfirmInvoice) {
          onConfirmInvoice(option.invoiceData);
        } else {
          console.error('[AssistOptions] Missing invoiceData or onConfirmInvoice handler');
        }
        onDismiss();
        break;
      case 'cancel_ingestion':
        console.log('[AssistOptions] cancel_ingestion clicked, ingestionData:', option.ingestionData);
        if (option.ingestionData && onCancelIngestion) {
          onCancelIngestion(option.ingestionData);
        } else {
          console.error('[AssistOptions] Missing ingestionData or onCancelIngestion handler');
        }
        onDismiss();
        break;
      case 'retry_extraction':
        if (option.retryData && onRetryExtraction) {
          onRetryExtraction(option.retryData);
        }
        onDismiss();
        break;
      case 'dismiss':
        onDismiss();
        break;
    }
  };
  
  const versionChoiceOption = options.find(
    (opt) => opt.action === 'confirm_quote' && opt.quoteData?.existingQuoteCandidates && opt.quoteData.existingQuoteCandidates.length > 0
  );

  const remainingOptions = versionChoiceOption
    ? options.filter((opt) => opt !== versionChoiceOption)
    : options;

  return (
    <div className="space-y-2 mt-3">
      {attentionDetail && (
        <div className="text-xs text-muted-foreground mb-2">
          <span className="font-medium">{attentionDetail.what}</span>
          {attentionDetail.where && (
            <span> in <FramePill name={attentionDetail.where} /></span>
          )}
        </div>
      )}
      {versionChoiceOption && versionChoiceOption.quoteData && (
        <VersionChoiceCard
          candidates={versionChoiceOption.quoteData.existingQuoteCandidates!}
          documentId={versionChoiceOption.quoteData.documentId}
          scopeId={versionChoiceOption.quoteData.scopeId}
          scopeName={versionChoiceOption.quoteData.scopeName || ''}
          objectPath={versionChoiceOption.quoteData.objectPath}
          onConfirmNewQuote={(quoteData) => {
            if (onConfirmQuote) onConfirmQuote(quoteData);
            onDismiss();
          }}
          onConfirmNewVersion={(data) => {
            if (onConfirmQuoteVersion) onConfirmQuoteVersion(data);
            onDismiss();
          }}
        />
      )}
      {remainingOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 overflow-hidden">
          {remainingOptions.map((option, i) => {
            const isPrimary = option.action === 'confirm_quote' || option.action === 'confirm_quote_version' || option.action === 'confirm_invoice' ||
              (option.action === 'send_message' && option.label.toLowerCase().includes('confirm'));
            const isCancel = option.action === 'dismiss' || option.action === 'cancel_ingestion' || option.label.toLowerCase() === 'cancel';
            return (
              <Button
                key={i}
                variant={isPrimary ? "default" : isCancel ? "ghost" : "secondary"}
                size="sm"
                className="text-left whitespace-normal h-auto py-1.5"
                onClick={() => handleOption(option)}
                data-testid={`button-assist-${i}`}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SuggestionButtonsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SuggestionButtons({ suggestions, onSelect }: SuggestionButtonsProps) {
  if (!suggestions || suggestions.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((suggestion, i) => {
        const isConfirmAction = suggestion.toLowerCase().includes('confirm');
        const isCancel = suggestion.toLowerCase() === 'cancel';
        return (
          <Button
            key={i}
            variant={isConfirmAction ? "default" : isCancel ? "ghost" : "secondary"}
            size="sm"
            onClick={() => onSelect(suggestion)}
            data-testid={`button-suggestion-${i}`}
          >
            {suggestion}
          </Button>
        );
      })}
    </div>
  );
}
