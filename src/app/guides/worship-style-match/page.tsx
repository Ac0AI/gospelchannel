import type { Metadata } from "next";
import { GuideChurchEvidence, GuideProofLinks, GuideRelated, type GuideChurchEvidenceGroup } from "@/components/guides";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { WorshipStyleMatchClient } from "@/components/tools/WorshipStyleMatchClient";
import { getChurchIndexPageData } from "@/lib/church";
import { buildGuideSchema, buildItemListSchema } from "@/lib/seo-schema";
import {
  buildSoundProfiles,
  getSoundProfileDirectoryFilters,
  toToolChurchPreview,
} from "@/lib/tooling";
import { serializeJsonLd } from "@/lib/json-ld";

export const revalidate = 3600;

const PAGE_URL = "https://gospelchannel.com/guides/worship-style-match";
const PAGE_TITLE = "Church Sound Match";
const META_DESCRIPTION =
  "Match your worship taste to church styles and open church pages that already sound closest to home.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: META_DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    images: [{ url: "https://gospelchannel.com/hero-worship.jpg" }],
    title: PAGE_TITLE,
    description: META_DESCRIPTION,
    url: PAGE_URL,
    siteName: "GospelChannel",
    type: "article",
  },
  twitter: {
    images: ["https://gospelchannel.com/hero-worship.jpg"],
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

export default async function WorshipStyleMatchPage() {
  const profiles = await Promise.all(
    buildSoundProfiles([]).map(async (profile) => {
      const page = await getChurchIndexPageData({
        filters: getSoundProfileDirectoryFilters(profile),
        page: 1,
        pageSize: 4,
      });
      return {
        ...profile,
        sampleChurches: page.pageItems.map(toToolChurchPreview),
      };
    }),
  );
  const evidenceGroups: GuideChurchEvidenceGroup[] = profiles.slice(0, 4).map((profile) => ({
    id: profile.id,
    title: profile.title,
    description: profile.description,
    href: profile.browse.href,
    linkLabel: profile.browse.label,
    churches: profile.sampleChurches.slice(0, 3),
  }));

  const schema = buildGuideSchema({
    slug: "worship-style-match",
    headline: "Church Sound Match",
    description: META_DESCRIPTION,
  });
  const soundLaneSchema = buildItemListSchema({
    name: "Church sound match worship lanes",
    items: profiles.map((profile) => ({
      name: profile.title,
      url: `https://gospelchannel.com${profile.browse.href}`,
    })),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([...schema, soundLaneSchema, ...buildEvidenceSchema(evidenceGroups)]),
        }}
      />
      <ToolPageTracker toolName="worship_style_match" />
      <GuideProofLinks
        title="Match the sound, then check the church details"
        intro="The sound match turns taste into worship-style lanes. Explore real church profiles with music, videos, service times, language, and location details before planning a visit."
        links={[
          {
            href: "/church/style/contemporary-worship",
            label: "Modern worship churches",
            description: "For anthem-led, current worship rooms with familiar band language.",
          },
          {
            href: "/church/style/charismatic",
            label: "Spirit-led churches",
            description: "For more open worship flow, prayer response, and expressive rooms.",
          },
          {
            href: "/church/style/gospel",
            label: "Gospel and choir churches",
            description: "For celebration-led worship, fuller room response, and choir energy.",
          },
          {
            href: "/church/churches-with-worship-music",
            label: "Churches with music",
            description: "Listen to the actual songs when the worship sound is the deciding factor.",
          },
        ]}
      />
      <WorshipStyleMatchClient profiles={profiles} />
      <GuideChurchEvidence
        title="Preview the worship lanes with real churches"
        intro="These churches are pulled from the same sound lanes the tool uses. Open the profiles to check whether the worship label is backed by music, style, service, and location evidence."
        groups={evidenceGroups}
        toolName="worship_style_match_guide"
      />
      <GuideRelated current="worship-style-match" />
    </div>
  );
}
