"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "submitting" | "sent" | "error";

export function ChurchContactButton({ churchSlug, churchName }: { churchSlug: string; churchName: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function reset() {
    setStatus("idle");
    setErrorMessage(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Honeypot — real users leave this empty.
    if (data.get("website_url")) {
      setStatus("sent");
      form.reset();
      return;
    }

    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      message: String(data.get("message") || "").trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
      setErrorMessage("Please fill in your name, email, and a short message.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/church/${churchSlug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Could not send message. Please try again later.");
      }

      setStatus("sent");
      form.reset();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not send message.");
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 text-espresso underline decoration-rose-gold/40 underline-offset-2 hover:text-rose-gold"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
        Contact this church
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/50 px-4 py-6 backdrop-blur-sm">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="church-contact-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="church-contact-title" className="font-serif text-xl font-semibold text-espresso">
                  Contact {churchName}
                </h2>
                <p className="mt-1 text-sm text-warm-brown">
                  Your message will be forwarded to the church. We never share your address.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-warm-brown hover:bg-linen-deep hover:text-espresso"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {status === "sent" ? (
              <div className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-espresso">
                <p className="font-semibold">Message sent.</p>
                <p className="mt-1 text-warm-brown">
                  We forwarded your note to {churchName}. They will reply to your email directly if they would like to.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 inline-flex rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white hover:bg-rose-gold-deep"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                {/* Honeypot — hidden from real users, attractive to bots */}
                <input
                  type="text"
                  name="website_url"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />

                <div>
                  <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    Your name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    className="mt-1 block w-full rounded-lg border border-rose-200/70 bg-linen px-3 py-2 text-sm text-espresso focus:border-rose-gold focus:outline-none focus:ring-1 focus:ring-rose-gold"
                  />
                </div>

                <div>
                  <label htmlFor="contact-email" className="block text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    Your email
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="mt-1 block w-full rounded-lg border border-rose-200/70 bg-linen px-3 py-2 text-sm text-espresso focus:border-rose-gold focus:outline-none focus:ring-1 focus:ring-rose-gold"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={4}
                    className="mt-1 block w-full rounded-lg border border-rose-200/70 bg-linen px-3 py-2 text-sm text-espresso focus:border-rose-gold focus:outline-none focus:ring-1 focus:ring-rose-gold"
                  />
                </div>

                {errorMessage && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-gold-deep">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="inline-flex w-full items-center justify-center rounded-full bg-rose-gold px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-gold-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "submitting" ? "Sending..." : "Send message"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
