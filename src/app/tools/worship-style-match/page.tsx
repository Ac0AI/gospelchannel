import type { Metadata } from "next";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { WorshipStyleMatchClient } from "@/components/tools/WorshipStyleMatchClient";
import { getChurchIndexData } from "@/lib/church";
import { buildSoundProfiles } from "@/lib/tooling";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Church Sound Match",
  description:
    "Match your worship taste to church styles and open church pages that already sound closest to home.",
  alternates: { canonical: "https://gospelchannel.com/tools/worship-style-match" },
};

export default async function WorshipStyleMatchPage() {
  const profiles = buildSoundProfiles(await getChurchIndexData());

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ToolPageTracker toolName="worship_style_match" />
      <WorshipStyleMatchClient profiles={profiles} />
    </div>
  );
}
