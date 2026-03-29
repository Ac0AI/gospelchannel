"use client";

import { useState } from "react";
import { requestEmailOtp, signInWithEmailOtp } from "@/lib/auth/client";

type Step = "email" | "code";

export function ChurchAdminLoginForm({ redirectTo = "/church-admin" }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

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

    const { error: authError } = await requestEmailOtp({ email });

    if (authError) {
      const message = authError.message || "Unable to send sign-in code";
      const msg = message.toLowerCase();
      setError(
        msg.includes("signup") || msg.includes("not allowed")
          ? "Your account could not be found. This can happen if the verification did not complete fully. Please contact support or ask the admin to re-verify your claim."
          : message,
      );
      setLoading(false);
      return;
    }

    setStep("code");
    setLoading(false);
  };

  const verifyCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await signInWithEmailOtp({
      email,
      otp: token,
    });

    if (authError) {
      setError(authError.message || "Invalid sign-in code");
      setLoading(false);
      return;
    }

    window.location.assign(redirectTo);
  };

  const inputClass =
    "w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20";

  return (
    <div className="mx-auto w-full max-w-sm space-y-6 rounded-3xl border border-rose-200/60 bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-espresso">Church Admin</h1>
        <p className="mt-1 text-sm text-warm-brown">
          Sign in with the same email that was verified on your church claim.
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={requestCode} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-gold-deep disabled:opacity-60"
          >
            {loading ? "Sending code..." : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            A sign-in code was sent to <span className="font-semibold">{email}</span>.
          </div>

          <div>
            <label htmlFor="token" className="mb-1 block text-sm font-semibold text-espresso">
              6-digit code
            </label>
            <input
              id="token"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className={inputClass}
            />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setToken("");
                setError("");
              }}
              className="flex-1 rounded-full border border-rose-200 px-6 py-3 text-sm font-semibold text-warm-brown transition hover:bg-blush-light"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-gold-deep disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
