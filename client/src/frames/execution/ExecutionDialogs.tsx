import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ExecutionTask, TaskResponsibility, ScopeNodeData } from './useExecutionData';

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: ExecutionTask;
  scopeNodes: ScopeNodeData[];
  onSave: (input: {
    title: string;
    scopeNodeId?: string | null;
    scopeNodeName?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    responsibility?: TaskResponsibility;
    notes?: string | null;
  }) => void;
}

function buildScopeLabel(node: ScopeNodeData, allNodes: ScopeNodeData[]): string {
  const parts: string[] = [node.name];
  let current = node;
  while (current.parentId) {
    const parent = allNodes.find(n => n.id === current.parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    current = parent;
  }
  return parts.join(' > ');
}

export function TaskDialog({ open, onOpenChange, task, scopeNodes, onSave }: TaskDialogProps) {
  const [title, setTitle] = useState('');
  const [scopeNodeId, setScopeNodeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [responsibilityType, setResponsibilityType] = useState<'me' | 'external' | 'unknown'>('me');
  const [responsibilityLabel, setResponsibilityLabel] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '');
      setScopeNodeId(task?.scopeNodeId || '__none__');
      setStartDate(task?.startDate ?? '');
      setEndDate(task?.endDate ?? '');
      setResponsibilityType(task?.responsibility?.type ?? 'me');
      setResponsibilityLabel(task?.responsibility?.label ?? '');
      setNotes(task?.notes ?? '');
    }
  }, [open, task]);

  const scopeOptions = useMemo(() => {
    return scopeNodes.map(node => ({
      id: node.id,
      label: buildScopeLabel(node, scopeNodes),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [scopeNodes]);

  const handleSave = () => {
    if (!title.trim()) return;
    const effectiveScopeId = scopeNodeId === '__none__' ? '' : scopeNodeId;
    const selectedScope = scopeNodes.find(s => s.id === effectiveScopeId);
    const selectedScopeLabel = selectedScope ? buildScopeLabel(selectedScope, scopeNodes) : null;
    const responsibility: TaskResponsibility = {
      type: responsibilityType,
      ...(responsibilityType === 'external' && responsibilityLabel ? { label: responsibilityLabel } : {}),
    };
    onSave({
      title: title.trim(),
      scopeNodeId: effectiveScopeId || null,
      scopeNodeName: selectedScopeLabel,
      startDate: startDate || null,
      endDate: endDate || null,
      responsibility,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="dialog-task-title">
            {task ? 'Edit Task' : 'Add Task'}
          </DialogTitle>
          <DialogDescription>
            Define a task for project execution.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Install kitchen cabinets"
              data-testid="input-task-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-scope">Scope</Label>
            <Select value={scopeNodeId} onValueChange={setScopeNodeId}>
              <SelectTrigger id="task-scope" data-testid="select-task-scope">
                <SelectValue placeholder="Select scope node" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {scopeOptions.map(opt => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-start-date">Start Date</Label>
              <Input
                id="task-start-date"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                data-testid="input-task-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-end-date">End Date</Label>
              <Input
                id="task-end-date"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                data-testid="input-task-end-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-responsibility">Responsibility</Label>
            <Select value={responsibilityType} onValueChange={(v) => setResponsibilityType(v as 'me' | 'external' | 'unknown')}>
              <SelectTrigger id="task-responsibility" data-testid="select-task-responsibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Me</SelectItem>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
            {responsibilityType === 'external' && (
              <Input
                value={responsibilityLabel}
                onChange={e => setResponsibilityLabel(e.target.value)}
                placeholder="e.g., ABC Contractors"
                data-testid="input-responsibility-label"
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes"
              data-testid="input-task-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-task" className="pt-[8px] pb-[8px] pl-[16px] pr-[16px] mt-[8px] mb-[8px]">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title.trim()} data-testid="button-save-task">
            {task ? 'Save' : 'Add Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, onOpenChange, taskTitle, onConfirm }: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-delete-title">Delete Task</DialogTitle>
          <DialogDescription data-testid="dialog-delete-description">
            Are you sure you want to delete &quot;{taskTitle}&quot;? This will be logged in the execution history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-delete">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} data-testid="button-confirm-delete">
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
