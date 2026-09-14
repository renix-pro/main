/**
 * RENIX vNext — Mobile Bottom Dock
 * 
 * Bottom navigation bar for mobile with 5 slots:
 * - Overview (LayoutGrid)
 * - Scope (List)
 * - Budget (Wallet)
 * - Documents (FileText)
 * - More (MoreHorizontal) - opens sheet with remaining frames
 */

import { useState } from 'react';
import { 
  LayoutGrid, 
  List, 
  Wallet, 
  FileText, 
  MoreHorizontal,
  Compass,
  FileStack,
  Receipt,
  PiggyBank,
  CheckCircle2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export type MobileFrame = 
  | 'overview' 
  | 'vision' 
  | 'scope' 
  | 'budget' 
  | 'quotes' 
  | 'invoices' 
  | 'financing' 
  | 'execution' 
  | 'documents';

interface MobileBottomDockProps {
  activeFrame: MobileFrame;
  onFrameChange: (frame: MobileFrame) => void;
  projectStatus?: 'open' | 'closed';
}

const PRIMARY_DOCK_ITEMS: { frame: MobileFrame; icon: typeof LayoutGrid; label: string }[] = [
  { frame: 'overview', icon: LayoutGrid, label: 'Overview' },
  { frame: 'budget', icon: Wallet, label: 'Budget' },
  { frame: 'quotes', icon: FileStack, label: 'Quotes' },
  { frame: 'invoices', icon: Receipt, label: 'Invoices' },
];

const MORE_FRAMES: { frame: MobileFrame; icon: typeof Compass; label: string }[] = [
  { frame: 'vision', icon: Compass, label: 'Vision' },
  { frame: 'scope', icon: List, label: 'Scope' },
  { frame: 'documents', icon: FileText, label: 'Docs' },
  { frame: 'financing', icon: PiggyBank, label: 'Financing' },
  { frame: 'execution', icon: CheckCircle2, label: 'Execution' },
];

export function MobileBottomDock({ 
  activeFrame, 
  onFrameChange,
  projectStatus = 'open'
}: MobileBottomDockProps) {
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const handleMoreFrameSelect = (frame: MobileFrame) => {
    onFrameChange(frame);
    setShowMoreSheet(false);
  };

  const isSecondaryFrameActive = MORE_FRAMES.some(item => item.frame === activeFrame);

  return (
    <>
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/50"
        data-testid="mobile-bottom-dock"
      >
        <div className="flex items-center justify-around h-14 px-2">
          {PRIMARY_DOCK_ITEMS.map(({ frame, icon: Icon, label }) => {
            const isActive = activeFrame === frame;
            return (
              <button
                key={frame}
                onClick={() => onFrameChange(frame)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                  isActive 
                    ? "text-foreground" 
                    : "text-muted-foreground"
                )}
                data-testid={`dock-${frame}`}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
          
          {/* More button */}
          <button
            onClick={() => setShowMoreSheet(true)}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
              isSecondaryFrameActive 
                ? "text-foreground" 
                : "text-muted-foreground"
            )}
            data-testid="dock-more"
          >
            <MoreHorizontal className={cn("h-5 w-5", isSecondaryFrameActive && "stroke-[2.5]")} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
        <div className="safe-area-bottom bg-background" />
      </nav>

      {/* More Frames Sheet */}
      <Sheet open={showMoreSheet} onOpenChange={setShowMoreSheet}>
        <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left text-sm font-medium text-muted-foreground">
              More Frames
            </SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pb-6">
            {MORE_FRAMES.map(({ frame, icon: Icon, label }) => {
              const isActive = activeFrame === frame;
              const isDisabled = false;
              
              return (
                <button
                  key={frame}
                  onClick={() => !isDisabled && handleMoreFrameSelect(frame)}
                  disabled={isDisabled}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-4 rounded-xl transition-all",
                    isActive 
                      ? "bg-foreground/10 text-foreground" 
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                    isDisabled && "opacity-40 cursor-not-allowed"
                  )}
                  data-testid={`more-sheet-${frame}`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default MobileBottomDock;
