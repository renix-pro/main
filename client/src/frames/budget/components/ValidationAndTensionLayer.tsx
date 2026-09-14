/**
 * RENIX vNext — Validation and Tension Layer
 * 
 * Canon v1.4 Compliant
 * Displays tension signals in neutral, factual tone.
 * No red/green indicators, no danger icons.
 */

interface TensionSignal {
  id: string;
  headline: string;
  explanation: string;
  resolutionHint?: string;
  relatedFrame?: string;
}

interface ValidationAndTensionLayerProps {
  signals: TensionSignal[];
  onNavigateToFrame?: (frame: string) => void;
}

export function ValidationAndTensionLayer({ signals, onNavigateToFrame }: ValidationAndTensionLayerProps) {
  if (signals.length === 0) return null;

  return (
    <section className="space-y-4" data-testid="tension-layer">
      <h2 className="text-lg font-semibold uppercase tracking-wide">
        Attention
      </h2>

      <div className="space-y-3">
        {signals.map(signal => (
          <div 
            key={signal.id}
            className="renix-surface p-4"
            data-testid={`tension-card-${signal.id}`}
          >
            <p className="text-sm font-semibold mb-1">
              {signal.headline}
            </p>
            <p className="text-sm text-secondary">
              {signal.explanation}
            </p>
            {signal.resolutionHint && signal.relatedFrame && onNavigateToFrame && (
              <button
                onClick={() => onNavigateToFrame(signal.relatedFrame!)}
                className="text-sm underline-offset-2 hover:underline mt-2"
                data-testid={`button-tension-resolve-${signal.id}`}
              >
                {signal.resolutionHint}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export type { TensionSignal };
