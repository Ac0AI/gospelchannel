"use client";

import { useState, useCallback } from "react";
import posthog from "posthog-js";

type FollowChurchButtonProps = {
  churchSlug: string;
  churchName: string;
  variant?: "hero" | "default";
};

export function FollowChurchButton({ churchSlug, churchName, variant = "default" }: FollowChurchButtonProps) {
  const [state, setState] = useState<"idle" | "form" | "submitting" | "done">("idle");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState("submitting");
    try {
      const res = await fetch("/api/church/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchSlug,
          email: email.trim(),
          name: name.trim() || undefined,
          companyWebsite: companyWebsite.trim() || undefined,
        }),
      });
      if (res.ok) {
        setState("done");
        posthog.capture("follow_church_completed", { church_slug: churchSlug, church_name: churchName, variant });
      } else {
        setState("form");
      }
    } catch {
      setState("form");
    }
  }, [churchSlug, churchName, companyWebsite, email, name, variant]);

  if (state === "done") {
    return (
      <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
        variant === "hero"
          ? "border border-white/30 bg-white/15 text-white backdrop-blur-sm"
          : "border border-green-200 bg-green-50 text-green-700"
      }`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Following
      </div>
    );
  }

  if (state === "form" || state === "submitting") {
    return (
      <form onSubmit={handleSubmit} className={`flex flex-col gap-2 rounded-2xl p-3 ${
        variant === "hero"
          ? "border border-white/20 bg-white/10 backdrop-blur-md"
          : "border border-rose-200/60 bg-white shadow-sm"
      }`}>
        <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
          <label htmlFor={`follow-company-${churchSlug}`}>Website</label>
          <input
            id={`follow-company-${churchSlug}`}
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={companyWebsite}
            onChange={(e) => setCompanyWebsite(e.target.value)}
          />
        </div>
        <p className={`text-xs font-medium ${variant === "hero" ? "text-white/80" : "text-muted-warm"}`}>
          Get updates from {churchName}
        </p>
        <input
          type="email"
          required
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`rounded-lg px-3 py-2 text-sm outline-none ${
            variant === "hero"
              ? "border border-white/20 bg-white/15 text-white placeholder:text-white/50"
              : "border border-rose-200 bg-linen text-espresso placeholder:text-muted-warm"
          }`}
        />
        <input
          type="text"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`rounded-lg px-3 py-2 text-sm outline-none ${
            variant === "hero"
              ? "border border-white/20 bg-white/15 text-white placeholder:text-white/50"
              : "border border-rose-200 bg-linen text-espresso placeholder:text-muted-warm"
          }`}
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={state === "submitting"}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              variant === "hero"
                ? "bg-white text-espresso hover:bg-white/90"
                : "bg-rose-gold text-white hover:bg-rose-gold-deep"
            }`}
          >
            {state === "submitting" ? "..." : "Follow"}
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            className={`rounded-full px-3 py-2 text-sm ${
              variant === "hero" ? "text-white/60 hover:text-white" : "text-muted-warm hover:text-espresso"
            }`}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      onClick={() => {
        setState("form");
        posthog.capture("follow_church_started", { church_slug: churchSlug, church_name: churchName, variant });
      }}
      className={`group inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
        variant === "hero"
          ? "border border-white/30 bg-white/15 text-white backdrop-blur-sm hover:bg-white/25"
          : "border border-rose-200 bg-white text-warm-brown hover:bg-blush-light hover:text-espresso"
      }`}
    >
      <svg className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
      Follow
    </button>
  );
}
