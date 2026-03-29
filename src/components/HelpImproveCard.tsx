"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export type MissingField = {
  key: string;
  label: string;
  placeholder: string;
};

type HelpImproveCardProps = {
  churchSlug: string;
  churchName: string;
  missingFields: MissingField[];
};

export function HelpImproveCard({ churchSlug, churchName, missingFields }: HelpImproveCardProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  if (missingFields.length < 2) return null;

  const filledCount = Object.values(values).filter((v) => v.trim().length > 0).length;

  async function submitInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const entries = Object.entries(values).filter(([, v]) => v.trim().length > 0);
    if (entries.length === 0) return;

    setSubmitting(true);
    setError("");

    const message = entries
      .map(([key, val]) => {
        const field = missingFields.find((f) => f.key === key);
        return `${field?.label ?? key}: ${val.trim()}`;
      })
      .join("\n");

    try {
      const response = await fetch("/api/church/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchSlug,
          kind: "profile_addition",
          field: entries.map(([k]) => k).join(","),
          message,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not send. Please try again.");
        setSubmitting(false);
        return;
      }

      setDone(true);
      setSubmitting(false);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setValues({});
      }, 1500);
    } catch {
      setError("Could not send. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-dashed border-rose-200 bg-linen-deep/50 px-5 py-6 text-center sm:px-8">
        <p className="text-sm font-medium text-espresso">Help improve this page</p>
        <ul className="mt-3 flex flex-wrap justify-center gap-2">
          {missingFields.slice(0, 4).map((f) => (
            <li key={f.key} className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs text-warm-brown">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
              {f.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-gold px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
        >
          Share what you know →
        </button>
        <p className="mt-3 text-xs text-muted-warm">
          Part of this church?{" "}
          <Link href={`/church/${churchSlug}/claim`} className="font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep">
            Claim this page →
          </Link>
        </p>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/35 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-rose-200/70 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mauve">Help improve</p>
                <h3 className="mt-1 font-serif text-xl font-semibold text-espresso">{churchName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-muted-warm transition-colors hover:bg-blush-light hover:text-espresso"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {done ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Thanks! Your contribution is queued for review.
              </p>
            ) : (
              <form onSubmit={submitInfo} className="mt-4 space-y-3">
                <p className="text-xs text-warm-brown">Fill in what you know. You don&apos;t need to fill everything.</p>
                {missingFields.slice(0, 4).map((f) => (
                  <div key={f.key}>
                    <label htmlFor={`improve-${f.key}`} className="mb-1 block text-xs font-semibold text-espresso">
                      {f.label}
                    </label>
                    <input
                      id={`improve-${f.key}`}
                      type="text"
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-xl border border-rose-200/80 bg-linen px-3 py-2 text-sm text-espresso placeholder:text-muted-warm/70 focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
                    />
                  </div>
                ))}

                {error && (
                  <p className="rounded-xl border border-rose-gold/30 bg-blush-light px-3 py-2 text-sm text-rose-gold-deep">
                    {error}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-warm-brown transition-colors hover:bg-blush-light"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || filledCount === 0}
                    className="rounded-full bg-rose-gold px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-gold-deep disabled:opacity-70"
                  >
                    {submitting ? "Sending..." : `Send${filledCount > 0 ? ` (${filledCount})` : ""}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
