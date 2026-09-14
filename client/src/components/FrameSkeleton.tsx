import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function OverviewSkeleton() {
  return (
    <div className="h-full space-y-4" data-testid="skeleton-overview">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-12 max-md:grid-cols-1 gap-4">
        <Card className="col-span-5 max-md:col-span-1 p-4 space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </Card>
        <Card className="col-span-7 max-md:col-span-1 p-4 space-y-3">
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </Card>
      </div>

      <Card className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function VisionSkeleton() {
  return (
    <div className="h-full space-y-4" data-testid="skeleton-vision">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>

      <div className="space-y-1">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
        <Skeleton className="h-32 w-full mb-3 rounded-md" />
        <Skeleton className="h-48 w-full mb-3 rounded-md" />
        <Skeleton className="h-40 w-full mb-3 rounded-md" />
        <Skeleton className="h-48 w-full mb-3 rounded-md" />
        <Skeleton className="h-32 w-full mb-3 rounded-md" />
        <Skeleton className="h-40 w-full mb-3 rounded-md" />
      </div>

      <div className="pt-4 border-t border-border/30">
        <div className="flex flex-col md:flex-row md:items-start gap-6 md:gap-12">
          <div className="flex-1 flex gap-2 flex-wrap">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <div className="md:w-[200px] shrink-0 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScopeSkeleton() {
  return (
    <div className="h-full space-y-4" data-testid="skeleton-scope">
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <Skeleton className="h-8 w-8 rounded-md shrink-0" />
        <div className="space-y-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-10" />
        </div>
      </div>

      <div className="space-y-2">
        {[0, 0, 16, 16, 32, 0].map((indent, i) => (
          <div key={i} className="flex items-center gap-2 py-2" style={{ paddingLeft: indent }}>
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className={`h-4 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BudgetSkeleton() {
  return (
    <div className="space-y-4" data-testid="skeleton-budget">
      <div className="renix-grid items-start">
        <div className="renix-col-primary space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </Card>
          ))}
        </div>
        <div className="renix-col-secondary flex items-center justify-center">
          <Skeleton className="h-40 w-40 rounded-full" />
        </div>
      </div>

      <div className="space-y-2">
        {[0, 0, 16, 16, 0].map((indent, i) => (
          <div key={i} className="flex items-center gap-2 py-2" style={{ paddingLeft: indent }}>
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className={`h-4 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuotesSkeleton() {
  return (
    <div className="h-full w-full bg-muted/20 dark:bg-muted/10 flex flex-col" data-testid="skeleton-quotes">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-1/3" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InvoicesSkeleton() {
  return (
    <div className="h-full space-y-4" data-testid="skeleton-invoices">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        {[0, 16, 16, 0, 16, 0].map((indent, i) => (
          <div key={i} className="flex items-center gap-2 py-2" style={{ paddingLeft: indent }}>
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className={`h-4 ${indent > 0 ? 'w-1/2' : 'w-2/3'}`} />
            {indent > 0 && <Skeleton className="h-4 w-16 ml-auto shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FinancingSkeleton() {
  return (
    <div className="space-y-6" data-testid="skeleton-financing">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-2/3" />
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-32 w-full rounded-md" />
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ExecutionSkeleton() {
  return (
    <div className="h-full space-y-4" data-testid="skeleton-execution">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1 p-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function DocumentsSkeleton() {
  return (
    <div className="h-full space-y-4" data-testid="skeleton-documents">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-md" />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-border/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-8 w-8 rounded-md shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              <Skeleton className="h-3 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

