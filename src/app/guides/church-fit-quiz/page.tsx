import type { Metadata } from "next";
import { ChurchFitQuizClient } from "@/components/tools/ChurchFitQuizClient";
import { ToolPageTracker } from "@/components/tools/ToolPageTracker";
import { getChurchIndexData } from "@/lib/church";
import { buildDiscoveryLanes } from "@/lib/tooling";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Church Fit Quiz",
  description:
    "Answer seven fast questions about worship style, tradition, and Sunday priorities to find where you'll fit before your first visit.",
  alternates: { canonical: "https://gospelchannel.com/guides/church-fit-quiz" },
};

export default async function ChurchFitQuizPage() {
  const lanes = buildDiscoveryLanes(await getChurchIndexData());

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ToolPageTracker toolName="church_fit_quiz" />
      <ChurchFitQuizClient lanes={lanes} />
    </div>
  );
}
