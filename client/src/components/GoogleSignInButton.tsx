import { useEffect, useRef, useCallback } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleSignInButton({ onCredential, text = 'continue_with' }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  const initializeGoogle = useCallback(() => {
    if (!window.google || !buttonRef.current || !GOOGLE_CLIENT_ID) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: { credential: string }) => {
        callbackRef.current(response.credential);
      },
    });

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      width: buttonRef.current.offsetWidth,
      text,
      shape: 'rectangular',
      logo_alignment: 'left',
    });
  }, [text]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    if (window.google) {
      initializeGoogle();
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', initializeGoogle);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);
  }, [initializeGoogle]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="w-full">
      <div
        ref={buttonRef}
        className="w-full flex justify-center"
        data-testid="button-google-signin"
      />
      <div className="relative flex items-center py-3">
        <div className="flex-1 border-t border-border" />
        <span className="px-3 text-xs text-muted-foreground uppercase tracking-wider">or</span>
        <div className="flex-1 border-t border-border" />
      </div>
    </div>
  );
}
