"use client";

import { useState } from "react";
import { requestMagicLink } from "@/lib/auth/client";

function getMagicLinkErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "EXPIRED_TOKEN":
      return "That sign-in link has expired. Request a new one below.";
    case "INVALID_TOKEN":
      return "That sign-in link is invalid. Request a new one below.";
    case "ATTEMPTS_EXCEEDED":
      return "That sign-in link has already been used. Request a new one below.";
    case "new_user_signup_disabled":
      return "Your account could not be found. Please contact support or ask the admin to re-verify your claim.";
    default:
      return "That sign-in link could not be used. Request a new one below.";
  }
}

export function ChurchAdminLoginForm({
  redirectTo = "/church-admin",
  initialError = "",
}: {
  redirectTo?: string;
  initialError?: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState(initialError ? getMagicLinkErrorMessage(initialError) : "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const requestLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSent(false);

    const accessResponse = await fetch("/api/church-admin/access-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const accessPayload = (await accessResponse.json().catch(() => null)) as { error?: string } | null;
    if (!accessResponse.ok) {
      setError(accessPayload?.error || "No verified church access for this email");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (redirectTo && redirectTo !== "/church-admin") {
      params.set("redirect", redirectTo);
    }

    const errorCallbackURL = `/church-admin/login${params.size > 0 ? `?${params.toString()}` : ""}`;

    const { error: authError } = await requestMagicLink({
      email,
      callbackURL: redirectTo,
      errorCallbackURL,
    });

    if (authError) {
      const message = authError.message || "Unable to send sign-in link";
      const msg = message.toLowerCase();
      setError(
        msg.includes("signup") || msg.includes("not allowed")
          ? "Your account could not be found. This can happen if the verification did not complete fully. Please contact support or ask the admin to re-verify your claim."
          : message,
      );
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  const inputClass =
    "w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20";

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 rounded-3xl border border-rose-200/60 bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-espresso">Church Admin</h1>
        <p className="mt-1 text-sm text-warm-brown">
          Sign in with the same email that was verified on your church claim. We will email you a secure sign-in link.
        </p>
      </div>

      <form onSubmit={requestLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold text-espresso">
            Verified email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {sent && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            A sign-in link was sent to <span className="font-semibold">{email}</span>. Open the email and click the link to sign in.
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-gold-deep disabled:opacity-60"
        >
          {loading ? "Sending link..." : sent ? "Send another sign-in link" : "Email me a sign-in link"}
        </button>
      </form>
    </div>
  );
}
