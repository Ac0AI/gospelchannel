import Link from "next/link";
import { ToolChurchGrid } from "@/components/tools/ToolCards";
import type { ToolChurchPreview } from "@/lib/tooling";

export type GuideChurchEvidenceGroup = {
  id: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  churches: ToolChurchPreview[];
};

export function GuideChurchEvidence({
  title = "Compare the guide against real profiles",
  intro,
  groups,
  toolName,
}: {
  title?: string;
  intro: string;
  groups: GuideChurchEvidenceGroup[];
  toolName: string;
}) {
  const visibleGroups = groups.filter((group) => group.churches.length > 0);
  if (visibleGroups.length === 0) return null;

  return (
    <section className="mt-14">
      <p className="gc-eyebrow">Profile evidence</p>
      <h2 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 max-w-[760px] text-sm leading-[1.7] text-warm-brown sm:text-base">
        {intro}
      </p>
      <div className="mt-8 space-y-10">
        {visibleGroups.map((group) => (
          <section key={group.id}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">
                  {group.title}
                </h3>
                <p className="mt-1 text-sm leading-[1.6] text-warm-brown">
                  {group.description}
                </p>
              </div>
              <Link
                href={group.href}
                className="text-sm font-bold text-rose-gold transition-colors hover:text-rose-gold-deep"
              >
                {group.linkLabel} &rarr;
              </Link>
            </div>
            <ToolChurchGrid
              churches={group.churches}
              toolName={toolName}
              labelPrefix={`${toolName}_${group.id}`}
            />
          </section>
        ))}
      </div>
    </section>
  );
}
