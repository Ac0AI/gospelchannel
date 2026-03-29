"use client";

import { useState } from "react";

type Props = {
  churchSlug: string;
  currentWebsite?: string;
  currentEmail?: string;
};

export function ChurchAdminUpdateForm({ churchSlug, currentWebsite = "", currentEmail = "" }: Props) {
  const [website, setWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    const response = await fetch("/api/church-admin/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        churchSlug,
        website,
        contactEmail,
        playlistUrl,
        message,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(payload?.error || "Failed to submit update");
      setLoading(false);
      return;
    }

    setSaved(true);
    setWebsite("");
    setContactEmail("");
    setPlaylistUrl("");
    setMessage("");
    setLoading(false);
  };

  const inputClass =
    "w-full rounded-xl border border-rose-200/80 bg-white px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Official website
        </label>
        <input
          type="url"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder={currentWebsite || "https://yourchurch.org"}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Contact email
        </label>
        <input
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          placeholder={currentEmail || "worship@yourchurch.org"}
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Spotify playlist URL
        </label>
        <input
          type="url"
          value={playlistUrl}
          onChange={(event) => setPlaylistUrl(event.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          className={inputClass}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Note for review
        </label>
        <textarea
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Explain what changed or which playlist should be added."
          className="w-full rounded-xl border border-rose-200/80 bg-white px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-espresso px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-espresso/90 disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit update"}
        </button>
        {saved && <span className="text-sm font-semibold text-emerald-700">Sent to review</span>}
        {error && <span className="text-sm font-semibold text-red-700">{error}</span>}
      </div>
    </form>
  );
}
