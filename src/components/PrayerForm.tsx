"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

type PrayerFormProps = {
  churchSlug: string;
  churchName: string;
  onSubmitted?: () => void;
};

const confirmationVerses = [
  "The Lord hears you.",
  "Your prayer has been lifted up.",
  "God is near to all who call on him.",
  "The prayer of the righteous is powerful.",
];

export function PrayerForm({ churchSlug, churchName, onSubmitted }: PrayerFormProps) {
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [verse] = useState(() => confirmationVerses[Math.floor(Math.random() * confirmationVerses.length)]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim() || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/prayer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ churchSlug, content: content.trim(), authorName: authorName.trim() || undefined }),
        });
        if (res.ok) {
          setContent("");
          setAuthorName("");
          setSubmitted(true);
          onSubmitted?.();
        }
      } catch {}
      setSubmitting(false);
    },
    [content, authorName, churchSlug, submitting, onSubmitted]
  );

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-gold/10">
          <svg className="h-6 w-6 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="font-serif text-base font-semibold text-espresso">Amen</p>
          <p className="mt-1 text-sm italic text-warm-brown/70">{verse}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={`/prayerwall/church/${churchSlug}`}
            className="rounded-full bg-rose-gold px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
          >
            See all prayers for {churchName}
          </Link>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="rounded-full border border-rose-200/60 px-5 py-2 text-sm font-semibold text-warm-brown transition-colors hover:bg-blush-light hover:text-espresso"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={`Share a prayer for ${churchName}...`}
        maxLength={500}
        rows={3}
        className="w-full rounded-xl border border-rose-200/60 bg-linen px-4 py-3 text-sm text-espresso placeholder:text-muted-warm focus:border-rose-gold focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={50}
          className="flex-1 rounded-full border border-rose-200/60 bg-linen px-4 py-2 text-sm text-espresso placeholder:text-muted-warm focus:border-rose-gold focus:outline-none"
        />
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="rounded-full bg-rose-gold px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep disabled:opacity-50"
        >
          {submitting ? "..." : "Pray"}
        </button>
      </div>
    </form>
  );
}
