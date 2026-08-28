import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms for using GospelChannel and its read-only church-finder app.",
  alternates: { canonical: "https://gospelchannel.com/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-[760px] px-5 pb-24 pt-14 sm:px-12 sm:pt-16">
      <p className="gc-eyebrow">Policy</p>
      <h1
        className="m-0 mt-3.5 font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
        style={{ fontSize: "clamp(36px, 5vw, 56px)" }}
      >
        Terms <em className="gc-italic">of Use</em>.
      </h1>
      <p className="mt-4 text-sm text-muted-warm">Last updated: August 28, 2026</p>

      <div className="mt-12 space-y-10 font-serif text-lg leading-[1.7] text-espresso">
        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">About GospelChannel</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel is a free church guide operated by AC0 AI, S.L.U., NIF B26808741, Maestranza 25, planta 1, 29016 Málaga, Spain. These terms apply to the website and the read-only church-finder app available through the Model Context Protocol.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Directory information</h2>
          <p className="mt-3 text-base text-warm-brown">
            Church profiles combine public church sources, GospelChannel research, community corrections, and information submitted by church teams. A listing is not an endorsement, ranking, or confirmation that a congregation is currently active. Confirm service times, access, address, language, and other visit details on the church&apos;s official website before travelling.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Using the assistant app</h2>
          <p className="mt-3 text-base text-warm-brown">
            The GospelChannel assistant app can search public church profiles by approximate location, city, worship style, tradition, language, and selected visitor details. It is read-only. You may use its results for personal church discovery and citation, but you must not use the service to scrape the directory at scale, disrupt the service, evade technical limits, or misrepresent GospelChannel&apos;s data as an endorsement.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Corrections and church ownership</h2>
          <p className="mt-3 text-base text-warm-brown">
            Anyone can report incorrect public information. Church leaders can claim a profile and submit updates for review. We may edit, reject, suspend, or remove content that is inaccurate, unsafe, unlawful, or unrelated to the directory.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Availability and responsibility</h2>
          <p className="mt-3 text-base text-warm-brown">
            GospelChannel is provided as available and may change without notice. We work to keep public information useful, but we do not guarantee that every profile or assistant result is complete, current, or suitable for a particular visit. You remain responsible for confirming details and deciding whether to contact or visit a church.
          </p>
        </section>

        <section>
          <h2 className="m-0 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Contact</h2>
          <p className="mt-3 text-base text-warm-brown">
            Questions about these terms can be sent to{" "}
            <a href="mailto:hi@gospelchannel.com" className="font-bold text-rose-gold transition-colors hover:text-rose-gold-deep">
              hi@gospelchannel.com
            </a>.
          </p>
        </section>
      </div>
    </article>
  );
}
