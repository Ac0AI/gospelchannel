import { CONTENT_UPDATED_AT } from "@/lib/utils";

const SITE_URL = "https://gospelchannel.com";

export type ArticleSchemaInput = {
  url: string;
  headline: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
};

export function buildArticleSchema(input: ArticleSchemaInput) {
  const dateModified = input.dateModified ?? CONTENT_UPDATED_AT;
  const datePublished = input.datePublished ?? dateModified;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    headline: input.headline,
    description: input.description,
    datePublished,
    dateModified,
    author: {
      "@type": "Organization",
      name: "GospelChannel",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "GospelChannel",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
      },
    },
    ...(input.image ? { image: input.image } : {}),
  };
}

export type BreadcrumbItem = { name: string; url: string };

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildGuideSchema(args: {
  slug: string;
  headline: string;
  description: string;
  image?: string;
}) {
  const url = `${SITE_URL}/guides/${args.slug}`;
  return [
    buildArticleSchema({
      url,
      headline: args.headline,
      description: args.description,
      image: args.image,
    }),
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "Guides", url: `${SITE_URL}/guides` },
      { name: args.headline, url },
    ]),
  ];
}
