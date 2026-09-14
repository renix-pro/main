import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "renix_cookie_consent";

export function clearCookieConsent() {
  localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new Event("cookie-consent-cleared"));
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored !== "accepted") {
      const timer = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    function handleCleared() {
      setVisible(true);
    }
    window.addEventListener("cookie-consent-cleared", handleCleared);
    return () => window.removeEventListener("cookie-consent-cleared", handleCleared);
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 pointer-events-none"
      data-testid="cookie-consent-wrapper"
    >
      <div
        className="pointer-events-auto mx-auto max-w-lg w-full rounded-md border border-border bg-card text-card-foreground p-4 sm:p-5 shadow-lg animate-cookie-slide-up"
        data-testid="cookie-consent-banner"
      >
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed mb-3">
              We use essential cookies to keep you signed in and remember your preferences. No tracking cookies.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleAccept}
                data-testid="button-cookie-accept"
              >
                Accept
              </Button>
              <Link href="/privacy#cookies">
                <Button
                  variant="link"
                  size="sm"
                  className="text-muted-foreground"
                  data-testid="link-cookie-learn-more"
                >
                  Learn more
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
