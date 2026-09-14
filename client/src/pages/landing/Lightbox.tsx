import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LightboxProps {
  image: { src: string; label: string } | null;
  onClose: () => void;
}

export function Lightbox({ image, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!image) return;

    closeRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Image preview: ${image.label}`}
      data-testid="lightbox-overlay"
    >
      <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
        <Button
          ref={closeRef}
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white/80"
          onClick={onClose}
          data-testid="button-close-lightbox"
          aria-label="Close preview"
        >
          <X className="h-6 w-6" />
        </Button>
        <img
          src={image.src}
          alt={image.label}
          className="w-full rounded-lg shadow-2xl"
          loading="lazy"
          decoding="async"
        />
        <p className="text-center text-white/80 text-sm mt-3 font-medium">{image.label}</p>
      </div>
    </div>
  );
}
