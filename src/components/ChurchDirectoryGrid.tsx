import { ChurchCard } from "@/components/ChurchCard";

type ChurchDirectoryGridItem = {
  slug: string;
  name: string;
  description: string;
  country: string;
  logo?: string;
  playlistCount?: number;
  updatedAt?: string;
  musicStyle?: string[];
  thumbnailUrl?: string;
  location?: string;
  enrichmentHint?: {
    summary?: string;
    serviceTimes?: string;
    location?: string;
  };
};

export function ChurchDirectoryGrid({ churches }: { churches: ChurchDirectoryGridItem[] }) {
  if (churches.length === 0) {
    return (
      <div className="rounded-2xl border border-rose-200/60 bg-white/80 px-5 py-10 text-center text-sm text-warm-brown shadow-sm">
        No churches matched this view yet.
      </div>
    );
  }

  return (
    <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {churches.map((church, index) => (
        <ChurchCard
          key={church.slug}
          slug={church.slug}
          name={church.name}
          description={church.description}
          country={church.country}
          playlistCount={church.playlistCount}
          updatedAt={church.updatedAt}
          musicStyle={church.musicStyle}
          thumbnailUrl={church.thumbnailUrl}
          logoUrl={church.logo}
          showFeedback={false}
          enrichmentLocation={church.enrichmentHint?.location || church.location}
          serviceTimes={church.enrichmentHint?.serviceTimes}
          enrichmentSummary={church.enrichmentHint?.summary}
          prefetch={index < 8}
        />
      ))}
    </div>
  );
}
