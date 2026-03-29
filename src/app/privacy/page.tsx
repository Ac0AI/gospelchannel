import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "GospelChannel privacy policy - how we handle your data and cookies.",
  alternates: { canonical: "https://gospelchannel.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="font-serif text-3xl font-semibold text-espresso sm:text-4xl">Privacy Policy</h1>
      <p className="text-sm text-muted-warm">Last updated: February 28, 2026</p>

      <div className="space-y-6 text-warm-brown leading-relaxed">
        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">What We Collect</h2>
          <p className="mt-2">
            GospelChannel collects minimal data to provide a better experience:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            <li><strong>Anonymous usage data</strong> - page views and general traffic patterns via PostHog, but only after you accept analytics cookies. No personally identifiable information is collected.</li>
            <li><strong>Local preferences</strong> - when you click &ldquo;This Moved Me&rdquo; or vote for a church, we store a small cookie on your device so we can remember your interaction. This data stays on your device.</li>
            <li><strong>Church suggestions</strong> - if you submit a church via our suggestion form, we store the information you provide (church name, location, links).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">Cookies</h2>
          <p className="mt-2">
            We use functional cookies only - no advertising cookies or third-party trackers. The cookies we set are:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
            <li><code className="rounded bg-blush-light px-1 text-xs">church_vote_*</code> - remembers which churches you voted for</li>
          </ul>
          <p className="mt-2 text-sm">
            These cookies are essential to the functionality you explicitly use and do not track you across sites.
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
            <li><strong>PostHog</strong> - for privacy-conscious product analytics after consent. We use it to understand aggregated usage patterns and improve the site.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl font-semibold text-espresso">Your Rights</h2>
          <p className="mt-2">
            You can clear all GospelChannel cookies at any time through your browser settings. Since we don&apos;t collect personal data or require accounts, there is no personal data to request or delete.
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
