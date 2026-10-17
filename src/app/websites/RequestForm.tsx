"use client";

import { useState, type FormEvent } from "react";
import styles from "./websites.module.css";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function RequestForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/websites/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ kind: "error", message: body.error ?? "Something went wrong. Please try again." });
        return;
      }
      setStatus({ kind: "sent", email: String(data.email ?? "") });
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again." });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className={styles.formDone} role="status">
        <p className={styles.formDoneTitle}>Thank you. We&apos;re on it.</p>
        <p>We&apos;ll build your church&apos;s new website and send the preview link to {status.email}.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="wr-website">Your church&apos;s current website</label>
        <input id="wr-website" name="website" type="text" inputMode="url" autoComplete="url" placeholder="yourchurch.org" required />
      </div>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="wr-email">Your email</label>
          <input id="wr-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className={styles.field}>
          <label htmlFor="wr-name">Your name <span>(optional)</span></label>
          <input id="wr-name" name="name" type="text" autoComplete="name" />
        </div>
      </div>
      <div className={styles.trap} aria-hidden="true">
        <label htmlFor="wr-company">Leave empty</label>
        <input id="wr-company" name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <button className={styles.submit} type="submit" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Sending…" : "Build my preview"}
      </button>
      {status.kind === "error" && <p className={styles.formError} role="alert">{status.message}</p>}
      <p className={styles.formNote}>Free. No call, no card. If you don&apos;t like it, that&apos;s the end of it.</p>
    </form>
  );
}
