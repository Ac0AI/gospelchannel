"use client";

import { useState } from "react";
import { signInWithPassword } from "@/lib/auth/client";

export function AdminLoginForm({ redirectTo = "/admin" }: { redirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || "Authentication failed");
      setLoading(false);
      return;
    }

    window.location.assign(redirectTo);
  };

  return (
    <div className="w-full max-w-sm space-y-6 rounded-3xl border border-rose-200/60 bg-white p-8 shadow-sm">
      <div className="text-center">
        <h1 className="font-serif text-2xl font-bold text-espresso">Admin Login</h1>
        <p className="mt-1 text-sm text-warm-brown">Gospel Channel Dashboard</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold text-espresso">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-rose-200/80 bg-linen px-4 py-3 text-sm text-espresso transition focus:border-rose-gold focus:outline-none focus:ring-2 focus:ring-rose-gold/20"
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
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
