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
      <p className="mt-4 text-sm text-muted-warm">Last updated: August 28, 2026</p>

      <div className="mt-12 space-y-10 font-serif text-lg leading-[1.7] text-espresso">
        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Who runs this site</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel is operated by AC0 AI, S.L.U., NIF B26808741, Maestranza 25, planta 1, 29016 Málaga, Spain. AC0 AI, S.L.U. is the controller for the personal data described in this policy.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">What we collect</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel collects minimal data to provide a better experience:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-warm-brown">
            <li><strong className="text-espresso">Website analytics</strong> – page views, selected interaction events, and Core Web Vitals through PostHog. IP anonymization is enabled, person profiles and session recording are disabled, and we do not send nearby-search coordinates to PostHog.</li>
            <li><strong className="text-espresso">Local preferences</strong> – your cookie choice and identifiers for features you explicitly use, such as voting for a church, are stored in your browser.</li>
            <li><strong className="text-espresso">Nearby church searches</strong>: only after you click &ldquo;Use my location,&rdquo; your browser reads your position and rounds it to two decimal places before sending the search. GospelChannel receives only that approximate point, does not send coordinates to PostHog, and does not tie the search to an account.</li>
            <li><strong className="text-espresso">Information you submit</strong> – church suggestions, correction requests, claims, and contact forms contain the details you choose to provide so we can review or answer them.</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Cookies &amp; storage</h2>
          <p className="mt-3 text-base text-warm-brown">
            Before you choose, PostHog uses a memory-only identifier and does not set an analytics cookie. If you accept analytics, PostHog may store an identifier in local storage and a cookie so visits can be understood over time. If you decline, PostHog is opted out after your choice. Your consent choice remains in local storage, and you can change it from the cookie settings link in the site footer.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Third-party services</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel embeds content from third-party platforms:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-warm-brown">
            <li><strong className="text-espresso">Cloudflare</strong> – hosts and protects the site and assistant app, and processes standard request and security metadata.</li>
            <li><strong className="text-espresso">Neon</strong> – hosts the directory database and executes church lookups. Search queries are not written to a user profile or search-history table.</li>
            <li><strong className="text-espresso">PostHog</strong> – processes the website analytics described above. It does not receive assistant-app searches or nearby-search coordinates.</li>
            <li><strong className="text-espresso">YouTube</strong> (via youtube-nocookie.com) – provides embedded worship videos. YouTube&rsquo;s privacy policy applies when you interact with a video.</li>
            <li><strong className="text-espresso">Spotify</strong> – provides embedded playlist players. Spotify&rsquo;s privacy policy applies when you interact with a player.</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Assistant app (ChatGPT, Claude, and other AI assistants)</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel offers a read-only church-finder app over the Model Context Protocol at{" "}
            <a href="https://gospelchannel.com/mcp" className="font-bold text-rose-gold transition-colors hover:text-rose-gold-deep">gospelchannel.com/mcp</a>,
            usable inside AI assistants such as ChatGPT and Claude. When you use it:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-warm-brown">
            <li><strong className="text-espresso">What it receives</strong>: search terms needed for the request, such as an explicitly named city, worship style, denomination, or language. For &ldquo;near me&rdquo; searches, location comes only through the assistant&rsquo;s controlled location metadata and is rounded before the directory lookup. The tool does not ask for precise GPS coordinates in its input fields.</li>
            <li><strong className="text-espresso">What it does</strong>: looks up matching churches in our public directory and returns their public profiles. It is read-only. It cannot change anything, and it never invents details such as service times.</li>
            <li><strong className="text-espresso">Who processes it</strong>: Cloudflare handles the request and Neon executes the directory lookup on our behalf. Assistant-app searches are not sent to PostHog.</li>
            <li><strong className="text-espresso">What we store</strong>: GospelChannel does not write the query or approximate location to its application database, create a user profile, or keep a personal location history. Cloudflare may retain standard operational logs as described below. The assistant you use has its own privacy policy for the conversation itself.</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">How long we keep data</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-base text-warm-brown">
            <li><strong className="text-espresso">Assistant searches</strong> – query bodies and approximate locations are processed for the lookup and are not intentionally stored by GospelChannel. Cloudflare Workers operational logs are retained for no more than 7 days; aggregate Worker metrics may remain for up to 3 months.</li>
            <li><strong className="text-espresso">Website analytics</strong> – PostHog events are currently retained for up to 84 months. IP anonymization is enabled and session recordings and person profiles are disabled.</li>
            <li><strong className="text-espresso">Browser preferences</strong> – remain on your device until you clear site data or change the relevant setting.</li>
            <li><strong className="text-espresso">Forms and correspondence</strong> – kept while we review or answer the request, then deleted or anonymized within 24 months unless a longer period is required to resolve a dispute or meet a legal obligation.</li>
          </ul>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Your rights</h2>
          <p className="mt-3 text-base text-warm-brown">
            You can decline or withdraw analytics consent, clear GospelChannel cookies and local storage in your browser, and ask us for access, correction, deletion, restriction, or a copy of personal data you submitted. You may also object to processing and complain to your local data-protection authority. Because assistant searches are not tied to an account or stored as a search history, we generally cannot identify a past search as belonging to you.
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
