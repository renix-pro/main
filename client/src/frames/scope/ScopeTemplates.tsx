import { useState } from 'react';
import { type LucideIcon, ChefHat, Bath, Home, Trees, ChevronRight, LayoutTemplate } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ScopeTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  groups: Array<{ name: string; items: string[] }>;
}

export const scopeTemplates: ScopeTemplate[] = [
  {
    id: 'kitchen',
    name: 'Kitchen Renovation',
    description: 'Complete kitchen remodel including demolition, cabinetry, appliances, and finishing.',
    icon: ChefHat,
    groups: [
      { name: 'Demolition', items: ['Remove existing cabinets', 'Remove countertops', 'Remove flooring'] },
      { name: 'Electrical', items: ['New lighting layout', 'Appliance circuits', 'Under-cabinet lighting'] },
      { name: 'Plumbing', items: ['Sink relocation', 'Dishwasher connection', 'Gas line'] },
      { name: 'Cabinetry & Countertops', items: ['Base cabinets', 'Wall cabinets', 'Island', 'Countertop material & installation'] },
      { name: 'Appliances', items: ['Refrigerator', 'Oven/Range', 'Dishwasher', 'Range hood'] },
      { name: 'Flooring', items: ['Subfloor preparation', 'Floor material & installation'] },
      { name: 'Finishing', items: ['Backsplash', 'Paint', 'Hardware'] },
    ],
  },
  {
    id: 'bathroom',
    name: 'Bathroom Renovation',
    description: 'Full bathroom renovation with plumbing, waterproofing, tiling, and fixtures.',
    icon: Bath,
    groups: [
      { name: 'Demolition', items: ['Remove fixtures', 'Remove tiles', 'Remove vanity'] },
      { name: 'Plumbing', items: ['Shower/tub rough-in', 'Vanity plumbing', 'Toilet installation'] },
      { name: 'Waterproofing', items: ['Shower membrane', 'Floor waterproofing'] },
      { name: 'Tiling', items: ['Floor tiles', 'Wall tiles', 'Shower tiles'] },
      { name: 'Fixtures', items: ['Vanity & basin', 'Shower screen/door', 'Mirror & cabinet', 'Towel rails & accessories'] },
      { name: 'Electrical', items: ['Exhaust fan', 'Lighting', 'Heated towel rail wiring'] },
    ],
  },
  {
    id: 'full-home',
    name: 'Full Home Renovation',
    description: 'Whole-house renovation covering kitchen, bathrooms, living spaces, and infrastructure.',
    icon: Home,
    groups: [
      { name: 'Kitchen', items: ['Full kitchen scope'] },
      { name: 'Bathrooms', items: ['Master bathroom', 'Secondary bathroom'] },
      { name: 'Living Spaces', items: ['Flooring', 'Paint & wall finishes', 'Lighting'] },
      { name: 'Bedrooms', items: ['Built-in wardrobes', 'Flooring', 'Paint'] },
      { name: 'Exterior', items: ['Facade', 'Windows & doors', 'Landscaping'] },
      { name: 'Infrastructure', items: ['Electrical upgrade', 'Plumbing', 'HVAC'] },
    ],
  },
  {
    id: 'outdoor-extension',
    name: 'Outdoor / Extension',
    description: 'Home extension or outdoor living space with structure, services, and landscaping.',
    icon: Trees,
    groups: [
      { name: 'Foundation & Structure', items: ['Foundation work', 'Framing', 'Roofing'] },
      { name: 'Enclosure', items: ['Windows & glazing', 'External cladding', 'Insulation'] },
      { name: 'Interior Fit-out', items: ['Flooring', 'Wall finishes', 'Ceiling'] },
      { name: 'Services', items: ['Electrical', 'Plumbing', 'HVAC extension'] },
      { name: 'Outdoor', items: ['Deck/patio', 'Landscaping', 'Fencing'] },
    ],
  },
];

interface ScopeTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (template: ScopeTemplate) => void;
}

export function ScopeTemplateDialog({ open, onOpenChange, onApply }: ScopeTemplateDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ScopeTemplate | null>(null);

  const handleClose = () => {
    setSelectedTemplate(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    setSelectedTemplate(null);
  };

  const handleApply = () => {
    if (selectedTemplate) {
      onApply(selectedTemplate);
      setSelectedTemplate(null);
      onOpenChange(false);
    }
  };

  const totalItems = (template: ScopeTemplate) =>
    template.groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="scope-template-dialog">
        <DialogHeader>
          <DialogTitle data-testid="scope-template-dialog-title">
            {selectedTemplate ? selectedTemplate.name : 'Scope Templates'}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate
              ? 'Review the scope structure before applying.'
              : 'Choose a template to quickly populate your scope tree.'}
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scopeTemplates.map((template) => {
                const Icon = template.icon;
                return (
                  <Card
                    key={template.id}
                    className="p-4 cursor-pointer hover-elevate"
                    onClick={() => setSelectedTemplate(template)}
                    data-testid={`scope-template-card-${template.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-md bg-foreground/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{template.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {template.groups.length} groups
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {totalItems(template)} items
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={handleClose}
                data-testid="scope-template-start-scratch"
              >
                Start from scratch
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {selectedTemplate.groups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{group.name}</p>
                  <div className="pl-4 space-y-0.5">
                    {group.items.map((item, itemIdx) => (
                      <p key={itemIdx} className="text-xs text-muted-foreground">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
              <Button
                variant="ghost"
                onClick={handleBack}
                data-testid="scope-template-back"
              >
                Back
              </Button>
              <Button
                onClick={handleApply}
                data-testid="scope-template-apply"
              >
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Use this template
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
