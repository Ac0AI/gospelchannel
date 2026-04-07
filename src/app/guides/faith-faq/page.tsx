import type { Metadata } from "next";
import {
  GuideHero,
  GuideWorryCard,
  GuideCTA,
} from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Common Questions About Faith - Honest Answers",
  description:
    "What is salvation? Why read the Bible? Is baptism required? Honest answers to the questions everyone asks but nobody wants to be the first to say out loud.",
  alternates: { canonical: "https://gospelchannel.com/guides/faith-faq" },
  openGraph: {
    title: "Common Questions About Faith",
    description:
      "Honest answers to the big questions about salvation, baptism, the Holy Spirit, and church life.",
    url: "https://gospelchannel.com/guides/faith-faq",
    siteName: "GospelChannel",
    type: "article",
  },
};

type FaqItem = {
  question: string;
  answer: string;
  tags: string[];
};

type FaqSection = {
  eyebrow: string;
  title: string;
  items: FaqItem[];
};

const SECTIONS: FaqSection[] = [
  {
    eyebrow: "The basics",
    title: "Salvation & the Bible",
    items: [
      {
        question: "What is salvation?",
        answer:
          "Salvation is being rescued from the weight of sin - not by earning it, but by turning to God and trusting in Jesus. It's a gift, not a grade. You don't perform your way in. You receive it through faith, and grace does the heavy lifting.",
        tags: ["Evangelical"],
      },
      {
        question: "Why should I read and study the Bible?",
        answer:
          "Because it's how God talks to you. Not in a mystical-voice-from-the-sky way, but through stories, wisdom, poetry, and letters that have shaped billions of lives. Christians consider it the ultimate guide for how to live and what to believe. You don't need a theology degree to start - just pick a Gospel and read.",
        tags: ["Evangelical"],
      },
    ],
  },
  {
    eyebrow: "Talking to God",
    title: "Prayer",
    items: [
      {
        question: "What is prayer?",
        answer:
          "Prayer is talking to God. That's really it. No special voice, no formula, no minimum word count. It's how you share what's on your heart with someone who already knows but wants to hear it from you. You can pray anywhere - out loud, in your head, on a walk, in the middle of the night.",
        tags: ["Evangelical"],
      },
    ],
  },
  {
    eyebrow: "Different traditions see this differently",
    title: "The Holy Spirit",
    items: [
      {
        question: "What is the Baptism in the Holy Spirit?",
        answer:
          "In charismatic and Pentecostal churches, this is seen as a separate experience from becoming a Christian. It's described as being filled with the Holy Spirit in a way that gives you power and boldness for your faith - plus access to spiritual gifts. Not every tradition teaches it the same way, but in these churches it's a big deal.",
        tags: ["Charismatic", "Assemblies of God"],
      },
      {
        question: "What is the evidence of being filled with the Holy Spirit?",
        answer:
          "In Assemblies of God and similar churches, the answer is speaking in tongues - a prayer language that comes out when the Spirit fills you. This is one of the more debated topics across Christianity. Many churches hold this view strongly, while others see the evidence differently. If you visit a Pentecostal church, don't be surprised if this comes up.",
        tags: ["Charismatic", "Assemblies of God"],
      },
      {
        question: "What are the gifts of the Spirit?",
        answer:
          "These are special abilities that the Holy Spirit gives to believers - things like wisdom, healing, prophecy, and speaking in tongues. The idea is that they're not for showing off, but for building up the church and helping others. Different churches emphasize different gifts, and some believe certain gifts stopped after the early church. It depends on the tradition.",
        tags: ["Charismatic", "Assemblies of God"],
      },
    ],
  },
  {
    eyebrow: "Practices that shape church life",
    title: "Baptism & Church Life",
    items: [
      {
        question: "Why is baptism by immersion typically practiced?",
        answer:
          "Going fully underwater is a symbol - you're showing that your old life is buried and you're coming up into something new. It's a public way of saying \"I'm in.\" Most evangelical and free churches practice full immersion because they see it as the closest match to how baptism is described in the New Testament.",
        tags: ["Free Church", "Evangelical Free Church of America"],
      },
      {
        question: "Is baptism necessary for salvation?",
        answer:
          "In most evangelical churches, no. Salvation comes through faith in Jesus, full stop. Baptism is what you do after - it's an outward sign of an inward change. Think of it like a wedding ring: it doesn't make you married, but it shows the world that you are.",
        tags: ["Free Church", "Evangelical Free Church of America"],
      },
      {
        question: "What does 'local church autonomy' mean?",
        answer:
          "It means each church governs itself. No bishop or headquarters tells them what to preach, who to hire, or how to spend their money. The congregation makes its own decisions under the leadership of its pastors and elders. This is common in free church and baptist traditions - they see it as a safeguard against outside control.",
        tags: ["Free Church", "Evangelical Free Church of America"],
      },
      {
        question: "Who should be a member of a local church?",
        answer:
          "In churches that practice believer's membership, the answer is: people who have personally put their faith in Jesus. It's not about being born into it or growing up in the building. You choose to belong. Membership usually means you're committing to show up, serve, and be part of the community - not just attend.",
        tags: ["Free Church", "Evangelical Free Church of America"],
      },
    ],
  },
];

const ALL_FAQS = SECTIONS.flatMap((s) => s.items);

const SOURCES = [
  { label: "GotQuestions.org - What is salvation?", url: "https://www.gotquestions.org/what-is-salvation.html" },
  { label: "GotQuestions.org - Why read the Bible?", url: "https://www.gotquestions.org/why-read-Bible.html" },
  { label: "GotQuestions.org - What is prayer?", url: "https://www.gotquestions.org/what-is-prayer.html" },
  { label: "Assemblies of God - Statement of Fundamental Truths", url: "https://ag.org/Beliefs/Statement-of-Fundamental-Truths" },
  { label: "Chase Oaks - Seven Common Questions About Baptism", url: "https://www.chaseoaks.org/articles/seven-common-questions-about-baptism" },
  { label: "EFCA - What We Believe", url: "https://www.efca.org/about/who-we-are/what-we-believe" },
  { label: "EFCA Blog - Autonomous and Interdependent", url: "https://blogs.efca.org/posts/autonomous-and-interdependent" },
  { label: "EFCA Blog - Salvation and the Church: Baptism", url: "https://blogs.efca.org/strands-of-thought/posts/salvation-and-the-church-the-church-and-ordinances-baptism-and-the-efca" },
  { label: "EFCA - Membership Statement", url: "https://data.efca.org/files/view/699" },
];

function buildFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ALL_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export default function FaithFaqPage() {
  return (
    <article className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
      <ToolPageTracker toolName="faith_faq" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqSchema()) }}
      />

      <GuideHero
        eyebrow="Free Guide"
        title="Common Questions About Faith"
        intro="The questions everyone asks but nobody wants to be the first to say out loud."
      />

      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-10">
          <div className="mb-4 text-center">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
              {section.eyebrow}
            </p>
            <h2 className="mt-3 font-serif text-2xl font-bold text-espresso">
              {section.title}
            </h2>
          </div>
          {section.items.map((faq) => (
            <GuideWorryCard
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              tags={faq.tags}
            />
          ))}
        </section>
      ))}

      <div className="my-12 h-px bg-blush" />

      <section className="text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-mauve">
          Further reading
        </p>
        <h2 className="mt-3 font-serif text-2xl font-bold text-espresso">
          Sources
        </h2>
        <ul className="mt-4 space-y-1.5 text-left text-sm text-warm-brown">
          {SOURCES.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-blush underline-offset-2 transition-colors hover:text-espresso hover:decoration-rose-gold"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <GuideCTA
        links={[
          { label: "Read the first-visit guide", href: "/guides/first-visit-guide" },
          { label: "Browse churches", href: "/church" },
        ]}
      />
    </article>
  );
}
