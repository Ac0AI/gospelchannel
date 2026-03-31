import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "GospelChannel privacy policy - how we handle your data.",
  alternates: { canonical: "https://gospelchannel.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-espresso sm:text-4xl">Privacy Policy</h1>
      <p className="text-sm text-muted-warm">Last updated: March 31, 2026</p>

      <div className="space-y-6 text-warm-brown leading-relaxed">
        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">What We Collect</h2>
          <p className="mt-2">
            GospelChannel collects minimal data to provide a better experience:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            <li><strong>Anonymous usage data</strong> - page views and general traffic patterns via PostHog. We use cookieless, memory-only analytics. No personally identifiable information is collected and no data persists between sessions.</li>
            <li><strong>Local preferences</strong> - when you click &ldquo;This Moved Me&rdquo; or vote for a church, we store a small identifier in your browser&apos;s local storage so we can remember your interaction. This data stays on your device.</li>
            <li><strong>Church suggestions</strong> - if you submit a church via our suggestion form, we store the information you provide (church name, location, links).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">Cookies &amp; Storage</h2>
          <p className="mt-2">
            GospelChannel does not set any tracking cookies. Our analytics run entirely in memory and do not persist between visits. We use browser local storage only for features you explicitly interact with (such as voting for a church).
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">Third-Party Services</h2>
          <p className="mt-2">
            GospelChannel embeds content from third-party platforms:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            <li><strong>YouTube</strong> (via youtube-nocookie.com) - for embedded worship videos. YouTube&apos;s privacy policy applies when you interact with embedded videos.</li>
            <li><strong>Spotify</strong> - for embedded playlist players. Spotify&apos;s privacy policy applies when you interact with embedded playlists.</li>
            <li><strong>PostHog</strong> - for cookieless, anonymous analytics. No personal data is sent and no cookies are set. We use it to understand aggregated usage patterns and improve the site.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">Your Rights</h2>
          <p className="mt-2">
            Since we don&apos;t collect personal data, set tracking cookies, or require accounts, there is no personal data to request or delete. You can clear local storage through your browser settings at any time.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">Contact</h2>
          <p className="mt-2">
            If you have questions about this privacy policy, reach us at{" "}
            <a href="mailto:hello@gospelchannel.com" className="font-semibold text-rose-gold hover:text-rose-gold-deep">
              hello@gospelchannel.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
