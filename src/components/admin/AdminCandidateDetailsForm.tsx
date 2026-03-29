"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postAdminAction } from "@/lib/admin-client";
import { loadWebsitePreview } from "@/lib/admin-website-preview-client";

type Props = {
  churchSlug: string;
  initialName: string;
  initialWebsite?: string;
  initialEmail?: string;
  initialLocation?: string;
  initialCountry?: string;
};

export function AdminCandidateDetailsForm({
  churchSlug,
  initialName,
  initialWebsite = "",
  initialEmail = "",
  initialLocation = "",
  initialCountry = "",
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState(initialWebsite);
  const [email, setEmail] = useState(initialEmail);
  const [location, setLocation] = useState(initialLocation);
  const [country, setCountry] = useState(initialCountry);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Auto-resolve email from website if not already set
  useEffect(() => {
    if (email || !initialWebsite) return;
    let cancelled = false;
    loadWebsitePreview(initialWebsite)
      .then((preview) => {
        if (!cancelled && preview.contactEmail) {
          setEmail(preview.contactEmail);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialWebsite]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    try {
      if (!name.trim()) {
        throw new Error("Church name is required");
      }

      await postAdminAction("/api/admin/candidates", {
        slug: churchSlug,
        name,
        website,
        email,
        location,
        country,
      });

      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Church name
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Holy Trinity Bristol"
          className="w-full rounded-2xl border border-rose-200/80 bg-white px-3 py-2 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Website
        </label>
        <input
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          placeholder="https://example.org"
          className="w-full rounded-2xl border border-rose-200/80 bg-white px-3 py-2 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
          Email
        </label>
        <input
          type="text"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="music@church.org"
          className="w-full rounded-2xl border border-rose-200/80 bg-white px-3 py-2 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
            City / Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Stockholm"
            className="w-full rounded-2xl border border-rose-200/80 bg-white px-3 py-2 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-warm-brown">
            Country
          </label>
          <input
            type="text"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="Sweden"
            className="w-full rounded-2xl border border-rose-200/80 bg-white px-3 py-2 text-sm text-espresso outline-none transition focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-espresso px-4 py-2 text-xs font-semibold text-white transition hover:bg-espresso/90 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save details"}
        </button>
        {saved && <span className="text-xs font-semibold text-emerald-700">Saved</span>}
        {error && <span className="text-xs font-semibold text-red-700">{error}</span>}
      </div>
    </form>
  );
}
