"use client";

import { useState, useSyncExternalStore, createContext, useContext, useCallback } from "react";
import posthog from "posthog-js";

const CookieConsentContext = createContext<{ reopen: () => void }>({ reopen: () => {} });
const SERVER_SNAPSHOT = false;

function subscribeToConsent() {
  return () => {};
}

function shouldAutoShowBanner() {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  return !window.localStorage.getItem("cookie_consent");
}

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}

export function CookieBanner({ children }: { children: React.ReactNode }) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [forcedOpen, setForcedOpen] = useState(false);
  const autoShow = useSyncExternalStore(subscribeToConsent, shouldAutoShowBanner, () => SERVER_SNAPSHOT);
  const visible = forcedOpen || (autoShow && !hasInteracted);

  const reopen = useCallback(() => {
    setForcedOpen(true);
  }, []);

  function accept() {
    localStorage.setItem("cookie_consent", "yes");
    posthog.set_config({ persistence: "localStorage+cookie" });
    posthog.opt_in_capturing({
      captureEventName: "cookie_consent_given",
      captureProperties: { consent: "accepted" },
    });
    setHasInteracted(true);
    setForcedOpen(false);
  }

  function decline() {
    localStorage.setItem("cookie_consent", "no");
    posthog.opt_out_capturing();
    setHasInteracted(true);
    setForcedOpen(false);
  }

  return (
    <CookieConsentContext.Provider value={{ reopen }}>
      {children}
      {visible && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
          <div className="mx-auto max-w-lg rounded-2xl border border-rose-200/60 bg-white p-5 shadow-lg">
            <p className="text-sm leading-relaxed text-warm-brown">
              <span className="mr-1.5 inline-block text-base">🍪</span>
              Only Jesus could feed thousands with loaves and fish. All we can offer is cookies.
            </p>
            <p className="mt-2 text-xs text-warm-brown/60">
              We use cookies and analytics to improve your experience.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={accept}
                className="rounded-full bg-espresso px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-warm-brown"
              >
                Accept
              </button>
              <button
                onClick={decline}
                className="rounded-full border border-espresso/15 px-5 py-2 text-sm font-semibold text-espresso transition-colors hover:bg-linen-deep/50"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </CookieConsentContext.Provider>
  );
}
