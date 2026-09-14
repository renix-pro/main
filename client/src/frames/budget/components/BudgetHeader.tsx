/**
 * RENIX vNext — Budget Header
 * 
 * Canon v1.4 Compliant
 * Simple text-only header with title and subtitle.
 * Pure black/white styling, no borders.
 */

export function BudgetHeader() {
  return (
    <header data-testid="budget-header">
      <p className="text-sm text-muted-foreground">
        Project financial intent
      </p>
    </header>
  );
}
