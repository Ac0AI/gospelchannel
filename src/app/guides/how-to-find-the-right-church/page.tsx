/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from "next";
import Link from "next/link";
import { GuideHero, GuideRelated, GuideStep, GuideTip } from "@/components/guides";
import { buildGuideSchema } from "@/lib/seo-schema";

export const revalidate = 86400;

const META_TITLE = "How to Find the Right Church — A Practical Step-by-Step Guide";
const META_DESCRIPTION =
  "A plain-spoken seven-step framework for finding a church that fits — your worship style, your denomination, your city, your season of life. No shortcuts, no jargon.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: "https://gospelchannel.com/guides/how-to-find-the-right-church" },
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    url: "https://gospelchannel.com/guides/how-to-find-the-right-church",
    siteName: "GospelChannel",
    type: "article",
  },
};

export default function HowToFindTheRightChurchPage() {
  const schema = buildGuideSchema({
    slug: "how-to-find-the-right-church",
    headline: "How to Find the Right Church",
    description: META_DESCRIPTION,
  });

  return (
    <article className="mx-auto max-w-[760px] px-5 pb-24 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <GuideHero
        eyebrow="The capstone guide"
        title="How to find the right church"
        titleAccent="without wasting a year of Sundays"
        intro="A seven-step framework that takes you from no plan to a short list of churches worth visiting — usually inside an hour. Built from the patterns we've watched thousands of church-seekers walk through. No magic; just the order of operations most people skip when they try to figure it out alone."
      />

      <section className="mt-12">
        <p className="text-base leading-relaxed text-warm-brown sm:text-lg">
          Most people search for a church the same wrong way: they ask a friend, visit one
          church, find something off about it, and then drift for months without going anywhere
          else. The drifting isn't a faith problem — it's a logistics problem. This guide
          rebuilds the search from the start, with a clear sequence and a small set of decisions
          at each step.
        </p>
        <p className="mt-4 text-base leading-relaxed text-warm-brown sm:text-lg">
          Read it once. Apply it once. Most readers have a Sunday plan inside an hour. Whether
          you're new in town, processing a hard church season, returning after years away, or
          looking for the first time, the same seven steps apply.
        </p>
      </section>

      <GuideStep step={1} title="Name what you actually need from a Sunday">
        <p>
          Before you open any directory, write down what a good Sunday morning looks like for
          you in this season. Three or four sentences, not a manifesto. Worship style. Length of
          service. Whether you want a big room or a small one. Whether you want kids ministry,
          and how integrated you want it to be. Whether you want preaching that's expositional,
          topical, or somewhere in between.
        </p>
        <p>
          This step takes ten minutes and saves weeks. Most people skip it because it feels
          obvious — but the act of writing it down clarifies what you've been carrying around
          implicitly. Couples should do it separately and compare; the overlap is where to
          start.
        </p>
        <GuideTip label="Stuck?">
          <p>
            Take the church fit quiz. Seven questions, three matches, no signup. The matches
            aren't the answer; they're a starting point for the conversation with yourself
            about what you actually want.
          </p>
        </GuideTip>
      </GuideStep>

      <GuideStep step={2} title="Pick a worship style first">
        <p>
          Of all the filters available, worship style is the one most people get wrong by
          ignoring it. Two free-church congregations on the same street can sound completely
          different on a Sunday — one might be a Hillsong-style band-led set, the next a
          hymn-led service with an organ and a choir. Neither is wrong; they're just different
          rooms.
        </p>
        <p>
          Decide which sonic family fits your season: contemporary, gospel, charismatic,
          Hillsong-style, Bethel-influenced, Pentecostal, hymn-led, or blended. If you don't
          know what those words mean, read the worship-styles guide first — it describes each
          one plainly with examples.
        </p>
        <GuideTip label="Two styles is fine">
          <p>
            You don't have to pick exactly one. Most people want a primary style and a
            comfortable secondary. Try both and you'll usually know after one or two Sundays
            which is home.
          </p>
        </GuideTip>
      </GuideStep>

      <GuideStep step={3} title="Pick a denomination range (or skip this step)">
        <p>
          Some readers know exactly what tradition they want — Baptist, Vineyard, Pentecostal,
          Anglican. If that's you, filter by denomination as your second criterion. If you
          don't have strong feelings, skip this step entirely. Denomination matters less for
          week-to-week fit than worship style does, and over-filtering eliminates churches that
          would have been a good Sunday.
        </p>
        <p>
          If you don't know what each tradition emphasises, read the denominations guide
          before deciding. It describes the major free-church and evangelical traditions in
          plain language so you can pick from a position of understanding rather than a
          guess.
        </p>
      </GuideStep>

      <GuideStep step={4} title="Filter by your city, not your radius">
        <p>
          Open the city page for your actual location and look at what's there. Most directories
          show you a radius — 5, 10, 25 miles — and let suburbs that you'll never realistically
          drive to clutter the results. A city filter shows you the churches in your city,
          which is usually all you need. Drill into a specific neighbourhood or transit line
          from there.
        </p>
        <p>
          If you don't have a car, prioritise walkable or short-transit options. Two churches
          on a Sunday morning bus is the most you'll realistically try; the third becomes a
          car-ride conversation. Pick congregations you can actually reach without that
          conversation happening every week.
        </p>
      </GuideStep>

      <GuideStep step={5} title="Read profile copy and listen to the music">
        <p>
          You should now have a short list of three to eight churches that fit your style,
          denomination, and city. Before you visit any of them, do two things on each profile:
          read the church's description carefully, and play whatever Spotify or YouTube content
          is attached. Coverage is growing on GospelChannel and many profiles already have
          audio or video.
        </p>
        <p>
          The profile copy tells you what the church wants you to know about itself. The music
          tells you what Sunday actually sounds like. Together they let you eliminate two or
          three churches that wouldn't have worked, before you spend a Sunday morning finding
          out the slower way.
        </p>
        <GuideTip label="Look for specifics">
          <p>
            Profiles with specifics — what to expect on a first visit, kids ministry details,
            service times, what a normal Sunday looks like — are usually run by congregations
            that put thought into welcoming visitors. That's a positive signal, not a
            requirement.
          </p>
        </GuideTip>
      </GuideStep>

      <GuideStep step={6} title="Visit two or three, not seven">
        <p>
          Pick two or three churches from your short list and visit them in consecutive weeks.
          Don't try to visit eight churches; the comparison fatigue makes every Sunday worse
          than it actually was. Two or three is enough to feel the difference and pick one to
          settle into.
        </p>
        <p>
          On each visit, pay attention to four things: how the worship lands for you, how the
          preaching lands, how welcomed you feel without being a project, and whether you want
          to come back next week. The last one is the most honest signal. If you want to come
          back, come back. If you don't, that's information; try another from your list.
        </p>
        <p>
          If you've never been to a church before — or never to a church in this country —
          read the first-visit guide before your first Sunday. It walks you through what
          actually happens on a Sunday morning, from the parking lot to the dismissal, so
          nothing surprises you.
        </p>
      </GuideStep>

      <GuideStep step={7} title="Land somewhere on purpose">
        <p>
          After two or three visits, pick a congregation and commit to giving it eight Sundays
          before deciding. Eight is the rough number where a church stops being a place you
          visit and starts being a place you know — you recognise faces, you understand the
          rhythm, you can tell the difference between a one-off awkward Sunday and a real
          pattern.
        </p>
        <p>
          Commit before perfect certainty. Most people who land somewhere good landed there
          before they were sure. The certainty came from showing up. If after eight weeks the
          church isn't right, you'll know — and you'll have learned more about what fits than
          any quiz could surface.
        </p>
      </GuideStep>

      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          Common variations
        </h2>
        <p className="mt-4 text-base leading-relaxed text-warm-brown">
          The seven steps apply universally; the order matters more for some readers than
          others. A few common scenarios and how to adapt:
        </p>
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-serif text-lg font-semibold text-espresso">
              You're an expat in a new country
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
              Add a language filter to step 4. The /for/expats page walks through the
              expat-specific dimensions and lists country starting points.
            </p>
            <Link
              href="/for/expats"
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-rose-gold"
            >
              Read the expat guide &rarr;
            </Link>
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-espresso">
              You're a university student
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
              Prioritise walkable churches in step 4 and consider student-heavy congregations.
              The /for/students page covers the patterns specific to college-town search.
            </p>
            <Link
              href="/for/students"
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-rose-gold"
            >
              Read the student guide &rarr;
            </Link>
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-espresso">
              You're new to faith
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
              Skip step 3 and lean on the first-visit guide and the faith FAQ before step 6.
              The /for/new-believers page describes the entry experience plainly.
            </p>
            <Link
              href="/for/new-believers"
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-rose-gold"
            >
              Read the new-believer guide &rarr;
            </Link>
          </div>
          <div>
            <h3 className="font-serif text-lg font-semibold text-espresso">
              You're processing a hard church history
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-warm-brown sm:text-base">
              Go gentle. Slow the process down, lean on broader traditions in step 3, and give
              yourself permission to leave a visit early without judgement on the congregation.
              The /for/deconstructing page describes how the directory can fit this season.
            </p>
            <Link
              href="/for/deconstructing"
              className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-rose-gold"
            >
              Read the deconstructing guide &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          The whole framework, in one page
        </h2>
        <p className="mt-4 text-base leading-relaxed text-warm-brown">
          If you only remember one thing: <em className="gc-italic">filter by worship style
          before denomination, and pick a city before a radius.</em> Those two rules eliminate
          the most common reasons people end up at the wrong church.
        </p>
        <p className="mt-4 text-base leading-relaxed text-warm-brown">
          Everything else is execution. The directory, the worship-styles guide, the
          denominations guide, the fit quiz, and the audience-specific pages are tools for the
          same job: finding a Sunday morning you'd want to keep coming back to. None of them
          replaces the visit; they just make sure the visit is worth the morning.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/church"
            className="rounded-full bg-rose-gold px-6 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-px hover:bg-rose-gold-deep hover:shadow-[0_8px_24px_rgba(176,106,80,0.3)]"
          >
            Open the directory
          </Link>
          <Link
            href="/guides/church-fit-quiz"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Take the fit quiz
          </Link>
          <Link
            href="/guides/worship-styles-explained"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Worship styles guide
          </Link>
          <Link
            href="/guides/denominations-comparison"
            className="rounded-full border border-rose-gold/30 px-6 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
          >
            Denominations guide
          </Link>
        </div>
      </section>

      <GuideRelated current="how-to-find-the-right-church" />
    </article>
  );
}
