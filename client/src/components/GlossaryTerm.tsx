import { type ReactNode } from 'react';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

const TERMS: Record<string, string> = {
  "total-budget": "The total amount you plan to spend on this project. This is your intent — it represents what you want to spend, not what you've committed to.",
  "allocation": "A portion of your budget assigned to a specific area of work. Allocations express how you plan to distribute your total budget.",
  "contingency": "A reserve amount set aside for unexpected costs. Can be a fixed amount or a percentage of the total budget.",
  "committed-cost": "The total of all accepted quotes and direct costs. This is what you've actually agreed to pay, not just planned.",
  "funding-gap": "The difference between your expected costs and your confirmed financing. A positive gap means you need more funding.",
  "confirmed-financing": "Financing sources that are secured and available — approved loans, available equity, or confirmed grants.",
  "planned-financing": "Financing you intend to use but haven't secured yet. This could be a loan application in progress.",
  "net-amount": "The price before tax. This is the base cost of goods or services.",
  "gross-amount": "The total price including tax. This is what you actually pay.",
  "direct-cost": "A cost that bypasses the quote pipeline. Use this for simple purchases where you don't need formal vendor quotes.",
};

interface GlossaryTermProps {
  term: string;
  children: ReactNode;
}

export function GlossaryTerm({ term, children }: GlossaryTermProps) {
  const definition = TERMS[term];
  if (!definition) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="border-b border-dotted border-current cursor-help"
            data-testid={`glossary-term-${term}`}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm">
          {definition}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
