import type { Metadata } from "next";
import { GuideRelated } from "@/components/guides";
import { ChurchFitQuizClient } from "@/components/tools/ChurchFitQuizClient";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { buildGuideSchema } from "@/lib/seo-schema";
import { buildDiscoveryLanes } from "@/lib/tooling";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Church Fit Quiz",
  description:
    "Answer seven fast questions about worship style, tradition, and Sunday priorities to find where you'll fit before your first visit.",
  alternates: { canonical: "https://gospelchannel.com/guides/church-fit-quiz" },
};

export default async function ChurchFitQuizPage() {
  const lanes = buildDiscoveryLanes([]);
  const schema = buildGuideSchema({
    slug: "church-fit-quiz",
    headline: "Church Fit Quiz",
    description:
      "Answer seven fast questions about worship style, tradition, and Sunday priorities to find where you'll fit before your first visit.",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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

      <section className="mx-auto max-w-[1100px] px-5 py-12 sm:px-12 sm:py-14">
        <ChurchFitQuizClient lanes={lanes} />
      </section>

      <section className="mx-auto max-w-[720px] px-5 pb-16 sm:px-12">
        <GuideRelated current="church-fit-quiz" />
      </section>
    </>
  );
}
