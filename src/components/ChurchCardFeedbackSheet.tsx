"use client";

import { useState, type FormEvent } from "react";

type FeedbackKind = "data_issue" | "playlist_addition";

type ChurchCardFeedbackSheetProps = {
  churchSlug: string;
  churchName: string;
};

export function ChurchCardFeedbackSheet({ churchSlug, churchName }: ChurchCardFeedbackSheetProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("data_issue");
  const [field, setField] = useState("playlist");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/church/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          churchSlug,
          kind,
          field,
          playlistUrl: kind === "playlist_addition" ? playlistUrl : undefined,
          message,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not send feedback. Please try again.");
        setSubmitting(false);
        return;
      }

      setDone(true);
      setSubmitting(false);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setMessage("");
        setPlaylistUrl("");
        setField("playlist");
        setKind("data_issue");
      }, 900);
    } catch {
      setError("Could not send feedback. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-mauve transition-colors hover:text-rose-gold-deep"
      >
        Missing or wrong?
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/35 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-rose-200/70 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-mauve">Improve this church card</p>
                <h3 className="mt-1 font-serif text-xl font-semibold text-espresso">{churchName}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-muted-warm transition-colors hover:bg-blush-light hover:text-espresso"
                aria-label="Close feedback form"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {done ? (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Thanks. Your feedback is queued for review.
              </p>
            ) : (
              <form onSubmit={submitFeedback} className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKind("data_issue")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      kind === "data_issue"
                        ? "border-rose-gold bg-blush-light text-rose-gold-deep"
                        : "border-rose-200 text-warm-brown hover:border-blush"
                    }`}
                  >
                    Report data issue
                  </button>
                  <button
                    type="button"
                    onClick={() => setKind("playlist_addition")}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                      kind === "playlist_addition"
                        ? "border-rose-gold bg-blush-light text-rose-gold-deep"
                        : "border-rose-200 text-warm-brown hover:border-blush"
                    }`}
                  >
                    Add playlist link
                  </button>
                </div>

                {kind === "data_issue" ? (
                  <div>
                    <label htmlFor={`field-${churchSlug}`} className="mb-1 block text-xs font-semibold text-espresso">
                      Which part needs an update?
                    </label>
                    <select
                      id={`field-${churchSlug}`}
                      value={field}
                      onChange={(event) => setField(event.target.value)}
                      className="w-full rounded-xl border border-rose-200/80 bg-linen px-3 py-2 text-sm text-espresso focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
                    >
                      <option value="playlist">Playlist</option>
                      <option value="description">Description</option>
                      <option value="country">Country/Region</option>
                      <option value="thumbnail">Image/thumbnail</option>
                      <option value="metadata">Other metadata</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label htmlFor={`playlist-${churchSlug}`} className="mb-1 block text-xs font-semibold text-espresso">
                      Playlist URL
                    </label>
                    <input
                      id={`playlist-${churchSlug}`}
                      type="url"
                      required
                      value={playlistUrl}
                      onChange={(event) => setPlaylistUrl(event.target.value)}
                      placeholder="https://open.spotify.com/playlist/..."
                      className="w-full rounded-xl border border-rose-200/80 bg-linen px-3 py-2 text-sm text-espresso placeholder:text-muted-warm/70 focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor={`msg-${churchSlug}`} className="mb-1 block text-xs font-semibold text-espresso">
                    Message
                  </label>
                  <textarea
                    id={`msg-${churchSlug}`}
                    rows={3}
                    required
                    minLength={3}
                    maxLength={500}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell us what should be corrected or added..."
                    className="w-full resize-none rounded-xl border border-rose-200/80 bg-linen px-3 py-2 text-sm text-espresso placeholder:text-muted-warm/70 focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
                  />
                </div>

                {error ? (
                  <p className="rounded-xl border border-rose-gold/30 bg-blush-light px-3 py-2 text-sm text-rose-gold-deep">
                    {error}
                  </p>
                ) : null}

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
                    disabled={submitting}
                    className="rounded-full bg-rose-gold px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-gold-deep disabled:opacity-70"
                  >
                    {submitting ? "Sending..." : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
