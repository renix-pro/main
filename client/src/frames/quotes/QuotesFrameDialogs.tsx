/**
 * RENIX vNext — Quotes Frame Dialogs
 * 
 * Renders all dialog components for the Quotes Frame.
 * Extracted to reduce complexity of the main index.tsx.
 */

import type { Quote, Vendor, QuoteVersion } from './useQuotesData';
import {
  VendorDialog,
  QuoteDialog,
  AcceptConfirmDialog,
  DeleteConfirmDialog,
} from './QuotesDialogs';
import { QuoteUploadDialog } from './QuoteUploadDialog';

export type DialogState =
  | { type: 'none' }
  | { type: 'add-vendor' }
  | { type: 'edit-vendor'; vendor: Vendor }
  | { type: 'delete-vendor'; vendor: Vendor }
  | { type: 'upload-quote' }
  | { type: 'upload-quote-for-scope'; scopeId: string }
  | { type: 'add-quote'; vendorId?: string }
  | { type: 'edit-quote'; quote: Quote }
  | { type: 'delete-quote'; quote: Quote }
  | { type: 'accept-version'; quote: Quote; version: QuoteVersion };

interface QuotesFrameDialogsProps {
  dialog: DialogState;
  closeDialog: () => void;
  vendors: Vendor[];
  currency: string;
  projectId: string;
  onSaveVendor: (name: string, contactInfo?: string, notes?: string) => void;
  onDeleteVendor: () => void;
  onSaveQuote: (vendorId: string, reference: string, description?: string) => void;
  onDeleteQuote: () => void;
  onAcceptVersion: () => void;
  onQuoteCreated: (quoteId: string, versionId: string) => void;
}

export function QuotesFrameDialogs({
  dialog,
  closeDialog,
  vendors,
  currency,
  projectId,
  onSaveVendor,
  onDeleteVendor,
  onSaveQuote,
  onDeleteQuote,
  onAcceptVersion,
  onQuoteCreated,
}: QuotesFrameDialogsProps) {
  return (
    <>
      <VendorDialog
        open={dialog.type === 'add-vendor' || dialog.type === 'edit-vendor'}
        onOpenChange={(open) => !open && closeDialog()}
        vendor={dialog.type === 'edit-vendor' ? dialog.vendor : undefined}
        onSave={onSaveVendor}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-vendor'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Vendor"
        description={
          dialog.type === 'delete-vendor'
            ? `Are you sure you want to delete "${dialog.vendor.name}"?`
            : ''
        }
        onConfirm={onDeleteVendor}
      />

      <QuoteDialog
        open={dialog.type === 'add-quote' || dialog.type === 'edit-quote'}
        onOpenChange={(open) => !open && closeDialog()}
        quote={dialog.type === 'edit-quote' ? dialog.quote : undefined}
        vendors={vendors}
        defaultVendorId={dialog.type === 'add-quote' ? dialog.vendorId : undefined}
        onSave={onSaveQuote}
      />

      <DeleteConfirmDialog
        open={dialog.type === 'delete-quote'}
        onOpenChange={(open) => !open && closeDialog()}
        title="Delete Quote"
        description={
          dialog.type === 'delete-quote'
            ? `Are you sure you want to delete quote "${dialog.quote.description || 'Untitled'}"? All versions will be removed.`
            : ''
        }
        onConfirm={onDeleteQuote}
      />

      <AcceptConfirmDialog
        open={dialog.type === 'accept-version'}
        onOpenChange={(open) => !open && closeDialog()}
        quoteName={dialog.type === 'accept-version' ? (dialog.quote.description || 'Untitled') : ''}
        versionNumber={dialog.type === 'accept-version' ? dialog.version.versionNumber : 0}
        total={dialog.type === 'accept-version' ? dialog.version.total : 0}
        currency={currency}
        onConfirm={onAcceptVersion}
      />

      <QuoteUploadDialog
        open={dialog.type === 'upload-quote'}
        onOpenChange={(open) => !open && closeDialog()}
        projectId={projectId}
        onQuoteCreated={onQuoteCreated}
      />
    </>
  );
}
