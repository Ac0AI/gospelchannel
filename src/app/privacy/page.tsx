import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "GospelChannel privacy policy - how we handle your data.",
  alternates: { canonical: "https://gospelchannel.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[760px] px-5 pt-14 pb-24 sm:px-12 sm:pt-16">
      <p className="gc-eyebrow">Policy</p>
      <h1
        className="mt-3.5 m-0 font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
        style={{ fontSize: "clamp(36px, 5vw, 56px)" }}
      >
        Privacy <em className="gc-italic">Policy</em>.
      </h1>
      <p className="mt-4 text-sm text-muted-warm">Last updated: March 31, 2026</p>

      <div className="mt-12 space-y-10 font-serif text-lg leading-[1.7] text-espresso">
        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">What we collect</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel collects minimal data to provide a better experience:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-warm-brown">
            <li><strong className="text-espresso">Anonymous usage data</strong> &mdash; page views and general traffic patterns via PostHog. We use cookieless, memory-only analytics. No personally identifiable information is collected and no data persists between sessions.</li>
            <li><strong className="text-espresso">Local preferences</strong> &mdash; when you click &ldquo;This Moved Me&rdquo; or vote for a church, we store a small identifier in your browser&rsquo;s local storage so we can remember your interaction. This data stays on your device.</li>
            <li><strong className="text-espresso">Church suggestions</strong> &mdash; if you submit a church via our suggestion form, we store the information you provide (church name, location, links).</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Cookies &amp; storage</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel does not set any tracking cookies. Our analytics run entirely in memory and do not persist between visits. We use browser local storage only for features you explicitly interact with (such as voting for a church).
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Third-party services</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel embeds content from third-party platforms:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-warm-brown">
            <li><strong className="text-espresso">YouTube</strong> (via youtube-nocookie.com) &mdash; for embedded worship videos. YouTube&rsquo;s privacy policy applies when you interact with embedded videos.</li>
            <li><strong className="text-espresso">Spotify</strong> &mdash; for embedded playlist players. Spotify&rsquo;s privacy policy applies when you interact with embedded playlists.</li>
            <li><strong className="text-espresso">PostHog</strong> &mdash; for cookieless, anonymous analytics. No personal data is sent and no cookies are set. We use it to understand aggregated usage patterns and improve the site.</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Your rights</h2>
          <p className="mt-3 text-base text-warm-brown">
            Since we don&rsquo;t collect personal data, set tracking cookies, or require accounts, there is no personal data to request or delete. You can clear local storage through your browser settings at any time.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Contact</h2>
          <p className="mt-3 text-base text-warm-brown">
            If you have questions about this privacy policy, reach us at{" "}
            <a href="mailto:hi@gospelchannel.com" className="font-bold text-rose-gold transition-colors hover:text-rose-gold-deep">
              hi@gospelchannel.com
            </a>.
          </p>
        </section>
      </div>
    </article>
  );
}
