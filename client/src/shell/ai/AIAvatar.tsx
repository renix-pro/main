import renixLogoPng from '@assets/RENIX_logo_1772248096351.png';

const SIZE_MAP = { xs: 20, sm: 24, md: 32 } as const;

interface AIAvatarProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export function AIAvatar({ size = 'md', className }: AIAvatarProps) {
  const px = SIZE_MAP[size];

  return (
    <div
      className={`inline-flex items-center justify-center flex-shrink-0 ${className || ''}`}
      data-testid="ai-avatar"
      style={{ width: px, height: px }}
    >
      <img
        src={renixLogoPng}
        alt="AI"
        width={px}
        height={px}
        draggable={false}
        className="dark:invert"
      />
    </div>
  );
}
