import renixLogoPng from '@assets/RENIX_logo_1772248096351.png';

const SIZE_MAP = { xs: 14, sm: 20, md: 32, lg: 48, xl: 64 } as const;

interface RenixLoaderProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}

export function RenixLoader({ size = 'md', showLabel = false, className }: RenixLoaderProps) {
  const px = SIZE_MAP[size];
  const labelSize = size === 'xl' ? 'text-sm' : 'text-xs';

  return (
    <div
      className={`inline-flex flex-col items-center ${className || ''}`}
      role="status"
      aria-label="Loading"
      data-testid="renix-loader"
      style={{ gap: showLabel ? 8 : 0 }}
    >
      <img
        src={renixLogoPng}
        alt=""
        width={px}
        height={px}
        className="renix-pulse-anim"
        draggable={false}
      />

      {showLabel && (size === 'lg' || size === 'xl') && (
        <span
          className={`${labelSize} font-semibold tracking-widest text-foreground/60 renix-label`}
          data-testid="renix-loader-label"
        >
          RENIX
        </span>
      )}
    </div>
  );
}

export function RenixSpinner({ className }: { className?: string }) {
  return <RenixLoader size="xs" className={className} />;
}
