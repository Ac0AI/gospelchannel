import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForAudienceLayout } from "@/components/ForAudienceLayout";
import { FOR_AUDIENCE } from "@/lib/for-audience-data";
import { buildArticleSchema, buildBreadcrumbSchema } from "@/lib/seo-schema";

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

  const schema = [
    buildArticleSchema({
      url,
      headline: data.hero_h1,
      description: data.meta_description,
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
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ForAudienceLayout data={data} />
    </>
  );
}
