import { ToolTrackedLink } from "@/components/tools/ToolTrackedLink";
import type { ToolChurchPreview } from "@/lib/tooling";

type ToolActionCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  href: string;
  label: string;
  toolName: string;
  resultType: string;
  resultLabel?: string;
  markComplete?: boolean;
};

function initialsFromName(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter((value) => value.length > 0)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "")
    .join("");
}

export function ToolActionCard({
  eyebrow,
  title,
  description,
  href,
  label,
  toolName,
  resultType,
  resultLabel = title,
  markComplete = false,
}: ToolActionCardProps) {
  return (
    <article className="rounded-2xl border border-rose-200/60 bg-white/80 p-5 shadow-sm">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mauve">{eyebrow}</p>
      ) : null}
      <h3 className="mt-2 font-serif text-xl font-semibold text-espresso">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-warm-brown">{description}</p>
      <ToolTrackedLink
        href={href}
        toolName={toolName}
        resultType={resultType}
        resultLabel={resultLabel}
        markComplete={markComplete}
        className="mt-4 inline-flex rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
      >
        {label}
      </ToolTrackedLink>
    </article>
  );
}

function ToolChurchCard({
  church,
  toolName,
  labelPrefix,
}: {
  church: ToolChurchPreview;
  toolName: string;
  labelPrefix: string;
}) {
  const initials = initialsFromName(church.name);
  const styleLabel = church.musicStyle?.[0];
  const description = church.description.length > 124 ? `${church.description.slice(0, 121).trimEnd()}...` : church.description;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-rose-200/60 bg-white/85 p-4 shadow-sm">
      <div className="relative mb-3 h-32 overflow-hidden rounded-xl bg-gradient-to-br from-[#f8ede8] to-[#e7d2c6]">
        {church.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={church.thumbnailUrl} alt={church.name} className="h-full w-full object-cover" />
        ) : church.logo ? (
          <div className="flex h-full items-center justify-center bg-white/85 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={church.logo} alt={church.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-semibold text-rose-gold">{initials}</div>
        )}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <span className="inline-flex rounded-full bg-blush-light px-2 py-0.5 text-[11px] font-semibold text-rose-gold-deep">
            {church.country}
          </span>
          {styleLabel ? (
            <span className="inline-flex rounded-full border border-rose-200/70 px-2 py-0.5 text-[11px] font-medium text-muted-warm">
              {styleLabel}
            </span>
          ) : null}
        </div>
        <h3 className="font-serif text-lg font-semibold text-espresso">{church.name}</h3>
        {church.location ? <p className="mt-1 text-xs text-muted-warm">{church.location}</p> : null}
        {church.serviceTimes ? <p className="mt-1 text-xs font-medium text-emerald-700">{church.serviceTimes}</p> : null}
        <p className="mt-3 flex-1 text-sm leading-relaxed text-warm-brown">{description}</p>
        <ToolTrackedLink
          href={church.href}
          toolName={toolName}
          resultType="church"
          resultLabel={`${labelPrefix}:${church.slug}`}
          className="mt-4 inline-flex w-fit rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-rose-gold transition-colors hover:border-rose-300 hover:bg-blush-light"
        >
          Open church
        </ToolTrackedLink>
      </div>
    </article>
  );
}

export function ToolChurchGrid({
  churches,
  toolName,
  labelPrefix,
}: {
  churches: ToolChurchPreview[];
  toolName: string;
  labelPrefix: string;
}) {
  if (churches.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-200/60 bg-white/75 px-5 py-10 text-center text-sm text-warm-brown shadow-sm">
        We are still building this lane. Start with the browse links above and explore from there.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {churches.map((church) => (
        <ToolChurchCard key={church.slug} church={church} toolName={toolName} labelPrefix={labelPrefix} />
      ))}
    </div>
  );
}

export function ToolChurchChips({
  churches,
  toolName,
  labelPrefix,
}: {
  churches: ToolChurchPreview[];
  toolName: string;
  labelPrefix: string;
}) {
  if (churches.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {churches.map((church) => (
        <ToolTrackedLink
          key={church.slug}
          href={church.href}
          toolName={toolName}
          resultType="church"
          resultLabel={`${labelPrefix}:${church.slug}`}
          className="inline-flex rounded-full border border-rose-200/70 bg-white px-3 py-1.5 text-xs font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light hover:text-espresso"
        >
          {church.name}
        </ToolTrackedLink>
      ))}
    </div>
  );
}
