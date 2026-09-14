/**
 * RENIX vNext — Proposal Queue Component
 * 
 * Displays pending proposals in the AI conversation pane
 * with approve/reject actions for user decision.
 */

import { Check, X, Clock, FileEdit, Trash2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useProposals, usePendingProposals } from './ProposalContext';
import { Proposal, ProposalAction } from './types';

const actionIcons: Record<ProposalAction, typeof Plus> = {
  create: Plus,
  update: FileEdit,
  delete: Trash2,
};

const actionColors: Record<ProposalAction, string> = {
  create: 'text-status-approved',
  update: 'text-status-pending',
  delete: 'text-destructive',
};

interface ProposalCardProps {
  proposal: Proposal;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}

function ProposalCard({ proposal, onApprove, onReject, isProcessing }: ProposalCardProps) {
  const ActionIcon = actionIcons[proposal.action];
  const actionColor = actionColors[proposal.action];

  return (
    <Card 
      className="mb-3 border-border/50"
      data-testid={`proposal-card-${proposal.id}`}
    >
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-start gap-2">
          <ActionIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", actionColor)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight truncate">
              {proposal.title}
            </p>
            <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
              {proposal.category} · {proposal.entityType}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 py-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {proposal.description}
        </p>
      </CardContent>
      <CardFooter className="px-3 pb-3 pt-0 gap-2 flex-wrap">
        <Button
          size="sm"
          variant="default"
          onClick={onApprove}
          disabled={isProcessing}
          className="flex-1 min-w-[80px]"
          data-testid={`button-approve-${proposal.id}`}
        >
          <Check className="w-3.5 h-3.5 mr-1" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 min-w-[80px]"
          data-testid={`button-reject-${proposal.id}`}
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ProposalQueue() {
  const { approveProposal, rejectProposal, state } = useProposals();
  const pendingProposals = usePendingProposals();

  if (pendingProposals.length === 0) {
    return null;
  }

  return (
    <div 
      className="border-b border-sidebar-border"
      data-testid="proposal-queue"
    >
      <div className="px-3 py-2 flex items-center gap-2 bg-sidebar-accent/30">
        <AlertCircle className="w-4 h-4 text-[var(--signal-warning)]" />
        <span className="text-xs font-medium text-sidebar-foreground">
          Pending Approval
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5">
          {pendingProposals.length}
        </Badge>
      </div>
      <ScrollArea className="max-h-[300px]">
        <div className="p-3">
          {pendingProposals.map(proposal => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onApprove={() => approveProposal(proposal.id)}
              onReject={() => rejectProposal(proposal.id)}
              isProcessing={state.isProcessing}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ProposalIndicator() {
  const pendingProposals = usePendingProposals();
  
  if (pendingProposals.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="proposal-indicator">
      <Clock className="w-3.5 h-3.5 text-[var(--signal-warning)] animate-pulse" />
      <span className="text-xs text-[var(--signal-warning)] font-medium">
        {pendingProposals.length} pending
      </span>
    </div>
  );
}
