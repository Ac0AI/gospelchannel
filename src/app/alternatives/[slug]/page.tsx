import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlternativeLayout } from "@/components/AlternativeLayout";
import { ALTERNATIVES } from "@/lib/alternatives-data";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo-schema";

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
    }),
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "Alternatives", url: `${SITE_URL}/alternatives` },
      { name: `${data.competitor_name} alternative`, url },
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
