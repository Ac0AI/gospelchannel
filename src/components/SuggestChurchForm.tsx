"use client";

import { useState } from "react";
import posthog from "posthog-js";

type FormState = "idle" | "submitting" | "success" | "error";

const LANGUAGES = [
  { value: "", label: "Select language (optional)" },
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "Portuguese", label: "Portuguese" },
  { value: "Swedish", label: "Swedish" },
  { value: "Korean", label: "Korean" },
  { value: "German", label: "German" },
  { value: "French", label: "French" },
  { value: "Other", label: "Other" },
];

export function SuggestChurchForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: (data.get("name") as string) ?? "",
      city: (data.get("city") as string) ?? "",
      country: (data.get("country") as string) ?? "",
      website: (data.get("website") as string) ?? "",
      contactEmail: (data.get("contactEmail") as string) ?? "",
      denomination: (data.get("denomination") as string) ?? "",
      language: (data.get("language") as string) ?? "",
      playlistUrl: (data.get("playlistUrl") as string) ?? "",
      message: (data.get("message") as string) ?? "",
      companyWebsite: (data.get("companyWebsite") as string) ?? "",
    };

    try {
      const res = await fetch("/api/church/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setErrorMsg(err.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }

      setState("success");
      posthog.capture("suggest_church_submitted", { church_name: payload.name, country: payload.country, language: payload.language });
      form.reset();
    } catch (err) {
      posthog.captureException(err);
      setErrorMsg("Could not reach the server. Check your connection and try again.");
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/40 p-10 text-center shadow-sm">
        <p className="text-4xl" aria-hidden="true">🙏</p>
        <h2 className="mt-4 font-serif text-2xl font-semibold text-espresso">Thank You!</h2>
        <p className="mt-3 text-warm-brown">
          Your church suggestion has been received. We&apos;ll review it and add it to the community — you might just
          help someone discover their new worship home.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-6 rounded-full border border-rose-200 px-5 py-2.5 text-sm font-semibold text-warm-brown transition hover:bg-blush-light"
        >
          Suggest Another Church
        </button>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso placeholder:text-muted-warm/60 transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20";

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-3xl border border-rose-200/60 bg-white/80 p-8 shadow-sm backdrop-blur-sm"
    >
      <div className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="suggest-companyWebsite">Website</label>
        <input id="suggest-companyWebsite" name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-espresso">
          Church Name <span className="text-rose-gold">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={120}
          placeholder="e.g. Hillsong Stockholm"
          className={inputClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="mb-1.5 block text-sm font-semibold text-espresso">
            City
          </label>
          <input id="city" name="city" type="text" maxLength={80} placeholder="e.g. Stockholm" className={inputClass} />
        </div>
        <div>
          <label htmlFor="country" className="mb-1.5 block text-sm font-semibold text-espresso">
            Country
          </label>
          <input id="country" name="country" type="text" maxLength={60} placeholder="e.g. Sweden" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="website" className="mb-1.5 block text-sm font-semibold text-espresso">
            Church Website <span className="text-rose-gold">*</span>
          </label>
          <input
            id="website"
            name="website"
            type="url"
            required
            maxLength={300}
            placeholder="https://yourchurch.com"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="contactEmail" className="mb-1.5 block text-sm font-semibold text-espresso">
            Contact Email <span className="text-rose-gold">*</span>
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            maxLength={200}
            placeholder="worship@yourchurch.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="denomination" className="mb-1.5 block text-sm font-semibold text-espresso">
            Denomination
          </label>
          <input
            id="denomination"
            name="denomination"
            type="text"
            maxLength={80}
            placeholder="e.g. Pentecostal, Baptist..."
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="language" className="mb-1.5 block text-sm font-semibold text-espresso">
            Primary Worship Language
          </label>
          <select id="language" name="language" className={inputClass}>
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="playlistUrl" className="mb-1.5 block text-sm font-semibold text-espresso">
          Worship Playlist Link <span className="text-rose-gold">*</span>
        </label>
        <input
          id="playlistUrl"
          name="playlistUrl"
          type="url"
          required
          maxLength={500}
          placeholder="https://open.spotify.com/playlist/... or YouTube playlist link"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted-warm">Spotify playlist, YouTube playlist, or YouTube channel link</p>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-espresso">
          Why should people hear your church&apos;s worship?
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={500}
          placeholder="Tell us what makes your church's worship special..."
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
        className="w-full rounded-full bg-rose-gold px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-gold-deep hover:shadow-md disabled:opacity-60"
      >
        {state === "submitting" ? "Sending..." : "Suggest This Church"}
      </button>
    </form>
  );
}
