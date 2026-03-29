import type { Metadata } from "next";
import { ToolActionCard, ToolChurchGrid } from "@/components/tools/ToolCards";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { filterChurchDirectory } from "@/lib/church-directory";
import { getChurchIndexData } from "@/lib/church";
import { toToolChurchPreview } from "@/lib/tooling";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "First-Time Church Visit Guide - What to Actually Expect",
  description:
    "Honest guide for your first worship service. What the music is like, whether you need to raise your hands, what to do during an altar call, and how to find a church where you fit in.",
  alternates: { canonical: "https://gospelchannel.com/tools/first-visit-guide" },
};

type DetailCard = {
  title: string;
  body: string;
};

type Tip = {
  lead: string;
  body: string;
};

const faqEntries = [
  {
    name: "What happens during a contemporary worship service?",
    text: "Most services start with 20-40 minutes of live worship music, often with a band, lights, and screens showing lyrics. After worship there are usually announcements, a sermon (30-45 min), and a closing prayer or response time. Some churches include an altar call at the end.",
  },
  {
    name: "Do I have to raise my hands or sing along?",
    text: "No. People around you might raise hands, clap, dance, or close their eyes during worship. None of that is expected of visitors. Stand when others stand, but beyond that, participate at your own pace. Nobody is watching you as closely as you think.",
  },
  {
    name: "What should I wear to a contemporary church?",
    text: "Most worship-focused churches are casual. Jeans and a clean top are fine in the vast majority of cases. Check the church website or social media photos to calibrate. When in doubt, slightly overdressed beats underdressed for your own comfort.",
  },
  {
    name: "What is an altar call and do I have to go up?",
    text: "An altar call is when the pastor invites people to come to the front of the room, usually for prayer, dedication, or a faith decision. It is always optional. You can stay seated. Many regular churchgoers stay seated too.",
  },
  {
    name: "Do I have to give money on my first visit?",
    text: "No. When the offering basket or bag comes around, just pass it along. Most churches have moved to digital giving and do not expect visitors to contribute. You are not paying for a ticket.",
  },
  {
    name: "How do I find a church that fits me?",
    text: "Listen to their worship music online first. Check if the energy, language, and tradition feel right. GospelChannel lets you compare worship style, tradition, and service details before your first visit so you can choose with more confidence.",
  },
];

const serviceFlowCards: DetailCard[] = [
  {
    title: "The worship set (20-40 min)",
    body: "A live band plays worship songs with lyrics on screens. The lights are often dimmed. People around you may raise hands, close their eyes, clap, or sway. Some stand still and sing quietly. Both are normal. You do not need to sing. You do not need to raise your hands. Just stand when others stand.",
  },
  {
    title: "The sermon (25-45 min)",
    body: 'The pastor speaks, usually with slides or Bible references on screen. Some congregations respond out loud ("Amen," "Come on"). You do not have to. Some churches have fill-in-the-blank notes - a pen can be useful.',
  },
  {
    title: "The response or altar call",
    body: "Near the end, the pastor may invite people to come forward for prayer. This is called an altar call. It is completely optional. Plenty of regular members stay in their seats. If you feel moved, go. If not, nobody will notice or judge you for staying put.",
  },
  {
    title: "The offering",
    body: "A basket or bag gets passed around, or they mention an app or QR code for digital giving. You are not expected to give as a visitor. Just pass the basket along. Many churches barely mention it at all and rely on online giving from regular members.",
  },
];

const concernCards: DetailCard[] = [
  {
    title: '"Will everyone know I am new?"',
    body: "Maybe, but nobody cares the way you think they do. People are focused on their own worship, their own kids, their own phones. Some churches ask visitors to stand and wave - if that happens and you hate it, just stay seated. Nobody will force you up.",
  },
  {
    title: '"What if someone prays over me?"',
    body: 'In charismatic or pentecostal churches, someone might offer to pray for you after the service. A simple "no thank you" is enough. If someone does pray, they usually put a hand on your shoulder and speak a short prayer. It can feel intense if you are not used to it, but it comes from genuine care.',
  },
  {
    title: '"The greeting time terrifies me"',
    body: "Many churches have a 2-5 minute segment where everyone shakes hands and says hello. This is consistently described as the hardest part by introverts. Practical tip: sit near an aisle at the back. You can step out to grab coffee if you need a break. Nobody will think twice about it.",
  },
  {
    title: '"What about communion?"',
    body: "Most contemporary and charismatic churches practice open communion - anyone can participate. But if you are unsure, just let the elements pass. It is bread and juice (or wine). Watch what others do first. Nobody will question you for sitting it out.",
  },
  {
    title: '"What do I wear?"',
    body: "Most worship-focused churches are far more casual than people expect. Jeans and a clean shirt are fine almost everywhere. Flip-flops are common in warmer climates. Check photos on the church's Instagram or website if you want to calibrate, but err on the side of comfortable.",
  },
];

const practicalTips: Tip[] = [
  {
    lead: "Watch a service online first.",
    body: "Most churches livestream or post recordings. Watching one removes the element of surprise and lets you hear the music, see the room, and understand the energy before you walk in.",
  },
  {
    lead: "Arrive 10 minutes early, not exactly on time.",
    body: "Counterintuitive, but arriving early means fewer eyes on you. Arriving late means walking into a full room where everyone turns to look.",
  },
  {
    lead: "Sit near the back, on an aisle.",
    body: "This is standard visitor strategy. You can see the room without feeling watched, and you can step out easily if you need a moment.",
  },
  {
    lead: "Grab coffee if they have it.",
    body: "It gives you something to hold, something to do, and a reason to stand somewhere specific. Most church lobbies have free coffee.",
  },
  {
    lead: "It is okay to leave.",
    body: "If you are overwhelmed, you can walk out during any part of the service. Nobody will chase you.",
  },
  {
    lead: "Do not judge by one visit.",
    body: "Your first visit is so colored by anxiety that you cannot accurately assess the community. Most people recommend going 2-3 times before deciding.",
  },
  {
    lead: "One kind person changes everything.",
    body: "Across every first-visit story, the turning point is always one person making genuine, unscripted contact. Not the greeter with a name badge. A real human being who noticed you.",
  },
];

const kidsTips: Tip[] = [
  {
    lead: "Budget extra time.",
    body: "Kids' check-in (name tags, allergies, parent contact) can take 10-15 minutes the first time. Call ahead or check the website to know where to go.",
  },
  {
    lead: "Tour the building beforehand if you can.",
    body: "Some churches let you visit midweek to walk your child through the rooms. This removes the stranger-danger response on Sunday morning.",
  },
  {
    lead: "Sit near an aisle.",
    body: "If your child needs to leave, you can slip out quietly without climbing over a row of people.",
  },
  {
    lead: "Not all churches separate kids.",
    body: "Some keep families in the main service. Others have full kids' programs from age 0. Check the church page for kids ministry details before you go.",
  },
];

function buildGuideFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map((e) => ({
      "@type": "Question",
      name: e.name,
      acceptedAnswer: { "@type": "Answer", text: e.text },
    })),
  };
}

export default async function FirstVisitGuidePage() {
  const churches = await getChurchIndexData();
  const visitorReadyChurches = filterChurchDirectory(churches)
    .filter((church) => Boolean((church.enrichmentHint?.location || church.location) && church.enrichmentHint?.serviceTimes))
    .slice(0, 6)
    .map(toToolChurchPreview);
  const faqSchema = buildGuideFaqSchema();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:space-y-10 sm:px-6 sm:py-10">
      <ToolPageTracker toolName="first_visit_guide" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* ── Hero ── */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">First-time church guide</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-espresso sm:text-4xl">
          What to actually expect at a worship-focused church
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-brown">
          The hardest part is the parking lot. You sit in the car, heart racing, wondering if you should go in.
          Most first-visit anxiety is not spiritual - it is practical. Will people stare? Will I have to do something?
          What if the music is too loud, or too long, or I do not know the words?
        </p>
        <p className="mt-3 text-base leading-relaxed text-warm-brown">
          This guide covers what really happens inside a contemporary or charismatic church service,
          based on real experiences from people who have been through it. No church marketing, just honest answers.
        </p>
      </section>

      {/* ── The service flow ── */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-espresso">What happens in the room</h2>

        <div className="space-y-3">
          {serviceFlowCards.map((item) => (
            <div key={item.title} className="rounded-xl border border-rose-200/60 bg-white/80 p-4">
              <h3 className="font-semibold text-espresso">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-warm-brown">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Real concerns ── */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-espresso">The things people actually worry about</h2>

        <div className="space-y-3">
          {concernCards.map((item) => (
            <div key={item.title} className="rounded-xl border border-rose-200/60 bg-white/80 p-4">
              <h3 className="font-semibold text-espresso">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-warm-brown">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Practical tips ── */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Tips from people who have done this</h2>
        <div className="rounded-xl border border-rose-200/60 bg-white/80 p-5">
          <ul className="space-y-3 text-sm leading-relaxed text-warm-brown">
            {practicalTips.map((item) => (
              <li key={item.lead}>
                <strong className="text-espresso">{item.lead}</strong>{" "}
                {item.body}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── With kids ── */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Bringing kids</h2>
        <div className="rounded-xl border border-rose-200/60 bg-white/80 p-5">
          <ul className="space-y-3 text-sm leading-relaxed text-warm-brown">
            {kidsTips.map((item) => (
              <li key={item.lead}>
                <strong className="text-espresso">{item.lead}</strong>{" "}
                {item.body}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ (visible + schema) ── */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Common questions</h2>
        <div className="space-y-3">
          {faqEntries.map((faq) => (
            <details key={faq.name} className="group rounded-xl border border-rose-200/60 bg-white/80">
              <summary className="cursor-pointer select-none p-4 font-semibold text-espresso transition-colors hover:text-rose-gold-deep">
                {faq.name}
              </summary>
              <p className="px-4 pb-4 text-sm leading-relaxed text-warm-brown">{faq.text}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Next steps ── */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-espresso">Find a church where you will fit right in</h2>
        <div className="space-y-4">
          <ToolActionCard
            eyebrow="Best first move"
            title="Take the Church Fit Quiz"
            description="Answer a few questions about your preferences and get matched with church lanes that fit your worship style."
            href="/tools/church-fit-quiz"
            label="Take the quiz"
            toolName="first_visit_guide"
            resultType="tool"
            resultLabel="church_fit_quiz"
            markComplete
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolActionCard
              title="Browse contemporary churches"
              description="Modern worship, band-led music, relaxed dress code. The most common starting point for first-time visitors."
              href="/church/style/contemporary-worship"
              label="See contemporary churches"
              toolName="first_visit_guide"
              resultType="browse_lane"
              resultLabel="contemporary"
              markComplete
            />
            <ToolActionCard
              title="Browse charismatic churches"
              description="Expressive worship, prayer ministry, and high-energy services. Intense but welcoming to newcomers."
              href="/church/style/charismatic"
              label="See charismatic churches"
              toolName="first_visit_guide"
              resultType="browse_lane"
              resultLabel="charismatic"
              markComplete
            />
          </div>
        </div>
      </section>

      {/* ── Visitor-ready churches ── */}
      {visitorReadyChurches.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Visitor-ready churches</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso">
              Churches with strong first-visit details
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-warm-brown">
              These church pages include location, service times, and worship style details -
              so you can prepare before your first Sunday.
            </p>
          </div>
          <ToolChurchGrid churches={visitorReadyChurches} toolName="first_visit_guide" labelPrefix="visitor_ready" />
        </section>
      )}
    </div>
  );
}
