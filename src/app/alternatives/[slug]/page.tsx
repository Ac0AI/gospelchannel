import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlternativeLayout } from "@/components/AlternativeLayout";
import { ALTERNATIVES } from "@/lib/alternatives-data";
import { buildArticleSchema, buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";

const SITE_URL = "https://gospelchannel.com";

export const revalidate = 86400;

export function generateStaticParams() {
  return Object.keys(ALTERNATIVES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = ALTERNATIVES[slug];
  if (!data) return {};
  const url = `${SITE_URL}/alternatives/${data.slug}`;
  return {
    title: data.meta_title,
    description: data.meta_description,
    alternates: { canonical: url },
    openGraph: {
      title: data.meta_title,
      description: data.meta_description,
      url,
      siteName: "GospelChannel",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: data.meta_title,
      description: data.meta_description,
    },
  };
}

export default async function AlternativePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = ALTERNATIVES[slug];
  if (!data) {
    notFound();
  }

  const url = `${SITE_URL}/alternatives/${data.slug}`;
  const siblings = Object.values(ALTERNATIVES)
    .filter((alt) => alt.slug !== data.slug)
    .map((alt) => ({ slug: alt.slug, competitor_name: alt.competitor_name }));

  const schema = [
    buildArticleSchema({
      url,
      headline: `${data.competitor_name} alternative — GospelChannel`,
      description: data.meta_description,
      about: [
        "Church finder comparison",
        "Church choice",
        "Church profile evidence",
      ],
      mentions: [
        { name: "GospelChannel church profile database", url: `${SITE_URL}/church` },
        { name: "GospelChannel church decision guides", url: `${SITE_URL}/guides` },
      ],
    }),
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "Alternatives", url: `${SITE_URL}/alternatives` },
      { name: `${data.competitor_name} alternative`, url },
    ]),
    buildItemListSchema({
      name: `${data.competitor_name} alternative decision path`,
      items: [
        { name: "Understand the church-finder tradeoff", url },
        { name: "Take the Church Fit Quiz", url: `${SITE_URL}/guides/church-fit-quiz` },
        { name: "Use the first-visit guide", url: `${SITE_URL}/guides/first-visit-guide` },
        { name: "Verify the answer in church profiles", url: `${SITE_URL}/church` },
      ],
    }),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <AlternativeLayout data={data} siblings={siblings} />
    </>
  );
}
