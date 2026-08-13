"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { useEffect, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";

type SearchVariant = "directory" | "directory_filters";

export function TrackedChurchSearchForm({
  variant,
  onSubmit,
  ...props
}: ComponentPropsWithoutRef<"form"> & { variant: SearchVariant }) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const query = String(data.get("q") || "").trim().slice(0, 80);
        const country = String(data.get("country") || "").trim().slice(0, 60);
        const language = String(data.get("language") || "").trim().slice(0, 40);

        posthog.capture("church_searched", {
          variant,
          query,
          has_query: Boolean(query),
          country: country || undefined,
          language: language || undefined,
          has_kids_filter: Boolean(data.get("kids")),
          has_service_times_filter: Boolean(data.get("serviceTimes")),
          has_music_filter: Boolean(data.get("music")),
        });
        onSubmit?.(event);
      }}
    />
  );
}

type ChurchProfileViewTrackerProps = {
  churchSlug: string;
  churchName: string;
  hasServiceTimes: boolean;
  hasDirections: boolean;
  hasWebsite: boolean;
  hasMusic: boolean;
  isClaimed: boolean;
};

export function ChurchProfileViewTracker(props: ChurchProfileViewTrackerProps) {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    posthog.capture("church_profile_viewed", {
      church_slug: props.churchSlug,
      church_name: props.churchName,
      has_service_times: props.hasServiceTimes,
      has_directions: props.hasDirections,
      has_website: props.hasWebsite,
      has_music: props.hasMusic,
      is_claimed: props.isClaimed,
    });
  }, [props]);

  return null;
}

export function ChurchClaimStartedTracker({
  churchSlug,
  churchName,
}: {
  churchSlug: string;
  churchName: string;
}) {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    posthog.capture("church_claim_started", {
      church_slug: churchSlug,
      church_name: churchName,
    });
  }, [churchName, churchSlug]);

  return null;
}

type TrackedChurchProfileLinkProps = {
  href: string;
  churchSlug: string;
  churchName: string;
  surface: string;
  prefetch?: boolean;
  className?: string;
  children: ReactNode;
};

export function TrackedChurchProfileLink({
  href,
  churchSlug,
  churchName,
  surface,
  ...props
}: TrackedChurchProfileLinkProps) {
  return (
    <Link
      {...props}
      href={href}
      onClick={() => {
        posthog.capture("church_profile_opened", {
          church_slug: churchSlug,
          church_name: churchName,
          surface,
        });
      }}
    />
  );
}

type ChurchVisitAction = "plan" | "directions" | "call" | "email" | "website" | "livestream";

type TrackedChurchActionLinkProps = ComponentPropsWithoutRef<"a"> & {
  churchSlug: string;
  churchName: string;
  action: ChurchVisitAction;
  surface: string;
};

export function TrackedChurchActionLink({
  churchSlug,
  churchName,
  action,
  surface,
  onClick,
  ...props
}: TrackedChurchActionLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        posthog.capture("church_visit_intent", {
          church_slug: churchSlug,
          church_name: churchName,
          action,
          surface,
        });
        onClick?.(event);
      }}
    />
  );
}
