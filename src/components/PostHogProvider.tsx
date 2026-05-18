"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "memory",
    person_profiles: "never",
    disable_session_recording: true,
    disable_surveys: true,
    disable_scroll_properties: true,
    advanced_disable_decide: true,
    // Real-user Core Web Vitals (LCP/CLS/INP) — the metrics Google ranks on.
    // Must be set explicitly client-side: advanced_disable_decide blocks the
    // remote config that would otherwise toggle this. network_timing stays
    // off to keep the cookieless/minimal posture (web vitals only, no
    // per-resource timing payloads).
    capture_performance: {
      web_vitals: true,
      network_timing: false,
      web_vitals_allowed_metrics: ["LCP", "CLS", "INP"],
    },
    on_xhr_error: () => {},
  });
  posthog.analyticsDefaultEndpoint = "/e";
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url = url + "?" + searchParams.toString();
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  );
}
