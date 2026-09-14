/**
 * RENIX vNext — Project Settings (READ-ONLY)
 * 
 * Canon v1.4 Compliant — Phase 12 Addendum
 * 
 * Regional settings are PART OF PROJECT IDENTITY.
 * They are captured AT PROJECT CREATION and are IMMUTABLE.
 * 
 * This component provides READ-ONLY display of:
 * - Currency (ISO code)
 * - Measurement system (metric | imperial)
 * - Locale / formatting (dates, numbers)
 * 
 * There is NO post-creation edit capability.
 */

import { useState } from 'react';
import { Globe, DollarSign, Calendar, Hash, Ruler, Lock } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectSettingsDialog({ open, onOpenChange }: ProjectSettingsDialogProps) {
  const { projectName, regionalContext } = useProject();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <DialogTitle className="text-foreground">
              Regional Settings
            </DialogTitle>
          </div>
          <DialogDescription>
            {projectName} — Fixed project context
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div 
            className="flex items-center gap-2 p-3 border border-divider bg-surface"
          >
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Regional settings are fixed for this project.
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label 
                className="flex items-center gap-2 text-sm font-medium text-foreground"
              >
                <Globe className="h-4 w-4 text-muted-foreground" />
                Country / Region
              </Label>
              <div 
                className="px-3 py-2 border border-divider bg-surface"
                data-testid="text-country"
              >
                <span className="text-foreground">
                  {regionalContext.countryName}
                </span>
              </div>
            </div>

            <Separator className="bg-divider" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label 
                  className="text-xs flex items-center gap-1 text-muted-foreground"
                >
                  <DollarSign className="h-3 w-3" /> Currency
                </Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" data-testid="badge-currency">
                    {regionalContext.currencySymbol} {regionalContext.currency}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label 
                  className="text-xs flex items-center gap-1 text-muted-foreground"
                >
                  <Calendar className="h-3 w-3" /> Date Format
                </Label>
                <Badge variant="outline" data-testid="badge-date-format">
                  {regionalContext.dateFormat}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label 
                  className="text-xs flex items-center gap-1 text-muted-foreground"
                >
                  <Hash className="h-3 w-3" /> Number Format
                </Label>
                <Badge variant="outline" data-testid="badge-number-format">
                  {regionalContext.numberFormat === 'comma-period' && '1,234.56'}
                  {regionalContext.numberFormat === 'period-comma' && '1.234,56'}
                  {regionalContext.numberFormat === 'space-comma' && '1 234,56'}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label 
                  className="text-xs flex items-center gap-1 text-muted-foreground"
                >
                  <Ruler className="h-3 w-3" /> Measurements
                </Label>
                <Badge variant="outline" data-testid="badge-measurement">
                  {regionalContext.measurementSystem === 'metric' ? 'Metric (m, m²)' : 'Imperial (ft, ft²)'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-settings">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectSettingsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        data-testid="button-project-settings"
      >
        <Globe className="h-4 w-4" />
      </Button>
      <ProjectSettingsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
