/* eslint-disable react/no-unescaped-entities */
// src/app/tools/prayer-guide/page.tsx
import type { Metadata } from "next";
import {
  GuideHero,
  GuideIllustration,
  GuideStep,
  GuideQuote,
  GuideCTA,
  GuideProofLinks,
  GuideRelated,
} from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { buildGuideSchema, buildHowToSchema, buildItemListSchema } from "@/lib/seo-schema";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;

const MEDIA = "https://media.gospelchannel.com/guides/prayer-guide";
const PAGE_URL = "https://gospelchannel.com/guides/prayer-guide";
const META_DESCRIPTION =
  "There is no wrong way to pray. If you don't know what to say, start here. A practical, no-jargon guide to having your first conversation with God.";

const PRAYER_PROOF_LINKS = [
  {
    href: "/church/churches-with-service-times",
    label: "Find a service you can attend",
    description: "Prayer can start alone, but a real Sunday service gives it community, rhythm, and next steps.",
  },
  {
    href: "/church/style/acoustic",
    label: "Browse quieter worship rooms",
    description: "Useful if you want a gentler, reflective setting while you are still new to prayer.",
  },
  {
    href: "/church/style/charismatic",
    label: "Browse prayer-forward churches",
    description: "Use this if you want a room where prayer response and spiritual openness are more visible.",
  },
  {
    href: "/church/churches-with-worship-music",
    label: "Listen before you visit",
    description: "Open profiles with worship music so Sunday feels less unfamiliar before you go.",
  },
];

const PRAYER_STEPS = [
  {
    id: "start-talking",
    title: "Just Start Talking",
    text: "Begin with ordinary words. You can pray out loud, silently, in a journal, on a walk, or in the middle of a normal day.",
  },
  {
    id: "say-thank-you",
    title: "Say Thank You",
    text: "Start with gratitude by naming one or two things already in front of you.",
  },
  {
    id: "say-whats-on-your-mind",
    title: "Say What's On Your Mind",
    text: "Tell God what you are worried about, excited about, confused about, or carrying right now.",
  },
  {
    id: "pray-for-someone-else",
    title: "Pray for Someone Else",
    text: "Name another person and ask God to be close to them, even if you do not know exactly what they need.",
  },
  {
    id: "listen",
    title: "Listen",
    text: "After speaking, sit quietly for a moment and make room for clarity, peace, or later understanding.",
  },
  {
    id: "close-or-dont",
    title: "Close (or Don't)",
    text: "End with amen, stop talking, or let the prayer fade into the rest of the day.",
  },
] as const;

export const metadata: Metadata = {
  title: "How to Start Praying - A Simple Guide",
  description: META_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    title: "How to Start Praying",
    description: "A simple, honest guide for people who want to pray but don't know where to begin.",
    url: PAGE_URL,
    siteName: "GospelChannel",
    type: "article",
  },
  twitter: {
    images: ["https://gospelchannel.com/hero-worship.jpg"],
    card: "summary_large_image",
    title: "How to Start Praying",
    description: "A simple, honest guide for people who want to pray but don't know where to begin.",
  },
};

const SAMPLE_PRAYERS: Array<{ title: string; text: string }> = [
  {
    title: "A morning prayer",
    text: "God, thank you for today. I don't know what's coming, but I'm here. Help me be present and kind. Amen.",
  },
  {
    title: "When you're scared",
    text: "God, I'm scared about this. I don't know how it's going to go. Please be with me. I need to know I'm not alone in this. Amen.",
  },
  {
    title: "For someone you love",
    text: "God, I want to pray for [name]. I don't know exactly what they need, but you do. Please be close to them today. Amen.",
  },
  {
    title: "When you don't know what to say",
    text: "God, I'm here. I don't have the right words. But I'm showing up. That has to count for something. Amen.",
  },
];

export default function PrayerGuidePage() {
  const schema = buildGuideSchema({
    slug: "prayer-guide",
    headline: "How to Start Praying",
    description: META_DESCRIPTION,
  });
  const howToSchema = buildHowToSchema({
    name: "How to Start Praying",
    description: META_DESCRIPTION,
    url: PAGE_URL,
    totalTime: "PT10M",
    steps: PRAYER_STEPS,
  });
  const proofRouteSchema = buildItemListSchema({
    name: "Prayer guide church next-step routes",
    items: PRAYER_PROOF_LINKS.map((link) => ({
      name: link.label,
      url: `https://gospelchannel.com${link.href}`,
    })),
  });

  return (
    <article className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd([...schema, howToSchema, proofRouteSchema]) }}
      />
      <ToolPageTracker toolName="prayer_guide" />

      <GuideHero
        eyebrow="Free Guide"
        title="How to Start Praying"
        intro="There is no wrong way to do this. If you don't know what to say, start here. Prayer is a conversation, not a performance."
      />

      <GuideProofLinks
        title="Use prayer as a next step, not a dead end"
        intro="This guide helps you start privately. When you are ready to try church, use church details to choose a room that fits the way you want to pray, listen, and participate."
        links={PRAYER_PROOF_LINKS}
      />

      <GuideIllustration src={`${MEDIA}/01-hero.png`} alt="Person sitting quietly by a window in morning light, hands resting open" />

      <GuideStep id={PRAYER_STEPS[0].id} step={1} title={PRAYER_STEPS[0].title}>
        <p>
          Prayer isn't a special voice or a formula. It's talking to God like you'd
          talk to someone who already knows everything but wants to hear it from you anyway.
        </p>
        <p>
          You can pray out loud, in your head, in a journal, on a walk. There is no
          wrong setting and no wrong time.
        </p>
        <p>
          "Hey God" is a perfectly fine opener. So is "Dear Lord," "Jesus," or just
          starting mid-thought. God is not grading your intro.
        </p>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/02-conversation.png`} alt="Two chairs facing each other, one empty - a metaphor for conversation" />

      <GuideStep id={PRAYER_STEPS[1].id} step={2} title={PRAYER_STEPS[1].title}>
        <p>
          Start with gratitude. It's the easiest entry point because you don't
          have to figure anything out - just notice what's already there.
        </p>
        <p>
          "Thank you for today. Thank you for [person]. Thank you that I'm even
          trying this."
        </p>
        <p>
          It doesn't need to be profound. Thanking God for your morning coffee is
          a real prayer. Gratitude shifts your attention outward, and that's
          where prayer begins.
        </p>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/03-gratitude.png`} alt="Person at kitchen table with coffee, looking up with gentle smile in morning light" />

      <GuideStep id={PRAYER_STEPS[2].id} step={3} title={PRAYER_STEPS[2].title}>
        <p>
          Tell God what you're worried about, excited about, confused about.
          Be specific.
        </p>
        <p>
          "I'm scared about the interview on Thursday." "I don't know what to
          do about my relationship with [person]." "I want my mom to be okay."
        </p>
        <p>
          This isn't a wish list you're submitting. It's sharing what weighs on
          you with someone who can carry it. You're not informing God of
          something new - you're being honest about where you are.
        </p>
        <GuideQuote text="I used to think praying for things was selfish. Then someone told me: God already knows what you need. Prayer isn't about informing him - it's about trusting him enough to say it out loud." />
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/04-sharing.png`} alt="Person walking alone on a path outdoors with open sky above" />

      <GuideStep id={PRAYER_STEPS[3].id} step={4} title={PRAYER_STEPS[3].title}>
        <p>
          "I want to pray for [name]. Please be with them. Give them what they
          need today."
        </p>
        <p>
          You don't have to know what they need. You don't have to use the right
          words. Just holding someone in front of God is enough.
        </p>
        <p>
          Praying for others does something to you too. It shifts your focus
          from your own noise to someone else's life, and that's usually when
          the quiet shows up.
        </p>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/05-others.png`} alt="Two people, one gently placing a hand on the other's shoulder" />

      <GuideStep id={PRAYER_STEPS[4].id} step={5} title={PRAYER_STEPS[4].title}>
        <p>
          Prayer isn't just talking. After you've said what you need to say,
          sit quietly for a moment. Even 30 seconds.
        </p>
        <p>
          You might not "hear" anything. That's completely normal. Most people
          don't hear a voice. Sometimes clarity comes hours later - in the
          shower, on a walk, in a conversation you didn't plan.
        </p>
        <p>
          The listening part is less about receiving an answer and more about
          making space for one.
        </p>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/06-listen.png`} alt="Person sitting still with eyes closed, warm glow around them" />

      <GuideStep id={PRAYER_STEPS[5].id} step={6} title={PRAYER_STEPS[5].title}>
        <p>
          "Amen" just means "I mean it." It's not a magic word that activates
          the prayer. Some people say "In Jesus' name, amen." Some just stop
          talking. Both are fine.
        </p>
        <p>
          Some prayers have a clear ending. Others just fade into your day.
          That's okay too. God doesn't need a clean sign-off.
        </p>
      </GuideStep>

      <div className="my-12 h-px bg-blush" />

      <div className="mb-4 text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
          This is normal
        </p>
        <h2 className="mt-3 font-serif text-2xl font-bold text-espresso">
          What If I Don't Feel Anything?
        </h2>
      </div>

      <div className="space-y-4 text-base leading-relaxed text-warm-brown">
        <p>
          Most people don't feel a thunderbolt. Prayer often feels like talking
          into an empty room, especially at first. That doesn't mean it's not
          working.
        </p>
        <p>
          Faith isn't a feeling - it's a practice. Some days prayer feels like
          connection. Some days it feels like nothing. Both days count.
        </p>
        <GuideQuote text="I prayed for months and felt absolutely nothing. I almost gave up. Then one morning I realized I'd been sleeping better, worrying less, and being kinder without trying. The prayer was working. I just couldn't feel it happening." />
      </div>

      <div className="my-12 h-px bg-blush" />

      <GuideIllustration src={`${MEDIA}/07-close.png`} alt="Open hands, palms up, in a simple gentle gesture" />

      <div className="mb-4 text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
          Borrow these
        </p>
        <h2 className="mt-3 font-serif text-2xl font-bold text-espresso">
          Simple Prayers to Start With
        </h2>
      </div>

      <div className="space-y-4">
        {SAMPLE_PRAYERS.map((prayer) => (
          <div key={prayer.title} className="rounded-2xl border border-blush bg-white/80 p-5">
            <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-mauve">
              {prayer.title}
            </p>
            <p className="font-serif text-base italic leading-relaxed text-espresso">
              {prayer.text}
            </p>
          </div>
        ))}
      </div>

      <GuideCTA
        links={[
          { label: "Read the first-visit guide", href: "/guides/first-visit-guide" },
          { label: "Browse churches", href: "/church" },
        ]}
      />

      <GuideRelated current="prayer-guide" />
    </article>
  );
}
