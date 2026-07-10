import { CONTENT_UPDATED_AT } from "@/lib/utils";

const SITE_URL = "https://gospelchannel.com";

type SchemaThingInput = string | {
  name: string;
  url?: string;
};

export type ArticleSchemaInput = {
  url: string;
  headline: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
  about?: SchemaThingInput[];
  mentions?: SchemaThingInput[];
};

function buildThingSchema(thing: SchemaThingInput) {
  if (typeof thing === "string") {
    return {
      "@type": "Thing",
      name: thing,
    };
  }

  return {
    "@type": "Thing",
    name: thing.name,
    ...(thing.url ? { url: thing.url } : {}),
  };
}

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
        url: `${SITE_URL}/icon.svg`,
      },
    },
    ...(input.image ? { image: input.image } : {}),
    ...(input.about?.length ? { about: input.about.map(buildThingSchema) } : {}),
    ...(input.mentions?.length ? { mentions: input.mentions.map(buildThingSchema) } : {}),
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
  about?: SchemaThingInput[];
  mentions?: SchemaThingInput[];
}) {
  const url = `${SITE_URL}/guides/${args.slug}`;
  return [
    buildArticleSchema({
      url,
      headline: args.headline,
      description: args.description,
      image: args.image,
      about: args.about ?? [
        "Church choice",
        "Church decision guide",
        "Church profile evidence",
      ],
      mentions: args.mentions ?? [
        { name: "GospelChannel church profile database", url: `${SITE_URL}/church` },
        { name: "Church proof routes", url: `${SITE_URL}/church` },
      ],
    }),
    buildBreadcrumbSchema([
      { name: "GospelChannel", url: SITE_URL },
      { name: "Guides", url: `${SITE_URL}/guides` },
      { name: args.headline, url },
    ]),
  ];
}

export type HowToSchemaStep = {
  id: string;
  title: string;
  text: string;
};

export function buildHowToSchema(args: {
  name: string;
  description: string;
  url: string;
  totalTime?: string;
  steps: readonly HowToSchemaStep[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: args.name,
    description: args.description,
    ...(args.totalTime ? { totalTime: args.totalTime } : {}),
    mainEntityOfPage: args.url,
    step: args.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.text,
      url: `${args.url}#${step.id}`,
    })),
  };
}

export type ItemListSchemaItem = {
  name: string;
  url: string;
};

export function buildItemListSchema(args: {
  name: string;
  items: ItemListSchemaItem[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: args.name,
    numberOfItems: args.items.length,
    itemListElement: args.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

const DAY_OF_WEEK: Record<string, string> = {
  sunday: "https://schema.org/Sunday",
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
};

export type OpeningHoursInput = { day: string; time: string };

/**
 * Map service times ({day, time} strings) to schema.org
 * openingHoursSpecification entries. Only entries whose day matches an
 * English weekday (singular or plural, any case) AND whose time parses to
 * HH:MM (12h with am/pm, or 24h) are emitted; everything else is skipped —
 * partial data beats malformed markup.
 */
export function buildOpeningHours(times: OpeningHoursInput[]): {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string;
  opens: string;
}[] {
  const out: { "@type": "OpeningHoursSpecification"; dayOfWeek: string; opens: string }[] = [];
  for (const entry of times) {
    const dayKey = entry.day.trim().toLowerCase().replace(/s$/, "");
    const dayOfWeek = DAY_OF_WEEK[dayKey];
    if (!dayOfWeek) continue;
    const match = entry.time.trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
    if (!match) continue;
    let hours = Number(match[1]);
    const minutes = match[2];
    const meridiem = match[3]?.toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours > 23 || Number(minutes) > 59) continue;
    out.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek,
      opens: `${String(hours).padStart(2, "0")}:${minutes}`,
    });
  }
  return out;
}
