// src/app/tools/prayer-guide/page.tsx
import type { Metadata } from "next";
import {
  GuideHero,
  GuideIllustration,
  GuideStep,
  GuideQuote,
  GuideTip,
  GuideCTA,
} from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";

export const revalidate = 3600;

const MEDIA = "https://media.gospelchannel.com/guides/prayer-guide";

export const metadata: Metadata = {
  title: "How to Start Praying - A Simple Guide",
  description:
    "There is no wrong way to pray. If you don't know what to say, start here. A practical, no-jargon guide to having your first conversation with God.",
  alternates: { canonical: "https://gospelchannel.com/guides/prayer-guide" },
  openGraph: {
    title: "How to Start Praying",
    description: "A simple, honest guide for people who want to pray but don't know where to begin.",
    url: "https://gospelchannel.com/guides/prayer-guide",
    siteName: "GospelChannel",
    type: "article",
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
  return (
    <article className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
      <ToolPageTracker toolName="prayer_guide" />

      <GuideHero
        eyebrow="Free Guide"
        title="How to Start Praying"
        intro="There is no wrong way to do this. If you don't know what to say, start here. Prayer is a conversation, not a performance."
      />

      <GuideIllustration src={`${MEDIA}/01-hero.png`} alt="Person sitting quietly by a window in morning light, hands resting open" />

      <GuideStep step={1} title="Just Start Talking">
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

      <GuideStep step={2} title="Say Thank You">
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

      <GuideStep step={3} title="Say What's On Your Mind">
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

      <GuideStep step={4} title="Pray for Someone Else">
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

      <GuideStep step={5} title="Listen">
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

      <GuideStep step={6} title="Close (or Don't)">
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
    </article>
  );
}
