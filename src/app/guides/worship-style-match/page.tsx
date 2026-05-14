import type { Metadata } from "next";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { WorshipStyleMatchClient } from "@/components/tools/WorshipStyleMatchClient";
import { getChurchIndexPageData } from "@/lib/church";
import { buildGuideSchema } from "@/lib/seo-schema";
import {
  buildSoundProfiles,
  getSoundProfileDirectoryFilters,
  toToolChurchPreview,
} from "@/lib/tooling";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Church Sound Match",
  description:
    "Match your worship taste to church styles and open church pages that already sound closest to home.",
  alternates: { canonical: "https://gospelchannel.com/guides/worship-style-match" },
};

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

  const schema = buildGuideSchema({
    slug: "worship-style-match",
    headline: "Church Sound Match",
    description:
      "Match your worship taste to church styles and open church pages that already sound closest to home.",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <ToolPageTracker toolName="worship_style_match" />
      <WorshipStyleMatchClient profiles={profiles} />
    </div>
  );
}
