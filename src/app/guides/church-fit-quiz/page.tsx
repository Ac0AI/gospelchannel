import type { Metadata } from "next";
import { GuideChurchEvidence, GuideProofLinks, GuideRelated, type GuideChurchEvidenceGroup } from "@/components/guides";
import { ChurchFitQuizClient } from "@/components/tools/ChurchFitQuizClient";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { getChurchIndexPageData } from "@/lib/church";
import { buildGuideSchema, buildItemListSchema } from "@/lib/seo-schema";
import {
  buildDiscoveryLanes,
  getLaneDirectoryFilters,
  toToolChurchPreview,
} from "@/lib/tooling";

export const revalidate = 3600;

const PAGE_URL = "https://gospelchannel.com/guides/church-fit-quiz";
const PAGE_TITLE = "Church Fit Quiz";
const META_DESCRIPTION =
  "Answer seven fast questions about worship style, tradition, and Sunday priorities to find where you'll fit before your first visit.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
    url: PAGE_URL,
    siteName: "GospelChannel",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
  },
};

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

export default async function ChurchFitQuizPage() {
  const lanes = await Promise.all(
    buildDiscoveryLanes([]).map(async (lane) => {
      const page = await getChurchIndexPageData({
        filters: getLaneDirectoryFilters(lane),
        page: 1,
        pageSize: 4,
      });

      return {
        ...lane,
        sampleChurches: page.pageItems.map(toToolChurchPreview),
      };
    }),
  );
  const evidenceGroups: GuideChurchEvidenceGroup[] = lanes.slice(0, 4).map((lane) => ({
    id: lane.id,
    title: lane.title,
    description: lane.whyItFits,
    href: lane.browse.href,
    linkLabel: lane.browse.label,
    churches: lane.sampleChurches.slice(0, 3),
  }));
  const schema = buildGuideSchema({
    slug: "church-fit-quiz",
    headline: "Church Fit Quiz",
    description: META_DESCRIPTION,
  });
  const decisionLaneSchema = buildItemListSchema({
    name: "Church fit quiz decision lanes",
    items: lanes.map((lane) => ({
      name: lane.title,
      url: `https://gospelchannel.com${lane.browse.href}`,
    })),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([...schema, decisionLaneSchema, ...buildEvidenceSchema(evidenceGroups)]),
        }}
      />
      <ToolPageTracker toolName="church_fit_quiz" />

      <section className="px-5 pt-14 sm:px-12 sm:pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="gc-eyebrow">Find your fit</p>
          <h1
            className="mx-auto mt-3.5 m-0 max-w-[16ch] font-serif font-semibold leading-[1.1] tracking-[-0.02em] text-espresso"
            style={{ fontSize: "clamp(40px, 6vw, 72px)" }}
          >
            Find <em className="gc-italic">your</em> Sunday in eight questions.
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-base leading-relaxed text-warm-brown sm:text-lg">
            No data saved. No login. Three matches at the end &ndash; visit one this Sunday or save them and decide later.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[980px] px-5 pt-10 sm:px-12">
        <GuideProofLinks
          title="The quiz chooses a lane; profiles prove it"
          intro="Treat the quiz result as a decision shortcut, then open the matching proof route to check real profile evidence: worship style, denomination, service details, music, location, and visitor cues."
          links={[
            {
              href: "/church/style",
              label: "Browse by worship style",
              description: "Use this when the quiz points mainly to room sound and Sunday energy.",
            },
            {
              href: "/church/denomination",
              label: "Browse by tradition",
              description: "Use this when the quiz points mainly to theology, structure, or church background.",
            },
            {
              href: "/church/churches-with-service-times",
              label: "Check visit-ready profiles",
              description: "Narrow to churches that publish concrete service times before you plan a Sunday.",
            },
            {
              href: "/church/churches-with-worship-music",
              label: "Check worship proof",
              description: "Open profiles with music signals so the match is not just a label.",
            },
          ]}
        />
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-12 sm:px-12 sm:py-14">
        <ChurchFitQuizClient lanes={lanes} />
      </section>

      <section className="mx-auto max-w-[1100px] px-5 pb-16 sm:px-12">
        <GuideChurchEvidence
          title="Sample lanes the quiz can send you toward"
          intro="These examples are not the quiz result; they are indexable proof routes. After answering, the tool uses the same lane logic to open churches that match your answers."
          groups={evidenceGroups}
          toolName="church_fit_quiz_guide"
        />
        <GuideRelated current="church-fit-quiz" />
      </section>
    </>
  );
}
