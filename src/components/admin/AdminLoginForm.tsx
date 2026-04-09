"use client";

import { useState } from "react";
import { requestEmailOtp, signInWithEmailOtp, signInWithPassword } from "@/lib/auth/client";

type Mode = "otp" | "password";
type Step = "email" | "otp" | "password";

export function AdminLoginForm({ redirectTo = "/admin" }: { redirectTo?: string }) {
  const [mode, setMode] = useState<Mode>("otp");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const { error: err } = await requestEmailOtp({ email });
      if (err) {
        setError(err.message || "Could not send code");
        return;
      }
      setStep("otp");
      setInfo(`We sent a 6-digit code to ${email}. Check your inbox (and spam).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await signInWithEmailOtp({ email, otp });
      if (err) {
        setError(err.message || "Invalid or expired code");
        return;
      }
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await signInWithPassword({ email, password });
      if (err) {
        setError(err.message || "Authentication failed");
        return;
      }
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setStep("email");
    setError("");
    setInfo("");
    setOtp("");
    setPassword("");
  }

  const inputClass =
    "w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20";

  return (
    <div className="w-full max-w-sm space-y-6 rounded-3xl border border-rose-200/60 bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-espresso">Admin Login</h1>
        <p className="mt-1 text-sm text-warm-brown">Gospel Channel Dashboard</p>
      </div>

      <div className="flex gap-1 rounded-full bg-linen p-1">
        <button
          type="button"
          onClick={() => switchMode("otp")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "otp"
              ? "bg-rose-gold text-white shadow-sm"
              : "text-warm-brown hover:text-espresso"
          }`}
        >
          Email code
        </button>
        <button
          type="button"
          onClick={() => switchMode("password")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "password"
              ? "bg-rose-gold text-white shadow-sm"
              : "text-warm-brown hover:text-espresso"
          }`}
        >
          Password
        </button>
      </div>

      {mode === "otp" && step === "email" && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-espresso">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-gold/30 bg-blush-light p-3 text-sm text-rose-gold-deep">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-gold-deep disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send sign-in code"}
          </button>
        </form>
      )}

      {mode === "otp" && step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          {info && (
            <div className="rounded-xl bg-linen p-3 text-sm text-warm-brown">{info}</div>
          )}
          <div>
            <label htmlFor="otp" className="mb-1 block text-sm font-semibold text-espresso">
              6-digit code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} text-center font-mono text-lg tracking-[0.4em]`}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-gold/30 bg-blush-light p-3 text-sm text-rose-gold-deep">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-gold-deep disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => { setStep("email"); setOtp(""); setError(""); setInfo(""); }}
            className="w-full text-center text-xs text-warm-brown hover:text-espresso"
          >
            Use a different email
          </button>
        </form>
      )}

      {mode === "password" && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="email-pw" className="mb-1 block text-sm font-semibold text-espresso">
              Email
            </label>
            <input
              id="email-pw"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-espresso">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-gold/30 bg-blush-light p-3 text-sm text-rose-gold-deep">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-rose-gold px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-rose-gold-deep disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
