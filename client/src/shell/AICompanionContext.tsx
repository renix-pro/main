/**
 * RENIX vNext — AI Companion Context
 * 
 * Global state provider for AI Companion panel.
 * The AI button is always visible in GlobalShellBar.
 * The panel can be opened from anywhere in the app.
 * 
 * Tracks project/frame context for the AI panel display.
 * Supports pendingMessage for external components to inject messages.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ProjectContext {
  projectName?: string;
  frameName?: string;
}

interface DeferredUploadContext {
  intent: 'add_version';
  quoteId: string;
  quoteRef: string;
  scopeName: string;
  scopeId?: string;
}

interface AICompanionContextValue {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  projectContext: ProjectContext;
  setProjectContext: (ctx: ProjectContext) => void;
  pendingMessage: string | null;
  sendToAI: (message: string) => void;
  consumePendingMessage: () => string | null;
  fileUploadRequested: boolean;
  requestFileUpload: () => void;
  consumeFileUploadRequest: () => boolean;
  deferredUploadContext: DeferredUploadContext | null;
  setDeferredUploadContext: (ctx: DeferredUploadContext | null) => void;
  consumeDeferredUploadContext: () => DeferredUploadContext | null;
}

const AICompanionContext = createContext<AICompanionContextValue | null>(null);

interface AICompanionProviderProps {
  children: ReactNode;
}

export function AICompanionProvider({ children }: AICompanionProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projectContext, setProjectContext] = useState<ProjectContext>({});
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [fileUploadRequested, setFileUploadRequested] = useState(false);
  const [deferredUploadContext, setDeferredUploadContextState] = useState<DeferredUploadContext | null>(null);

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const sendToAI = useCallback((message: string) => {
    setPendingMessage(message);
  }, []);

  const consumePendingMessage = useCallback(() => {
    const msg = pendingMessage;
    setPendingMessage(null);
    return msg;
  }, [pendingMessage]);

  const requestFileUpload = useCallback(() => {
    setFileUploadRequested(true);
  }, []);

  const consumeFileUploadRequest = useCallback(() => {
    const val = fileUploadRequested;
    setFileUploadRequested(false);
    return val;
  }, [fileUploadRequested]);

  const setDeferredUploadContext = useCallback((ctx: DeferredUploadContext | null) => {
    setDeferredUploadContextState(ctx);
  }, []);

  const consumeDeferredUploadContext = useCallback(() => {
    const ctx = deferredUploadContext;
    setDeferredUploadContextState(null);
    return ctx;
  }, [deferredUploadContext]);

  return (
    <AICompanionContext.Provider value={{ 
      isOpen, 
      toggle, 
      open, 
      close, 
      projectContext, 
      setProjectContext,
      pendingMessage,
      sendToAI,
      consumePendingMessage,
      fileUploadRequested,
      requestFileUpload,
      consumeFileUploadRequest,
      deferredUploadContext,
      setDeferredUploadContext,
      consumeDeferredUploadContext,
    }}>
      {children}
    </AICompanionContext.Provider>
  );
}

export function useAICompanion(): AICompanionContextValue {
  const context = useContext(AICompanionContext);
  if (!context) {
    throw new Error('useAICompanion must be used within AICompanionProvider');
  }
  return context;
}
