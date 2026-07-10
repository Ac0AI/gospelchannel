import type { Metadata } from "next";
import Link from "next/link";
import { GuideChurchEvidence, GuideHero, GuideProofLinks, type GuideChurchEvidenceGroup } from "@/components/guides";
import { getChurchIndexPageData } from "@/lib/church";
import {
  CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION,
  CHURCH_CHOICE_ANSWER_PAGE_TITLE,
  CHURCH_CHOICE_ANSWER_PAGE_URL,
  CHURCH_CHOICE_ANSWERS,
  CHURCH_CHOICE_EVIDENCE_GROUPS,
  CHURCH_CHOICE_PROOF_LINKS,
} from "@/lib/church-choice-answers";
import { buildGuideSchema, buildItemListSchema } from "@/lib/seo-schema";
import { toToolChurchPreview } from "@/lib/tooling";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: CHURCH_CHOICE_ANSWER_PAGE_TITLE,
  description: CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION,
  alternates: { canonical: CHURCH_CHOICE_ANSWER_PAGE_URL },
  openGraph: {
    title: CHURCH_CHOICE_ANSWER_PAGE_TITLE,
    description: CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION,
    url: CHURCH_CHOICE_ANSWER_PAGE_URL,
    siteName: "GospelChannel",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: CHURCH_CHOICE_ANSWER_PAGE_TITLE,
    description: CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION,
  },
};

function buildFaqSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    description: CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION,
    mainEntity: CHURCH_CHOICE_ANSWERS.map((item) => ({
      "@type": "Question",
      name: item.question,
      text: item.question,
      url: `${CHURCH_CHOICE_ANSWER_PAGE_URL}#${item.id}`,
      acceptedAnswer: {
        "@type": "Answer",
        text: [
          item.answer,
          item.detail,
          `Guide: https://gospelchannel.com${item.guide.href}.`,
          `Database proof: https://gospelchannel.com${item.proof.href}.`,
          `Evidence: ${item.proofSignals.join(", ")}.`,
        ].join(" "),
      },
    })),
  };
}

function buildEvidenceSchema(groups: GuideChurchEvidenceGroup[]) {
  return groups
    .filter((group) => group.churches.length > 0)
    .map((group) =>
      buildItemListSchema({
        name: group.title,
        items: group.churches.map((church) => ({
          name: church.name,
          url: `https://gospelchannel.com${church.href}`,
        })),
      }),
    );
}

export default async function ChurchChoiceAnswersPage() {
  const evidenceGroups: GuideChurchEvidenceGroup[] = await Promise.all(
    CHURCH_CHOICE_EVIDENCE_GROUPS.map(async (group) => {
      const page = await getChurchIndexPageData({
        filters: group.filters,
        page: 1,
        pageSize: 3,
      });

      return {
        id: group.id,
        title: group.title,
        description: group.description,
        href: group.href,
        linkLabel: group.linkLabel,
        churches: page.pageItems.map(toToolChurchPreview),
      };
    }),
  );
  const schema = [
    ...buildGuideSchema({
      slug: "church-choice-answers",
      headline: "Church Choice Answers",
      description: CHURCH_CHOICE_ANSWER_PAGE_DESCRIPTION,
    }),
    buildItemListSchema({
      name: "Church choice answer map",
      items: CHURCH_CHOICE_ANSWERS.map((item) => ({
        name: item.question,
        url: `${CHURCH_CHOICE_ANSWER_PAGE_URL}#${item.id}`,
      })),
    }),
    buildItemListSchema({
      name: "Church choice proof routes",
      items: CHURCH_CHOICE_PROOF_LINKS.map((link) => ({
        name: link.label,
        url: `https://gospelchannel.com${link.href}`,
      })),
    }),
    buildFaqSchema(),
    ...buildEvidenceSchema(evidenceGroups),
  ];

  return (
    <article className="mx-auto max-w-[1040px] px-5 pb-24 sm:px-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
      />

      <GuideHero
        eyebrow="Answer map"
        title="Church choice answers"
        titleAccent="with profile proof"
        intro="Short answers to the questions people ask before choosing a church. Each answer points to the guide that explains the decision and the profile route that can prove it."
      />

      <section className="mx-auto mt-8 max-w-[820px] rounded-[18px] border border-rose-gold/[0.14] bg-linen-deep p-6 sm:p-8">
        <p className="gc-eyebrow">Quick answer</p>
        <h2 className="mt-3 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
          Start with one decision, then require evidence.
        </h2>
        <p className="mt-3 text-sm leading-[1.7] text-warm-brown sm:text-base">
          A good church search does not start with every possible filter. It starts with the question
          you actually need answered: fit, worship, denomination, size, first visit, or location.
          Use the answer to choose a lane, then use church profiles as the proof layer before Sunday.
        </p>
      </section>

      <section className="mt-14">
        <p className="gc-eyebrow">Common decisions</p>
        <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
          Answer first. Verify second.
        </h2>
        <div className="mt-8 space-y-10">
          {CHURCH_CHOICE_ANSWERS.map((item, index) => (
            <section
              key={item.id}
              id={item.id}
              className="scroll-mt-24 border-t border-rose-gold/[0.14] pt-8"
            >
              <p className="gc-eyebrow">Answer {String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso sm:text-3xl">
                {item.question}
              </h3>
              <p className="mt-4 max-w-[820px] text-base font-semibold leading-[1.65] text-espresso">
                {item.answer}
              </p>
              <p className="mt-3 max-w-[820px] text-sm leading-[1.7] text-warm-brown sm:text-base">
                {item.detail}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Link
                  href={item.guide.href}
                  className="group border-t border-rose-gold/[0.14] pt-4"
                >
                  <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-warm">
                    Guide answer
                  </span>
                  <span className="mt-2 block text-sm font-bold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
                    {item.guide.label} &rarr;
                  </span>
                </Link>
                <Link
                  href={item.proof.href}
                  className="group border-t border-rose-gold/[0.14] pt-4"
                >
                  <span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-warm">
                    Database proof
                  </span>
                  <span className="mt-2 block text-sm font-bold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
                    {item.proof.label} &rarr;
                  </span>
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {item.proofSignals.map((signal) => (
                  <span
                    key={signal}
                    className="rounded-full border border-rose-gold/20 bg-white px-3 py-1 text-xs font-semibold text-warm-brown"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <GuideProofLinks
        title="Open the proof layer"
        intro="These routes are the database side of the decision engine. Use them after a guide has answered the question, so the final recommendation is grounded in real church profiles."
        links={CHURCH_CHOICE_PROOF_LINKS}
      />

      <GuideChurchEvidence
        title="Proof examples from the live profile database"
        intro="These examples are loaded from the same profile database the answer map points to. Use them as examples of what to verify before recommending or visiting a church."
        groups={evidenceGroups}
        toolName="church_choice_answers"
      />
    </article>
  );
}
