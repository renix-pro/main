/**
 * RENIX vNext — Scope Frame Dialogs
 * 
 * Canon v1.4 Compliant
 * 
 * Dialogs for managing Scope nodes.
 * All dialogs are declarative, no operational semantics.
 */

import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import type { Scope } from './useScopeData';

interface ScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope?: Scope;
  onSave: (name: string, description?: string, isOptional?: boolean) => void;
}

export function ScopeDialog({ open, onOpenChange, scope, onSave }: ScopeDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isOptional, setIsOptional] = useState(false);

  useEffect(() => {
    if (open) {
      setName(scope?.name ?? '');
      setDescription(scope?.description ?? '');
      setIsOptional(scope?.isOptional ?? false);
    }
  }, [open, scope]);

  const handleSave = () => {
    onSave(name, description || undefined, isOptional);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-scope-title">
            {scope ? 'Edit Scope' : 'Add Scope'}
          </DialogTitle>
          <DialogDescription>
            A scope defines an independent unit of intended change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="scope-name">Name</Label>
            <Input
              id="scope-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Kitchen Renovation, Backyard Landscaping"
              data-testid="input-scope-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="scope-description">Description</Label>
            <Textarea
              id="scope-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="input-scope-description"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="scope-optional">Optional</Label>
              <p className="text-sm text-secondary">
                Mark this scope as optional for the project
              </p>
            </div>
            <Switch
              id="scope-optional"
              checked={isOptional}
              onCheckedChange={setIsOptional}
              data-testid="switch-scope-optional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-scope">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-scope">
            {scope ? 'Save' : 'Add Scope'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ open, onOpenChange, title, description, onConfirm }: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="dialog-delete-title">{title}</DialogTitle>
          <DialogDescription data-testid="dialog-delete-description">
            {description}
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
