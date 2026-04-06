// src/app/tools/first-visit-guide/page.tsx
import type { Metadata } from "next";
import {
  GuideHero,
  GuideIllustration,
  GuideStep,
  GuideQuote,
  GuideTip,
  GuideWorryCard,
  GuideCTA,
} from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";

export const revalidate = 3600;

const MEDIA = "https://media.gospelchannel.com/guides/first-visit";

export const metadata: Metadata = {
  title: "First-Time Church Visit Guide - What to Actually Expect",
  description:
    "Honest step-by-step guide for your first worship service. What the music is like, whether you need to raise your hands, what to do during an altar call, and everything else nobody tells you.",
  alternates: { canonical: "https://gospelchannel.com/guides/first-visit-guide" },
  openGraph: {
    title: "Your First Church Visit, Step by Step",
    description: "Walk through every moment of a Sunday service so nothing catches you off guard.",
    url: "https://gospelchannel.com/guides/first-visit-guide",
    siteName: "GospelChannel",
    type: "article",
  },
};

const WORRIES: Array<{ question: string; answer: string }> = [
  {
    question: "Will everyone know I'm new?",
    answer:
      "Some churches ask visitors to stand up or raise a hand. You can ignore that. Most people are focused on their own experience, not scanning the room for newcomers.",
  },
  {
    question: "What if someone prays over me?",
    answer:
      'In most churches, nobody will pray over you unless you ask. In charismatic or Pentecostal churches, someone might offer. A simple "no thanks, I\'m just visiting" works perfectly.',
  },
  {
    question: "What do I wear?",
    answer:
      "Jeans are fine at 90% of churches. Only a few traditional or liturgical churches have a dressier norm. When in doubt, check their Instagram or website for photos of a recent Sunday.",
  },
  {
    question: "What about communion?",
    answer:
      "Most churches that serve communion say it's for believers. If you're not sure, just let it pass. Nobody will notice or care. Some churches use small cups passed through rows, others invite you to walk forward.",
  },
  {
    question: "The greeting time terrifies me",
    answer:
      'Many churches have a "greet your neighbor" moment where everyone turns and shakes hands. It lasts about 60 seconds. A smile and "good morning" is all anyone expects. If it feels like too much, stay seated - nobody will think twice.',
  },
];

function buildFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: WORRIES.map((w) => ({
      "@type": "Question",
      name: w.question,
      acceptedAnswer: { "@type": "Answer", text: w.answer },
    })),
  };
}

export default function FirstVisitGuidePage() {
  return (
    <article className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
      <ToolPageTracker toolName="first_visit_guide" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema()) }}
      />

      <GuideHero
        eyebrow="Free Guide"
        title="Your First Church Visit,"
        titleAccent="Step by Step"
        intro="You already know the hardest part is the parking lot. This guide walks you through every moment so nothing catches you off guard."
      />

      <GuideIllustration src={`${MEDIA}/01-parking-lot.png`} alt="Person sitting in car looking at a church through the windshield" />

      <GuideStep step={1} title="The Parking Lot">
        <p>
          You pull in, turn off the engine, and the voice in your head says{" "}
          <em>"what am I doing here?"</em>
        </p>
        <p>
          That's normal. Almost everyone sits in the car for a minute. Some
          people sit there for ten. Take a breath. You can leave anytime -
          nobody is tracking license plates.
        </p>
        <GuideQuote text="I sat in my car for ten minutes the first time. Turned the engine on twice. Then a woman knocked on my window and said 'First time? Me too. Let's go in together.'" />
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/02-walking-in.png`} alt="Walking toward warm church entrance with light glowing through the doors" />

      <GuideIllustration src={`${MEDIA}/03-lobby.png`} alt="Welcoming church lobby with coffee station and friendly greeter" />

      <GuideStep step={2} title="The Lobby">
        <p>
          Someone will probably say hi. A smile and "hey, first time here" is
          all you need. You don't have to explain your life story.
        </p>
        <p>If there's coffee, grab some. It gives your hands something to do.</p>
        <GuideTip label="Timing tip">
          <p>
            Arrive 10 minutes early. Late enough to skip the awkward small talk,
            early enough to find a seat without walking in during a song.
          </p>
        </GuideTip>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/04-finding-seat.png`} alt="View from back of church showing person choosing a back-row aisle seat" />

      <GuideStep step={3} title="Finding a Seat">
        <p>Back row, aisle seat. That's the veteran first-timer move.</p>
        <p>
          Easy to slip out if you need to, and nobody behind you watching what
          you do with your hands during worship.
        </p>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/05-worship-wide.png`} alt="Worship band on stage with congregation standing, seen from behind" wide />

      <GuideStep step={4} title="The Music">
        <p>
          The worship set usually runs 20-40 minutes. The lyrics show on a
          screen. Everyone stands, and some people raise their hands.
        </p>
        <p>
          You don't have to sing. You don't have to raise anything. Standing is
          polite, but sitting is fine too - especially if you're taking it all in
          for the first time.
        </p>
        <p>
          It might feel intense if you've never experienced it. That's the part
          people either love or find overwhelming. Both are valid.
        </p>
        <GuideQuote text="Nobody told me the music would feel like that. I wasn't even a believer yet. I just stood there and cried and I still don't fully know why." />
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/06-sermon.png`} alt="Speaker at podium with open Bible and warm stage lights" />

      <GuideStep step={5} title="The Sermon">
        <p>
          This is the teaching part. Usually 25-45 minutes. Someone talks about a
          Bible passage and connects it to everyday life.
        </p>
        <p>
          Some speakers are funny, some are intense, some are quiet. The style
          varies wildly between churches - it's one of the biggest reasons people
          pick one church over another.
        </p>
        <GuideTip label="Don't judge by one sermon">
          <p>
            Pastors have off days too. If the church felt right but the sermon
            didn't land, give it two more visits before deciding.
          </p>
        </GuideTip>
      </GuideStep>

      <GuideIllustration src={`${MEDIA}/07-after.png`} alt="People leaving church through open doors into sunlight" />

      <GuideStep step={6} title="After">
        <p>
          Some churches do an altar call at the end - an invitation to come to
          the front for prayer. You don't have to go. Most people don't.
        </p>
        <p>
          The offering basket or bucket will pass by. Just pass it along. Nobody
          is watching whether you put something in or not.
        </p>
        <p>
          Then it's over. You can leave immediately, or stay and talk. Both are
          completely fine. Some people duck out fast, some linger over coffee.
          There's no wrong move here.
        </p>
      </GuideStep>

      <div className="my-12 h-px bg-blush" />

      <div className="mb-8 text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
          You're not the first to wonder
        </p>
        <h2 className="mt-3 font-serif text-2xl font-bold text-espresso">
          The Things People Actually Worry About
        </h2>
      </div>

      {WORRIES.map((w) => (
        <GuideWorryCard key={w.question} question={w.question} answer={w.answer} />
      ))}

      <div className="my-12 h-px bg-blush" />

      <GuideIllustration src={`${MEDIA}/08-kids.png`} alt="Parent and child at a colorful kids check-in counter" />

      <GuideStep title="Bringing Kids">
        <p>
          Most churches over 100 people have a dedicated kids program during the
          service. You check them in before the service starts (usually near the
          lobby), and pick them up after.
        </p>
        <p>
          It's okay to keep your child with you the first time if that feels
          safer. Many parents do. If a toddler makes noise, don't stress - every
          parent in the room has been there.
        </p>
        <GuideTip label="Ask ahead">
          <p>
            Check the church website for what ages their kids program covers. Some
            start at nursery age, others only from age 3 or 4.
          </p>
        </GuideTip>
      </GuideStep>

      <GuideCTA
        links={[
          { label: "Find your church", href: "/guides/church-fit-quiz" },
          { label: "Browse churches", href: "/church" },
        ]}
      />
    </article>
  );
}
