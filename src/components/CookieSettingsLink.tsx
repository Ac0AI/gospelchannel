"use client";

import { useCookieConsent } from "./CookieBanner";

export function CookieSettingsLink() {
  const { reopen } = useCookieConsent();

  return (
    <button
      onClick={reopen}
      className="transition-colors hover:text-espresso"
    >
      Cookie Settings
    </button>
  );
}
