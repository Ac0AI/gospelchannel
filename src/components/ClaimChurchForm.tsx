"use client";

import { useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";

type FormState = "idle" | "submitting" | "success" | "error";

type Props = {
  slug: string;
  churchName: string;
};

export function ClaimChurchForm({ slug, churchName }: Props) {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      churchSlug: slug,
      name: (data.get("name") as string) ?? "",
      role: (data.get("role") as string) ?? "",
      email: (data.get("email") as string) ?? "",
      message: (data.get("message") as string) ?? "",
      companyWebsite: (data.get("companyWebsite") as string) ?? "",
    };

    try {
      const res = await fetch("/api/church/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setErrorMsg(err.error ?? "Something went wrong.");
        setState("error");
        return;
      }

      setState("success");
      posthog.capture("claim_church_submitted", { church_slug: slug, church_name: churchName });
      form.reset();
    } catch (err) {
      posthog.captureException(err);
      setErrorMsg("Could not reach the server.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/40 p-10 shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-semibold text-espresso">Claim Submitted!</h2>
          <p className="mt-3 text-warm-brown">
            We&apos;ll review your claim within 48 hours and notify you via email. Once approved, you can sign in with the same email to manage your church&apos;s profile.
          </p>
          <Link
            href={`/church/${slug}`}
            className="mt-6 inline-flex rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-warm-brown transition hover:bg-blush-light"
          >
            Back to {churchName}
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso placeholder:text-muted-warm/60 transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20";

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Link href={`/church/${slug}`} className="mb-6 inline-flex text-sm font-medium text-rose-gold hover:text-rose-gold-deep">
        ← Back to {churchName}
      </Link>

      <div className="rounded-3xl border border-rose-200/60 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
        <h1 className="font-serif text-2xl font-bold text-espresso">Claim {churchName}</h1>
        <p className="mt-2 text-sm text-warm-brown">
          Are you part of this church&apos;s leadership or worship team? Let us know and we&apos;ll verify your connection
          so you can help keep the profile up to date.
        </p>
        <p className="mt-2 text-xs text-muted-warm">
          We review all claims within 48 hours and will reach out via email.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor={`claim-companyWebsite-${slug}`}>Website</label>
            <input
              id={`claim-companyWebsite-${slug}`}
              name="companyWebsite"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-semibold text-espresso">
              Your Name <span className="text-rose-gold">*</span>
            </label>
            <input id="name" name="name" type="text" required maxLength={120} placeholder="John Doe" className={inputClass} />
          </div>

          <div>
            <label htmlFor="role" className="mb-1 block text-sm font-semibold text-espresso">
              Your Role / Title
            </label>
            <input id="role" name="role" type="text" maxLength={100} placeholder="Worship Leader, Pastor, etc." className={inputClass} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-espresso">
              Email <span className="text-rose-gold">*</span>
            </label>
            <input id="email" name="email" type="email" required maxLength={200} placeholder="you@church.com" className={inputClass} />
          </div>

          <div>
            <label htmlFor="message" className="mb-1 block text-sm font-semibold text-espresso">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              maxLength={500}
              placeholder="Tell us how you're connected to this church..."
              className="w-full resize-none rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso placeholder:text-muted-warm/60 transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
            />
          </div>

          {state === "error" && errorMsg && (
            <div className="rounded-xl border border-rose-gold/30 bg-blush-light p-3 text-sm text-rose-gold-deep">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-gold-deep disabled:opacity-60"
          >
            {state === "submitting" ? "Sending..." : "Submit Claim"}
          </button>
        </form>
      </div>
    </div>
  );
}
