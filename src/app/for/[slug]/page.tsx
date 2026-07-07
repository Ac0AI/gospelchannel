import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForAudienceLayout } from "@/components/ForAudienceLayout";
import { FOR_AUDIENCE } from "@/lib/for-audience-data";
import { buildArticleSchema, buildBreadcrumbSchema, buildItemListSchema } from "@/lib/seo-schema";

const SITE_URL = "https://gospelchannel.com";

export const revalidate = 86400;

export function generateStaticParams() {
  return Object.keys(FOR_AUDIENCE).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = FOR_AUDIENCE[slug];
  if (!data) return {};
  const url = `${SITE_URL}/for/${data.slug}`;
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

export default async function ForAudiencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = FOR_AUDIENCE[slug];
  if (!data) {
    notFound();
  }

  const url = `${SITE_URL}/for/${data.slug}`;
  const siblings = Object.values(FOR_AUDIENCE)
    .filter((audience) => audience.slug !== data.slug)
    .map((audience) => ({ slug: audience.slug, audience_name: audience.audience_name }));

  const schema = [
    buildArticleSchema({
      url,
      headline: data.hero_h1,
      description: data.meta_description,
      about: [
        "Church choice",
        `${data.audience_name} church search`,
        "Church profile evidence",
      ],
      mentions: [
        { name: "GospelChannel church profile database", url: `${SITE_URL}/church` },
        { name: `${data.audience_name} church proof routes`, url },
      ],
    }),
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "For", url: `${SITE_URL}/for` },
      { name: data.audience_name, url },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
    buildItemListSchema({
      name: `${data.audience_name} church decision routes`,
      items: data.solutions.map((solution) => ({
        name: solution.title,
        url: `${SITE_URL}${solution.href}`,
      })),
    }),
    ...(data.curated_cards.length > 0
      ? [
          buildItemListSchema({
            name: `${data.audience_name} church proof routes`,
            items: data.curated_cards.map((card) => ({
              name: card.title,
              url: `${SITE_URL}${card.href}`,
            })),
          }),
        ]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ForAudienceLayout data={data} siblings={siblings} />
    </>
  );
}
