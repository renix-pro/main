/**
 * RENIX vNext — AI Conversation Pane
 * 
 * AI-FIRST PIVOT — Functional AI Conversation Shell
 * 
 * DESKTOP (≥1024px):
 * - Persistent LEFT pane, always visible
 * - Width: min 320px, max 420px, default 360px
 * - Resizable within bounds
 * 
 * TABLET (600-1023px):
 * - AI primary (~45% width)
 * - Frames slide in from right
 * 
 * MOBILE (≤599px):
 * - AI full-screen default
 * - Frames open via explicit actions as overlays
 * 
 * FUNCTIONAL:
 * - Real AI conversation via /api/ai/message
 * - Proposal integration
 * - Message streaming
 */

import { useState, useRef, useCallback, useEffect, FormEvent, ChangeEvent } from 'react';
import { Sparkles, Rocket, Check, X, Upload, ChevronUp, ArrowDown } from 'lucide-react';
import { RenixSpinner } from '@/components/RenixLoader';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { queryKeys } from '@/lib/api';
import { ProposalQueue, ProposalIndicator, useProposals } from './proposals';
import { useProjectSafe } from '../context/ProjectContext';
import { getAuthHeaders } from '@/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useDesktopLayoutSafe } from './DesktopWorkspaceLayout';
import { useMobileLayoutSafe } from './MobileWorkspaceLayout';
import { type MobileFrame } from './MobileBottomDock';
import { useAICompanion } from './AICompanionContext';
import { useUpload } from '@/hooks/use-upload';

import {
  type Message,
  type AttachedFile,
  type AIResponse,
  type ProjectProposal,
  type ProjectState,
  type PendingQuoteContext,
  DISCOVERY_WELCOME,
  PROJECT_WELCOME,
} from './ai/types';
import { MessageBubble, LoadingIndicator } from './ai/MessageBubble';
import { ThinkingIndicator, type ThinkingContext } from './ai/ThinkingIndicator';
import { MessageInput } from './ai/MessageInput';

interface AIConversationPaneProps {
  onToggleFrames?: () => void;
  showFramesToggle?: boolean;
  projectName?: string;
  frameName?: string;
}

const FRAME_SUGGESTIONS: Record<string, { label: string; message: string }[]> = {
  overview: [
    { label: "What needs my attention?", message: "What needs my attention right now?" },
    { label: "Summarize my project", message: "Give me a full project summary" },
    { label: "What changed this week?", message: "What changed in my project this week?" },
  ],
  scope: [
    { label: "Analyze scope coverage", message: "Analyze my scope coverage" },
    { label: "Find items without quotes", message: "Find scope items that don't have quotes yet" },
    { label: "Suggest missing areas", message: "Are there common renovation areas I might be missing?" },
  ],
  budget: [
    { label: "Show allocation efficiency", message: "How efficient is my budget allocation?" },
    { label: "What's unallocated?", message: "What budget is still unallocated?" },
    { label: "Budget vs. actual", message: "Compare my budget allocations against actual quotes" },
  ],
  quotes: [
    { label: "Compare quotes", message: "Compare quotes for the same scope area" },
    { label: "Flag expensive items", message: "Flag any unusually expensive line items across my quotes" },
    { label: "Vendor differences", message: "Summarize the key differences between my vendors" },
  ],
  invoices: [
    { label: "What's overdue?", message: "Are there any overdue invoices?" },
    { label: "Payment history", message: "Show my payment history summary" },
    { label: "Predict cash flow", message: "Help me predict upcoming cash flow needs" },
  ],
  vision: [
    { label: "Extract themes", message: "What design themes can you see from my inspiration?" },
    { label: "Scope from inspiration", message: "Suggest scope items based on my vision boards" },
  ],
  financing: [
    { label: "Funding gap analysis", message: "Show me a funding gap analysis" },
    { label: "Compare sources", message: "Compare my financing sources" },
  ],
  execution: [
    { label: "Critical path items", message: "What are the critical path items?" },
    { label: "Blocked tasks", message: "Are any tasks currently blocked?" },
  ],
  documents: [
    { label: "Recent uploads", message: "Summarize my recent document uploads" },
    { label: "Unprocessed documents", message: "Are there any unprocessed documents?" },
  ],
};

function getContextualSuggestions(state: ProjectState, activeFrame?: string): { greeting: string; subtitle: string; suggestions: { label: string; message: string; testId: string }[]; frameSuggestions?: { label: string; message: string; testId: string }[] } {
  if (state.isNewProject && state.scopeCount === 0) {
    return {
      greeting: "Let's set up your project!",
      subtitle: "I'll guide you through defining the key areas of your renovation.",
      suggestions: [
        { label: "Define the scope of work", message: "Help me define the scope of work for this project", testId: "button-suggestion-define-scope" },
        { label: "Set a target budget", message: "Help me set a target budget for this project", testId: "button-suggestion-set-budget" },
        { label: "What should I do first?", message: "What should I do first for a new project?", testId: "button-suggestion-first-steps" },
      ]
    };
  }
  
  if (state.scopeCount > 0 && !state.hasBudget) {
    return {
      greeting: "Good progress on scope!",
      subtitle: `You have ${state.scopeCount} scope ${state.scopeCount === 1 ? 'item' : 'items'} defined. Ready to plan your budget?`,
      suggestions: [
        { label: "Set the project budget", message: "Help me set a budget for this project", testId: "button-suggestion-set-budget" },
        { label: "Add more scope items", message: "Help me add more scope items", testId: "button-suggestion-add-scope" },
        { label: "Review my current scope", message: "Review my current scope and suggest improvements", testId: "button-suggestion-review-scope" },
      ]
    };
  }
  
  if (state.hasBudget && !state.hasAllocations && state.scopeCount > 0) {
    return {
      greeting: "Budget is set!",
      subtitle: "Now let's allocate your budget to different scope areas.",
      suggestions: [
        { label: "Allocate budget to scope", message: "Help me allocate my budget across the scope items", testId: "button-suggestion-allocate-budget" },
        { label: "Start collecting quotes", message: "How do I start collecting quotes from vendors?", testId: "button-suggestion-collect-quotes" },
        { label: "Review budget breakdown", message: "Show me a breakdown of my budget", testId: "button-suggestion-budget-breakdown" },
      ]
    };
  }
  
  if (state.hasAllocations && state.quoteCount === 0) {
    return {
      greeting: "Ready for quotes!",
      subtitle: "Your budget is allocated. Time to get vendor quotes.",
      suggestions: [
        { label: "Upload a quote", message: "I have a quote to upload", testId: "button-suggestion-upload-quote" },
        { label: "How do quotes work?", message: "Explain how to manage quotes in RENIX", testId: "button-suggestion-explain-quotes" },
        { label: "Review budget allocations", message: "Show me my current budget allocations", testId: "button-suggestion-review-allocations" },
      ]
    };
  }
  
  if (state.quoteCount > 0) {
    return {
      greeting: "Welcome back!",
      subtitle: `You have ${state.quoteCount} ${state.quoteCount === 1 ? 'quote' : 'quotes'} in your project.`,
      suggestions: [
        { label: "Compare my quotes", message: "Help me compare quotes for the same scope", testId: "button-suggestion-compare-quotes" },
        { label: "Check budget vs quotes", message: "How do my quotes compare to my budget?", testId: "button-suggestion-budget-vs-quotes" },
        { label: "What needs attention?", message: "What areas of my project need attention?", testId: "button-suggestion-needs-attention" },
      ],
      frameSuggestions: buildFrameSuggestions(activeFrame),
    };
  }
  
  return {
    greeting: "Welcome back!",
    subtitle: "How can I assist with your project today?",
    suggestions: [
      { label: "Review project status", message: "Give me an overview of my project status", testId: "button-suggestion-project-status" },
      { label: "Add scope items", message: "Help me add new scope items", testId: "button-suggestion-add-scope" },
      { label: "Plan the budget", message: "Help me plan the budget", testId: "button-suggestion-plan-budget" },
    ],
    frameSuggestions: buildFrameSuggestions(activeFrame),
  };
}

function buildFrameSuggestions(activeFrame?: string): { label: string; message: string; testId: string }[] | undefined {
  if (!activeFrame) return undefined;
  const frameKey = activeFrame.toLowerCase();
  const frameSugs = FRAME_SUGGESTIONS[frameKey];
  if (!frameSugs || frameSugs.length === 0) return undefined;
  return frameSugs.map((s, i) => ({
    label: s.label,
    message: s.message,
    testId: `button-frame-suggestion-${frameKey}-${i}`,
  }));
}

function inferThinkingContext(lastUserMessage: string, hasAttachment: boolean): ThinkingContext {
  if (hasAttachment) return 'document_upload';
  const lower = lastUserMessage.toLowerCase();
  if (lower.includes('compare')) return 'quote_comparison';
  if (/project|summary|overview|status|attention/.test(lower)) return 'project_analysis';
  return 'general';
}

const VALID_MOBILE_FRAMES: MobileFrame[] = ['overview', 'vision', 'scope', 'budget', 'quotes', 'invoices', 'financing', 'execution', 'documents'];

export function AIConversationPane({ 
  onToggleFrames, 
  showFramesToggle = false,
  projectName,
  frameName 
}: AIConversationPaneProps) {
  const projectContext = useProjectSafe();
  const projectId = projectContext?.projectId;
  const activeFrame = projectContext?.activeFrame;
  const { addProposal, isProposalModeActive } = useProposals();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const layoutContext = useDesktopLayoutSafe();
  const mobileLayout = useMobileLayoutSafe();
  const aiCompanion = useAICompanion();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    if (mobileLayout) {
      const match = path.match(/\/project\/[^/]+\/([^?#]+)/);
      const frame = match?.[1]?.toLowerCase() as MobileFrame | undefined;
      if (frame && VALID_MOBILE_FRAMES.includes(frame)) {
        mobileLayout.showFrame(frame);
      }
    }
  }, [navigate, mobileLayout]);
  
  const isDiscoveryMode = !projectId;
  
  const { data: scopeNodes } = useQuery<{ id: string }[]>({
    queryKey: ['api', 'projects', projectId, 'scope-nodes'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/scope-nodes`, { headers: getAuthHeaders() });
      return res.json();
    },
    enabled: !!projectId,
    select: (data: any) => Array.isArray(data) ? data : (data?.scopeNodes || data?.nodes || []),
    staleTime: 30000,
  });
  
  const { data: budgetData } = useQuery<{ budget: { totalBudget: number } | null; allocations?: any[] } | null>({
    queryKey: ['api', 'projects', projectId, 'budget'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/budget`, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
  
  const { data: quotesData } = useQuery<{ quotes: any[] }>({
    queryKey: ['api', 'projects', projectId, 'quotes'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/quotes`, { headers: getAuthHeaders() });
      return res.json();
    },
    enabled: !!projectId,
    select: (data: any) => ({ quotes: Array.isArray(data) ? data : (data?.quotes || []) }),
    staleTime: 30000,
  });
  
  const { data: invoicesData } = useQuery<{ invoices: any[] }>({
    queryKey: ['api', 'projects', projectId, 'invoices'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/invoices`, { headers: getAuthHeaders() });
      if (!res.ok) return { invoices: [] };
      return res.json();
    },
    enabled: !!projectId,
    select: (data: any) => ({ invoices: Array.isArray(data?.invoices) ? data.invoices : [] }),
    staleTime: 30000,
  });

  const { data: projectData } = useQuery<{ createdAt: string }>({
    queryKey: ['api', 'projects', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { headers: getAuthHeaders() });
      return res.json();
    },
    enabled: !!projectId,
    select: (data: any) => ({ createdAt: data?.createdAt || data?.created_at }),
    staleTime: 60000,
  });
  
  const projectState: ProjectState = {
    scopeCount: scopeNodes?.length || 0,
    hasBudget: (budgetData?.budget?.totalBudget || 0) > 0,
    budgetTotal: budgetData?.budget?.totalBudget || 0,
    quoteCount: quotesData?.quotes?.length || 0,
    hasAllocations: (budgetData?.allocations?.length || 0) > 0,
    isNewProject: projectData?.createdAt 
      ? (Date.now() - new Date(projectData.createdAt).getTime()) < 24 * 60 * 60 * 1000
      : false,
  };
  
  const contextualSuggestions = getContextualSuggestions(projectState, activeFrame);
  
  const [messages, setMessages] = useState<Message[]>([isDiscoveryMode ? DISCOVERY_WELCOME : PROJECT_WELCOME]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<AttachedFile | null>(null);
  const [autoSendAttachment, setAutoSendAttachment] = useState<AttachedFile | null>(null);
  
  const [pendingQuoteContext, setPendingQuoteContext] = useState<PendingQuoteContext | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const proposalRef = useRef<HTMLDivElement>(null);
  const hiddenFileRef = useRef<HTMLInputElement>(null);
  
  const { uploadFile, isUploading, progress } = useUpload({
    projectId,
    purpose: 'quote-import',
    onSuccess: (response) => {
      const attachment = {
        name: response.metadata.name,
        size: response.metadata.size,
        type: response.metadata.contentType,
        uploadToken: response.uploadToken,
        objectPath: response.objectPath,
      };
      setPendingAttachment(attachment);
      setAutoSendAttachment(attachment);
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });
  
  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type)) {
      toast({ 
        title: 'Unsupported file type', 
        description: 'Please upload a PDF, image, or spreadsheet file.',
        variant: 'destructive' 
      });
      return;
    }
    
    if (file.size > 25 * 1024 * 1024) {
      toast({ 
        title: 'File too large', 
        description: 'Maximum file size is 25MB.',
        variant: 'destructive' 
      });
      return;
    }
    
    await uploadFile(file);
    if (e.target) {
      e.target.value = '';
    }
  }, [uploadFile, toast]);
  
  const handleFileDrop = useCallback(async (file: File) => {
    if (isLoading || isUploading) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload a PDF, image, or spreadsheet file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 25MB.',
        variant: 'destructive',
      });
      return;
    }

    await uploadFile(file);
  }, [uploadFile, toast, isLoading, isUploading]);

  const clearAttachment = useCallback(() => {
    setPendingAttachment(null);
  }, []);
  
  const { data: allPendingProposals = [] } = useQuery<ProjectProposal[]>({
    queryKey: ['/api/proposals'],
    queryFn: async () => {
      const res = await fetch('/api/proposals', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.proposals || []).filter(
        (p: any) => p.status === 'pending'
      );
    },
    refetchInterval: 3000,
  });
  
  const pendingProjectProposal = allPendingProposals.find(p => p.targetFrame === 'project');
  const pendingFrameProposals = allPendingProposals.filter(p => p.targetFrame !== 'project');
  
  useEffect(() => {
    if (allPendingProposals.length > 0 && proposalRef.current) {
      proposalRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [allPendingProposals.length]);
  
  const acceptProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const res = await fetch(`/api/proposals/${proposalId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to accept proposal');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.scope(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.scopeNodes(projectId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.budget(projectId) });
        if (data.executionTasksCreated) {
          queryClient.invalidateQueries({ queryKey: queryKeys.execution(projectId) });
        }
      }
      const successMsg = data.executionTasksCreated
        ? data.executionTasksCreated === 1
          ? 'Task created successfully!'
          : `${data.executionTasksCreated} tasks created successfully!`
        : data.scopeId 
          ? 'Scope created successfully!' 
          : data.projectId 
            ? 'Project created successfully!' 
            : 'Proposal accepted.';
      const inlineSuccessMsg: Message = {
        id: `assistant-proposal-success-${Date.now()}`,
        role: 'assistant',
        content: successMsg,
        timestamp: new Date(),
        responseType: 'acknowledge',
      };
      setMessages(prev => [...prev, inlineSuccessMsg]);
      if (data.redirectTo) {
        navigate(data.redirectTo);
      }
      if (data.scopeId && pendingQuoteContext) {
        setTimeout(() => {
          sendMessage("The new scope has been created. Please continue with the quote ingestion and assign the uploaded document to the new scope.");
        }, 800);
      }
    },
    onError: () => {
      const errorMsg: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: 'Failed to accept proposal. Please try again.',
        timestamp: new Date(),
        responseType: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });
  
  const rejectProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const res = await fetch(`/api/proposals/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to reject proposal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      const rejectMsg: Message = {
        id: `assistant-reject-${Date.now()}`,
        role: 'assistant',
        content: 'Proposal rejected. Feel free to tell me more about your project.',
        timestamp: new Date(),
        responseType: 'acknowledge',
      };
      setMessages(prev => [...prev, rejectMsg]);
    },
  });
  
  const confirmQuote = useMutation({
    mutationFn: async (quoteData: { documentId: string; scopeId: string; scopeName?: string; objectPath?: string; forceReplace?: boolean }) => {
      console.log('[confirmQuote] Starting with quoteData:', quoteData);
      
      if (!projectId) throw new Error('Project required');
      if (!quoteData.documentId) throw new Error('Document ID is required');
      if (!quoteData.scopeId) throw new Error('Scope ID is required');
      
      console.log('[confirmQuote] Making API call to:', `/api/projects/${projectId}/ai/confirm-quote`);
      
      const res = await fetch(`/api/projects/${projectId}/ai/confirm-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          documentId: quoteData.documentId,
          scopeId: quoteData.scopeId,
          scopeName: quoteData.scopeName,
          objectPath: quoteData.objectPath,
          forceReplace: quoteData.forceReplace || false,
        }),
      });
      
      console.log('[confirmQuote] Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const error = await res.json();
        console.error('[confirmQuote] API error response:', error);
        
        if (res.status === 409 && error.code === 'DUPLICATE_DOCUMENT') {
          return { isDuplicate: true, ...error, originalQuoteData: quoteData };
        }
        
        throw new Error(error.details || error.message || 'Failed to confirm quote');
      }
      
      const result = await res.json();
      console.log('[confirmQuote] Success result:', result);
      return { ...result, scopeName: quoteData.scopeName };
    },
    onSuccess: (data: any) => {
      if (data.isDuplicate) {
        const duplicateMessage: Message = {
          id: `assistant-duplicate-${Date.now()}`,
          role: 'assistant',
          content: `A document named **${data.existingDocument.fileName}** already exists in this project${data.existingDocument.linkedScopeName ? ` (linked to ${data.existingDocument.linkedScopeName})` : ''}. Would you like to replace it with this new version?`,
          timestamp: new Date(),
          responseType: 'action_required',
          assistOptions: [
            {
              label: 'Replace existing',
              action: 'confirm_quote' as const,
              quoteData: { ...data.originalQuoteData, forceReplace: true },
            },
            {
              label: 'Cancel',
              action: 'cancel_ingestion' as const,
              ingestionData: { documentId: data.originalQuoteData.documentId },
            },
          ],
        };
        setMessages(prev => [...prev, duplicateMessage]);
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'documents'] });
      
      setPendingQuoteContext(null);
      
      const scopeName = data.scopeName || data.quote?.scopeName || 'selected scope';
      const successMessage: Message = {
        id: `assistant-confirm-${Date.now()}`,
        role: 'assistant',
        content: `Quote from **${data.quote?.vendorName || 'vendor'}** added under **${scopeName}**.`,
        timestamp: new Date(),
        responseType: 'acknowledge',
        ingestionSuccess: {
          type: 'quote',
          vendorName: data.quote?.vendorName || null,
          scopeName: scopeName,
          total: data.quote?.total || null,
          currency: data.quote?.currency || 'EUR',
          quoteId: data.quote?.id || data.quoteId || undefined,
          quoteVersionId: data.quote?.versionId || data.versionId || undefined,
          scopeId: data.quote?.scopeId || undefined,
        },
      };
      setMessages(prev => [...prev, successMessage]);
    },
    onError: (error: any) => {
      console.error('[confirmQuote] Error:', error);
      setPendingQuoteContext(null);
      const errorMsg: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `I wasn't able to add the quote: ${error.message || 'An unexpected error occurred.'}`,
        timestamp: new Date(),
        responseType: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });
  
  const handleConfirmQuote = useCallback((quoteData: { documentId: string; scopeId: string; scopeName?: string; objectPath?: string; forceReplace?: boolean }) => {
    confirmQuote.mutate(quoteData);
  }, [confirmQuote]);
  
  const confirmQuoteVersion = useMutation({
    mutationFn: async (versionData: { documentId: string; existingQuoteId: string; scopeId?: string; objectPath?: string }) => {
      console.log('[confirmQuoteVersion] Starting with versionData:', versionData);
      
      if (!projectId) throw new Error('Project required');
      if (!versionData.documentId) throw new Error('Document ID is required');
      if (!versionData.existingQuoteId) throw new Error('Existing Quote ID is required');
      
      let validatedQuoteId = versionData.existingQuoteId;
      
      try {
        const quotesRes = await fetch(`/api/projects/${projectId}/quotes`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        if (quotesRes.ok) {
          const quotesData = await quotesRes.json();
          const allQuotes: Array<{ id: string; scopeId: string; status: string }> = quotesData.quotes || quotesData || [];
          const exactMatch = allQuotes.find((q: any) => q.id === versionData.existingQuoteId);
          
          if (!exactMatch) {
            console.warn(`[confirmQuoteVersion] Quote ID "${versionData.existingQuoteId}" not found among ${allQuotes.length} project quotes`);
            throw new Error(
              'The referenced quote could not be found — it may have been deleted or the reference was incorrect. ' +
              'Please try uploading the document again as a new quote.'
            );
          } else {
            console.log(`[confirmQuoteVersion] Quote ID verified: ${validatedQuoteId}`);
          }
        }
      } catch (validationError: any) {
        if (validationError?.message?.includes('could not be found')) throw validationError;
        console.warn('[confirmQuoteVersion] Quote validation fetch failed, proceeding with original ID:', validationError);
      }
      
      const res = await fetch(`/api/projects/${projectId}/ai/confirm-quote-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          documentId: versionData.documentId,
          existingQuoteId: validatedQuoteId,
          scopeId: versionData.scopeId,
          objectPath: versionData.objectPath,
        }),
      });
      
      if (!res.ok) {
        let errorMessage = 'Failed to add quote version';
        try {
          const error = await res.json();
          errorMessage = error.details || error.message || errorMessage;
        } catch {
          errorMessage = `Server error (${res.status})`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await res.json();
      return result;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'documents'] });
      
      const versionNumber = data.versionNumber ?? data.quote?.versionNumber ?? null;
      const successMessage: Message = {
        id: `assistant-version-success-${Date.now()}`,
        role: 'assistant',
        content: `New version (v${versionNumber || '?'}) added to the quote${data.quote?.vendorName ? ` from ${data.quote.vendorName}` : ''} under ${data.quote?.scopeName || 'scope'}.`,
        timestamp: new Date(),
        responseType: 'acknowledge',
        ingestionSuccess: {
          type: 'quote_version',
          vendorName: data.quote?.vendorName || null,
          scopeName: data.quote?.scopeName || null,
          total: data.quote?.total || null,
          currency: data.quote?.currency || 'EUR',
          versionNumber,
          quoteId: data.quote?.id || data.quoteId || undefined,
          quoteVersionId: data.quote?.versionId || data.versionId || undefined,
          scopeId: data.quote?.scopeId || undefined,
        },
      };
      setMessages(prev => [...prev, successMessage]);
      
    },
    onError: (error: Error) => {
      console.error('[confirmQuoteVersion] Error:', error.message, error.stack);
      setPendingQuoteContext(null);
      const errorMessage: Message = {
        id: `assistant-version-error-${Date.now()}`,
        role: 'assistant',
        content: `I wasn't able to add the new version: ${error.message}. You can try uploading the document again.`,
        timestamp: new Date(),
        responseType: 'error',
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleConfirmQuoteVersion = useCallback((versionData: { documentId: string; existingQuoteId: string; scopeId?: string; objectPath?: string }) => {
    confirmQuoteVersion.mutate(versionData);
  }, [confirmQuoteVersion]);
  
  const confirmInvoice = useMutation({
    mutationFn: async (invoiceData: { documentId: string; objectPath?: string; scopeId?: string; scopeName?: string; forceReplace?: boolean; extractedData?: any }) => {
      console.log('[confirmInvoice] Starting with invoiceData:', invoiceData);
      
      if (!projectId) throw new Error('Project required');
      if (!invoiceData.documentId) throw new Error('Document ID is required');
      
      console.log('[confirmInvoice] Making API call to:', `/api/projects/${projectId}/ai/confirm-invoice`);
      
      const res = await fetch(`/api/projects/${projectId}/ai/confirm-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          documentId: invoiceData.documentId,
          objectPath: invoiceData.objectPath,
          scopeId: invoiceData.scopeId,
          scopeName: invoiceData.scopeName,
          forceReplace: invoiceData.forceReplace || false,
          extractedData: invoiceData.extractedData,
        }),
      });
      
      console.log('[confirmInvoice] Response status:', res.status, res.statusText);
      
      if (!res.ok) {
        const error = await res.json();
        console.error('[confirmInvoice] API error response:', error);
        
        if (res.status === 409 && error.code === 'DUPLICATE_DOCUMENT') {
          return { isDuplicate: true, ...error, originalInvoiceData: invoiceData };
        }
        
        throw new Error(error.details || error.message || 'Failed to confirm invoice');
      }
      
      const result = await res.json();
      console.log('[confirmInvoice] Success result:', result);
      return result;
    },
    onSuccess: (data: any) => {
      if (data.isDuplicate) {
        const duplicateMessage: Message = {
          id: `assistant-duplicate-invoice-${Date.now()}`,
          role: 'assistant',
          content: `A document named **${data.existingDocument.fileName}** already exists in this project${data.existingDocument.linkedScopeName ? ` (linked to ${data.existingDocument.linkedScopeName})` : ''}. Would you like to replace it with this new version?`,
          timestamp: new Date(),
          responseType: 'action_required',
          assistOptions: [
            {
              label: 'Replace existing',
              action: 'confirm_invoice' as const,
              invoiceData: { ...data.originalInvoiceData, forceReplace: true },
            },
            {
              label: 'Cancel',
              action: 'cancel_ingestion' as const,
              ingestionData: { documentId: data.originalInvoiceData.documentId },
            },
          ],
        };
        setMessages(prev => [...prev, duplicateMessage]);
        return;
      }
      
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
      queryClient.invalidateQueries({ queryKey: ['api', 'projects', projectId, 'documents'] });
      
      const vendorName = data.invoice?.vendorName || 'Unknown Vendor';
      const successMessage: Message = {
        id: `assistant-confirm-invoice-${Date.now()}`,
        role: 'assistant',
        content: `Invoice from **${vendorName}** recorded and finalized.`,
        timestamp: new Date(),
        responseType: 'acknowledge',
        ingestionSuccess: {
          type: 'invoice',
          vendorName: data.invoice?.vendorName || null,
          scopeName: data.invoice?.scopeName || null,
          total: data.invoice?.total || null,
          currency: data.invoice?.currency || 'EUR',
          reference: data.invoice?.reference || null,
        },
      };
      setMessages(prev => [...prev, successMessage]);
    },
    onError: (error: any) => {
      console.error('[confirmInvoice] Error:', error);
      const errorMsg: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `I wasn't able to add the invoice: ${error.message || 'An unexpected error occurred.'}`,
        timestamp: new Date(),
        responseType: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });
  
  const handleConfirmInvoice = useCallback((invoiceData: { documentId: string; objectPath?: string; scopeId?: string; scopeName?: string; forceReplace?: boolean }) => {
    confirmInvoice.mutate(invoiceData);
  }, [confirmInvoice]);
  
  // Cancel ingestion - delete unconfirmed document
  const cancelIngestion = useMutation({
    mutationFn: async (data: { documentId: string }) => {
      console.log('[cancelIngestion] Cancelling document:', data.documentId);
      
      if (!projectId) throw new Error('Project required');
      if (!data.documentId) throw new Error('Document ID is required');
      
      const res = await fetch(`/api/projects/${projectId}/ai/cancel-ingestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ documentId: data.documentId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.message || 'Failed to cancel ingestion');
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents(projectId!) });
      
      const cancelMessage: Message = {
        id: `assistant-cancel-${Date.now()}`,
        role: 'assistant',
        content: `No problem! The document has been removed. Feel free to upload another document or ask me about your project.`,
        timestamp: new Date(),
        responseType: 'acknowledge',
      };
      setMessages(prev => [...prev, cancelMessage]);
    },
    onError: (error: any) => {
      console.error('[cancelIngestion] Error:', error);
      const errorMsg: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: `I wasn't able to cancel the upload: ${error.message || 'An unexpected error occurred.'}`,
        timestamp: new Date(),
        responseType: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });
  
  const handleCancelIngestion = useCallback((data: { documentId: string }) => {
    cancelIngestion.mutate(data);
  }, [cancelIngestion]);

  const handleRetryExtraction = useCallback((data: { documentId: string }) => {
    setPendingQuoteContext(prev => {
      if (prev && prev.documentId === data.documentId) {
        return { ...prev, extractedData: undefined };
      }
      return { documentId: data.documentId, objectPath: undefined, fileName: undefined, classification: undefined, extractedData: undefined };
    });
  }, []);
  
  // Load persisted conversation history from database (Phase C-0.1)
  useEffect(() => {
    if (isDiscoveryMode) {
      setMessages([DISCOVERY_WELCOME]);
      setConversationLoaded(true);
      return;
    }
    
    if (!projectId) {
      setMessages([PROJECT_WELCOME]);
      setConversationLoaded(true);
      return;
    }
    
    // Fetch persisted messages from database
    const loadConversation = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/ai/conversation`, {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        
        if (!res.ok) {
          console.error('[ConversationPersistence] Failed to load conversation:', res.statusText);
          setMessages([PROJECT_WELCOME]);
          setVisibleCount(20);
          setHasNewMessages(false);
          isNearBottomRef.current = true;
          setConversationLoaded(true);
          return;
        }
        
        const data = await res.json();
        
        if (data.messages && data.messages.length > 0) {
          const loadedMessages: Message[] = data.messages.map((m: any) => {
            const meta = m.metadata || {};
            return {
              id: m.id,
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              timestamp: new Date(m.timestamp),
              responseType: meta.responseType,
              ingestionSuccess: meta.ingestionSuccess,
              classificationData: meta.classificationData,
              preConfirmData: meta.preConfirmData,
              hasProposal: meta.hasProposal,
              affectedFrames: meta.affectedFrames,
              sessionOrientation: meta.sessionOrientation,
            };
          });
          
          console.log(`[ConversationPersistence] Loaded ${loadedMessages.length} messages from database`);
          setMessages(loadedMessages);
        } else {
          setMessages([PROJECT_WELCOME]);
        }
        
        setVisibleCount(20);
        setHasNewMessages(false);
        isNearBottomRef.current = true;
        setConversationLoaded(true);
      } catch (error) {
        console.error('[ConversationPersistence] Error loading conversation:', error);
        setMessages([PROJECT_WELCOME]);
        setVisibleCount(20);
        setHasNewMessages(false);
        isNearBottomRef.current = true;
        setConversationLoaded(true);
      }
    };
    
    loadConversation();
  }, [isDiscoveryMode, projectId]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;
    const handleScroll = () => {
      const el = viewport as HTMLElement;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      isNearBottomRef.current = nearBottom;
      if (nearBottom) {
        setHasNewMessages(false);
      }
    };
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        if (isNearBottomRef.current) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          setHasNewMessages(true);
        }
      }
    }
  }, [messages]);
  
  useEffect(() => {
    if (!projectId || !pendingQuoteContext?.documentId || pendingQuoteContext.extractedData) {
      return;
    }
    
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;
    
    const pollExtraction = async () => {
      if (cancelled) return;
      
      if (attempts >= maxAttempts) {
        const timeoutMsg: Message = {
          id: `assistant-extraction-timeout-${Date.now()}`,
          role: 'assistant',
          content: 'Extraction is taking longer than expected. You can retry or cancel the upload.',
          timestamp: new Date(),
          responseType: 'error',
          assistOptions: [
            {
              label: 'Retry extraction',
              action: 'retry_extraction' as any,
              retryData: { documentId: pendingQuoteContext.documentId },
            },
            {
              label: 'Cancel',
              action: 'cancel_ingestion' as const,
              ingestionData: { documentId: pendingQuoteContext.documentId },
            },
          ],
        };
        setMessages(prev => [...prev, timeoutMsg]);
        setPendingQuoteContext(null);
        return;
      }
      
      try {
        if (attempts === 0) {
          await fetch(`/api/projects/${projectId}/documents/${pendingQuoteContext.documentId}/extract`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
          });
        }
        
        const res = await fetch(
          `/api/projects/${projectId}/documents/${pendingQuoteContext.documentId}/extraction`,
          { headers: getAuthHeaders(), credentials: 'include' }
        );
        
        if (!res.ok) {
          attempts++;
          if (!cancelled && attempts < maxAttempts) {
            setTimeout(pollExtraction, 2000);
          }
          return;
        }
        
        const data = await res.json();
        
        if (data.status === 'completed' && data.extractedData) {
          const extracted = data.extractedData;
          setPendingQuoteContext(prev => prev ? {
            ...prev,
            extractedData: {
              vendorName: extracted.vendorName ?? null,
              quoteDate: extracted.quoteDate ?? null,
              financials: {
                netTotal: extracted.financials?.netTotal ?? null,
                taxAmount: extracted.financials?.taxAmount ?? null,
                grossTotal: extracted.financials?.grossTotal ?? null,
              },
            },
          } : null);
          return;
        } else if (data.status === 'failed') {
          console.error('[Extraction] Failed:', data.error);
          const failMsg: Message = {
            id: `assistant-extraction-failed-${Date.now()}`,
            role: 'assistant',
            content: `Extraction failed: ${data.error || 'Unknown error'}. You can retry or cancel.`,
            timestamp: new Date(),
            responseType: 'error',
            assistOptions: [
              {
                label: 'Retry extraction',
                action: 'retry_extraction' as any,
                retryData: { documentId: pendingQuoteContext.documentId },
              },
              {
                label: 'Cancel',
                action: 'cancel_ingestion' as const,
                ingestionData: { documentId: pendingQuoteContext.documentId },
              },
            ],
          };
          setMessages(prev => [...prev, failMsg]);
          setPendingQuoteContext(null);
          return;
        }
        
        attempts++;
        if (!cancelled && attempts < maxAttempts) {
          setTimeout(pollExtraction, 2000);
        }
      } catch (err) {
        console.error('[Extraction] Error polling:', err);
        attempts++;
        if (!cancelled && attempts < maxAttempts) {
          setTimeout(pollExtraction, 2000);
        }
      }
    };
    
    const timeout = setTimeout(pollExtraction, 500);
    
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [projectId, pendingQuoteContext?.documentId, pendingQuoteContext?.extractedData]);


  const sendMessage = useCallback(async (content: string, explicitAttachment?: AttachedFile | null, isAutoUpload: boolean = false) => {
    const attachmentToUse = explicitAttachment !== undefined ? explicitAttachment : pendingAttachment;
    
    if ((!content.trim() && !attachmentToUse) || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim() || (attachmentToUse ? `Attached: ${attachmentToUse.name}` : ''),
      timestamp: new Date(),
      attachment: attachmentToUse || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    const attachmentToSend = attachmentToUse;
    if (explicitAttachment === undefined) {
      setPendingAttachment(null);
    }
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

      const isSessionResume = messages.filter(m => m.role === 'user').length === 0;
      
      const res = await fetch('/api/ai/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          message: content.trim(),
          conversationHistory,
          activeFrame,
          isSessionResume,
          isAutoUpload,
          attachment: attachmentToSend ? {
            fileName: attachmentToSend.name,
            fileType: attachmentToSend.type,
            uploadToken: attachmentToSend.uploadToken,
            objectPath: attachmentToSend.objectPath,
          } : undefined,
          pendingQuoteContext: !attachmentToSend ? pendingQuoteContext : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to send message: ${res.statusText}`);
      }

      const response: AIResponse = await res.json();
      
      // Handle persistence error - message may be lost on server restart
      if ((response as any).persistenceError) {
        console.warn('[AIConversationPane] Message persistence failed - conversation may not survive reload');
        const persistErrMsg: Message = {
          id: `system-persist-error-${Date.now()}`,
          role: 'system',
          content: 'There was an issue saving this message. It may be lost if you refresh the page.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, persistErrMsg]);
      }

      const affectedFrames = response.proposals?.map(p => p.target_frame).filter(Boolean) || [];
      const hasProposal = response.proposals && response.proposals.length > 0;
      
      const assistOptions = response.assist_options;
      const hasAssistOptions = assistOptions && assistOptions.length > 0;
      
      let suggestedActions: string[] = [];
      if (!hasAssistOptions && !hasProposal) {
        if (response.type === 'explore') {
          suggestedActions = ['Explore budget impact', 'Compare with current state'];
        } else if (response.type === 'explain') {
          suggestedActions = response.suggested_actions || [];
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        responseType: response.type,
        thinking: response.thinking,
        suggestedActions: hasAssistOptions ? undefined : suggestedActions,
        affectedFrames: affectedFrames.length > 0 ? affectedFrames : undefined,
        hasProposal,
        assistOptions: hasAssistOptions ? assistOptions : undefined,
        attentionState: response.attention_state,
        attentionDetail: response.attention_detail,
        sessionOrientation: response.session_orientation,
        confidence: response.confidence_level,
        structuredData: response.structured_data,
      };

      const responseAttachment = (response as any).attachment;
      if (responseAttachment?.classification) {
        assistantMessage.classificationData = {
          documentType: responseAttachment.classification.documentType,
          confidence: responseAttachment.classification.confidence,
          coverageSummary: responseAttachment.classification.coverageSummary,
          fileName: responseAttachment.fileName,
          vendorName: responseAttachment.extractedData?.vendorName ?? null,
          date: responseAttachment.extractedData?.date ?? null,
          reference: responseAttachment.extractedData?.reference ?? null,
          lineItemCount: responseAttachment.extractedData?.lineItemCount,
          currency: responseAttachment.extractedData?.currency,
          financials: responseAttachment.extractedData?.financials ? {
            netTotal: responseAttachment.extractedData.financials.netTotal ?? null,
            taxAmount: responseAttachment.extractedData.financials.taxAmount ?? null,
            grossTotal: responseAttachment.extractedData.financials.grossTotal ?? null,
          } : undefined,
          recommendedTags: responseAttachment.recommendedTags,
        };
      }

      const confirmQuoteOption = assistantMessage.assistOptions?.find(
        (o: any) => o.action === 'confirm_quote'
      );
      const confirmInvoiceOption = assistantMessage.assistOptions?.find(
        (o: any) => o.action === 'confirm_invoice'
      );
      if (confirmQuoteOption?.quoteData || confirmInvoiceOption?.invoiceData) {
        const isQuoteConfirm = !!confirmQuoteOption;
        const actionData = isQuoteConfirm ? confirmQuoteOption.quoteData : confirmInvoiceOption!.invoiceData;
        assistantMessage.preConfirmData = {
          type: isQuoteConfirm ? 'quote' : 'invoice',
          scopeName: actionData?.scopeName || 'Selected scope',
          vendorName: pendingQuoteContext?.extractedData?.vendorName ?? null,
          total: pendingQuoteContext?.extractedData?.financials?.grossTotal ?? null,
          currency: 'EUR',
          fileName: pendingQuoteContext?.fileName,
        };
      }

      setMessages(prev => [...prev, assistantMessage]);
      
      if ((response as any).attachment?.documentId) {
        const attachmentData = (response as any).attachment;
        setPendingQuoteContext({
          documentId: attachmentData.documentId,
          objectPath: attachmentData.objectPath,
          fileName: attachmentData.fileName,
          classification: attachmentData.classification,
          extractedData: attachmentData.extractedData ? {
            vendorName: attachmentData.extractedData.vendorName ?? null,
            quoteDate: attachmentData.extractedData.date ?? null,
            financials: {
              netTotal: attachmentData.extractedData.financials?.netTotal ?? null,
              taxAmount: attachmentData.extractedData.financials?.taxAmount ?? null,
              grossTotal: attachmentData.extractedData.financials?.grossTotal ?? null,
            },
          } : undefined,
        });
      }
      
      if ((response as any).extractedData && pendingQuoteContext) {
        const extracted = (response as any).extractedData;
        setPendingQuoteContext(prev => prev ? {
          ...prev,
          extractedData: {
            vendorName: extracted.vendorName ?? null,
            quoteDate: extracted.quoteDate ?? null,
            financials: {
              netTotal: extracted.financials?.netTotal ?? null,
              taxAmount: extracted.financials?.taxAmount ?? null,
              grossTotal: extracted.financials?.grossTotal ?? null,
            },
          },
        } : null);
      }

      if (response.proposals && response.proposals.length > 0 && isProposalModeActive) {
        const proposal = response.proposals[0];
        
        try {
          await fetch('/api/proposals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            credentials: 'include',
            body: JSON.stringify({
              projectId: projectId || null,
              targetFrame: proposal.target_frame,
              targetEntities: proposal.target_entities || [],
              proposedDiff: proposal.proposed_diff,
              rationale: proposal.rationale,
              assumptions: proposal.assumptions || [],
              downstreamImpacts: proposal.downstream_impacts || [],
              riskLevel: proposal.risk_level || 'low',
              provenance: proposal.provenance,
              author: proposal.author || 'AI',
              model: proposal.model || 'gpt-4o',
            }),
          });
          
          queryClient.invalidateQueries({ queryKey: ['/api/proposals'] });
          
          const proposalTargetFrame = proposal.target_frame?.toLowerCase();
          const validFrames = ['overview', 'vision', 'scope', 'budget', 'quotes', 'invoices', 'financing', 'execution', 'documents'];
          if (layoutContext !== null && projectId && proposalTargetFrame && validFrames.includes(proposalTargetFrame) && activeFrame?.toLowerCase() !== proposalTargetFrame) {
            const targetUrl = `/project/${projectId}/${proposalTargetFrame}`;
            setTimeout(() => {
              navigate(targetUrl);
            }, 100);
          }
        } catch (err) {
          console.error('Failed to save proposal:', err);
        }
      }
      
      const isDesktop = layoutContext !== null;
      if (isDesktop && projectId && response.uiIntent?.type === 'navigate') {
        const targetFrame = response.uiIntent.targetFrame?.toLowerCase();
        const validFrames = ['overview', 'vision', 'scope', 'budget', 'quotes', 'invoices', 'financing', 'execution', 'documents', 'insights'];
        
        if (targetFrame && validFrames.includes(targetFrame) && activeFrame?.toLowerCase() !== targetFrame) {
          const targetUrl = `/project/${projectId}/${targetFrame}`;
          setTimeout(() => {
            navigate(targetUrl);
          }, 100);
        }
      }
    } catch (error) {
      console.error('AI message error:', error);
      
      setPendingQuoteContext(null);
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an issue processing your request. Please try again.',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, projectId, activeFrame, isLoading, addProposal, isProposalModeActive, toast, pendingQuoteContext, pendingAttachment, layoutContext, navigate, queryClient]);

  useEffect(() => {
    if (autoSendAttachment && !isLoading) {
      const attachment = autoSendAttachment;
      setAutoSendAttachment(null);
      setPendingAttachment(null);
      const deferredCtx = aiCompanion.consumeDeferredUploadContext();
      if (deferredCtx && deferredCtx.intent === 'add_version') {
        sendMessage(
          `I've uploaded a document: ${attachment.name}. I want to add this as a new version of the quote "${deferredCtx.quoteRef}" for scope "${deferredCtx.scopeName}". Please process it as a version update for that specific quote.`,
          attachment,
          true
        );
      } else {
        sendMessage(`I've uploaded a document: ${attachment.name}`, attachment, true);
      }
    }
  }, [autoSendAttachment, isLoading, sendMessage, aiCompanion]);

  useEffect(() => {
    if (aiCompanion.pendingMessage && !isLoading) {
      const msg = aiCompanion.consumePendingMessage();
      if (msg) {
        sendMessage(msg);
      }
    }
  }, [aiCompanion.pendingMessage, isLoading, sendMessage, aiCompanion]);

  useEffect(() => {
    if (aiCompanion.fileUploadRequested) {
      const shouldTrigger = aiCompanion.consumeFileUploadRequest();
      if (shouldTrigger) {
        const timeoutId = setTimeout(() => {
          hiddenFileRef.current?.click();
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [aiCompanion.fileUploadRequested, aiCompanion]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleDismissAssistOptions = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, assistOptions: undefined } : m
    ));
  }, []);

  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0];

  const aiCollapsed = layoutContext?.aiCollapsed ?? false;
  const toggleAICollapsed = layoutContext?.toggleAICollapsed;

  if (aiCollapsed) {
    return (
      <aside
        className="h-full w-full flex flex-col bg-background/80 backdrop-blur-sm overflow-hidden items-center"
        data-testid="ai-conversation-pane"
        aria-label="AI Conversation (collapsed)"
      >
        <div className="h-12 flex items-center justify-center flex-shrink-0">
          {toggleAICollapsed && (
            <button
              onClick={toggleAICollapsed}
              className="flex items-center justify-center w-7 h-7 rounded-md text-foreground/60 hover:text-foreground transition-colors"
              title="Expand AI Companion"
              data-testid="button-toggle-ai-collapse"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative h-full w-full flex flex-col bg-background/80 backdrop-blur-sm overflow-hidden min-w-0"
      data-testid="ai-conversation-pane"
      aria-label="AI Conversation"
      onDragOver={(e) => { e.preventDefault(); if (!isLoading && !isUploading) setIsDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); if (!isLoading && !isUploading) setIsDragOver(true); }}
      onDragLeave={(e) => {
        e.preventDefault();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (isLoading || isUploading) return;
        const file = e.dataTransfer.files[0];
        if (file) handleFileDrop(file);
      }}
    >
      <input
        ref={hiddenFileRef}
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xlsx"
        style={{ display: 'none' }}
        data-testid="hidden-file-input"
      />
      {isDragOver && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-foreground/25 rounded-md pointer-events-none"
          data-testid="drop-zone-overlay"
        >
          <div className="flex flex-col items-center gap-2 text-foreground/60">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Drop file here</span>
          </div>
        </div>
      )}
      <header className="h-12 flex items-center border-b border-border/30 flex-shrink-0">
        <div className="flex items-center w-full">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 48 }}
          >
            {toggleAICollapsed && (
              <button
                onClick={toggleAICollapsed}
                className="flex items-center justify-center w-7 h-7 rounded-md text-foreground/60 hover:text-foreground transition-colors"
                title="Collapse AI Companion"
                data-testid="button-toggle-ai-collapse"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 flex items-center justify-between pr-3 overflow-hidden">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                AI Companion
              </span>
              <ProposalIndicator />
            </div>
          </div>
        </div>
      </header>

      {!messages.some(m => m.role === 'user') && (
        <div className="px-4 py-4 flex-shrink-0 min-w-0 overflow-hidden">
          {isDiscoveryMode ? (
            <>
              <h3 className="text-base font-semibold text-foreground mb-1">Let's get started</h3>
              <p className="text-sm text-muted-foreground break-words">
                Tell me about your renovation project and I'll help you set it up.
              </p>
              
              <div className="mt-4 space-y-2">
                <Button 
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => sendMessage("I want to renovate my kitchen")}
                  data-testid="button-suggestion-kitchen"
                >
                  I want to renovate my kitchen
                </Button>
                <Button 
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => sendMessage("I'm planning a bathroom remodel")}
                  data-testid="button-suggestion-bathroom"
                >
                  I'm planning a bathroom remodel
                </Button>
                <Button 
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => sendMessage("Help me plan a full home renovation")}
                  data-testid="button-suggestion-full-reno"
                >
                  Help me plan a full renovation
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-foreground mb-1">{contextualSuggestions.greeting}</h3>
              <p className="text-sm text-muted-foreground break-words">
                {contextualSuggestions.subtitle}
              </p>
              
              <div className="mt-4 space-y-2">
                {contextualSuggestions.suggestions.map((suggestion) => (
                  <Button 
                    key={suggestion.testId}
                    variant="secondary"
                    className="w-full justify-start"
                    onClick={() => sendMessage(suggestion.message)}
                    data-testid={suggestion.testId}
                  >
                    {suggestion.label}
                  </Button>
                ))}
              </div>
              {contextualSuggestions.frameSuggestions && contextualSuggestions.frameSuggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <span className="text-xs text-muted-foreground mb-1.5 block">
                    For this view
                  </span>
                  <div className="space-y-1.5">
                    {contextualSuggestions.frameSuggestions.map((fs) => (
                      <Button
                        key={fs.testId}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-8"
                        onClick={() => sendMessage(fs.message)}
                        data-testid={fs.testId}
                      >
                        {fs.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ProposalQueue />

      <div className="relative flex-1 min-w-0 overflow-hidden">
      <ScrollArea className="h-full" ref={scrollRef}>
        <div className="p-4 space-y-4 overflow-hidden">
          {(() => {
            const visibleMessages = messages.slice(Math.max(0, messages.length - visibleCount));
            const hiddenCount = messages.length - visibleMessages.length;
            return (
              <>
                {hiddenCount > 0 && (
                  <div className="flex justify-center pb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setVisibleCount(prev => prev + 20)}
                      data-testid="button-load-previous"
                    >
                      <ChevronUp className="w-3.5 h-3.5 mr-1.5" />
                      Load {Math.min(20, hiddenCount)} previous messages
                    </Button>
                  </div>
                )}
                {visibleMessages.map((message) => (
                  <div
                    key={message.id}
                    data-testid={`message-${message.role}-${message.id}`}
                  >
                    <MessageBubble
                      message={message}
                      isLastAssistantMessage={message.id === lastAssistantMessage?.id}
                      projectId={projectId}
                      onSendMessage={(msg) => sendMessage(msg)}
                      onNavigate={handleNavigate}
                      onDismissAssistOptions={handleDismissAssistOptions}
                      onConfirmQuote={handleConfirmQuote}
                      onConfirmQuoteVersion={handleConfirmQuoteVersion}
                      onConfirmInvoice={handleConfirmInvoice}
                      onCancelIngestion={handleCancelIngestion}
                      onRetryExtraction={handleRetryExtraction}
                    />
                  </div>
                ))}
              </>
            );
          })()}

          {isLoading && (() => {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            const hadAttachment = !!pendingQuoteContext || (lastUserMsg?.content || '').toLowerCase().includes('uploaded');
            const ctx = inferThinkingContext(lastUserMsg?.content || '', hadAttachment);
            return <ThinkingIndicator context={ctx} />;
          })()}
          
          {pendingProjectProposal && (
            <Card 
              ref={pendingFrameProposals.length === 0 ? proposalRef : undefined}
              className="border-border bg-sidebar-accent/20" 
              data-testid="project-proposal-card"
            >
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">New Project Proposal</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name: </span>
                    <span className="font-medium">{pendingProjectProposal.proposedDiff?.after?.name}</span>
                  </div>
                  {pendingProjectProposal.proposedDiff?.after?.project_type && (
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="capitalize">{pendingProjectProposal.proposedDiff?.after?.project_type}</span>
                    </div>
                  )}
                  {pendingProjectProposal.proposedDiff?.after?.description && (
                    <div>
                      <span className="text-muted-foreground">Description: </span>
                      <span>{pendingProjectProposal.proposedDiff?.after?.description}</span>
                    </div>
                  )}
                  {pendingProjectProposal.proposedDiff?.after?.location && (
                    <div>
                      <span className="text-muted-foreground">Location: </span>
                      <span>
                        {pendingProjectProposal.proposedDiff?.after?.location?.city || ''}
                        {pendingProjectProposal.proposedDiff?.after?.location?.city && pendingProjectProposal.proposedDiff?.after?.location?.country ? ', ' : ''}
                        {pendingProjectProposal.proposedDiff?.after?.location?.country || ''}
                      </span>
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground">{pendingProjectProposal.rationale}</p>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => acceptProposal.mutate(pendingProjectProposal.id)}
                    disabled={acceptProposal.isPending || rejectProposal.isPending}
                    data-testid="button-accept-project"
                  >
                    {acceptProposal.isPending ? (
                      <RenixSpinner className="mr-1.5" />
                    ) : (
                      <Check className="w-3 h-3 mr-1.5" />
                    )}
                    Create Project
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectProposal.mutate(pendingProjectProposal.id)}
                    disabled={acceptProposal.isPending || rejectProposal.isPending}
                    data-testid="button-reject-project"
                  >
                    <X className="w-3 h-3 mr-1.5" />
                    Modify
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {pendingFrameProposals.map((proposal, index) => (
            <Card 
              key={proposal.id}
              ref={index === 0 ? proposalRef : undefined}
              className="border-border bg-sidebar-accent/20" 
              data-testid={`proposal-card-${proposal.id}`}
            >
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Rocket className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {proposal.targetFrame} Change Proposal
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground">{proposal.rationale}</p>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => acceptProposal.mutate(proposal.id)}
                    disabled={acceptProposal.isPending || rejectProposal.isPending}
                    data-testid={`button-accept-${proposal.id}`}
                  >
                    {acceptProposal.isPending ? (
                      <RenixSpinner className="mr-1.5" />
                    ) : (
                      <Check className="w-3 h-3 mr-1.5" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectProposal.mutate(proposal.id)}
                    disabled={acceptProposal.isPending || rejectProposal.isPending}
                    data-testid={`button-reject-${proposal.id}`}
                  >
                    <X className="w-3 h-3 mr-1.5" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
      {hasNewMessages && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setHasNewMessages(false);
              const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
              if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
              }
            }}
            data-testid="button-new-messages"
          >
            <ArrowDown className="w-3.5 h-3.5 mr-1.5" />
            New messages
          </Button>
        </div>
      )}
      </div>

      <MessageInput
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        isUploading={isUploading}
        uploadProgress={progress}
        pendingAttachment={pendingAttachment}
        onClearAttachment={clearAttachment}
        onFileSelect={handleFileSelect}
        inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
    </aside>
  );
}
