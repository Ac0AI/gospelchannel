import Link from "next/link";
import { getNetworkCampusCount, getNetworkForWorshipChurch } from "@/lib/church-networks";

export async function ChurchNetworkSection({ churchSlug }: { churchSlug: string }) {
  const network = await getNetworkForWorshipChurch(churchSlug);
  if (!network) return null;

  const campusCount = await getNetworkCampusCount(network.id);
  if (campusCount <= 0) return null;

  return (
    <div className="flex items-center justify-between rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="font-serif text-lg font-semibold text-espresso">{network.name} Worldwide</h2>
        <p className="mt-1 text-sm text-warm-brown">{campusCount} {campusCount === 1 ? "campus" : "campuses"} around the world</p>
      </div>
      <Link
        href={`/network/${network.slug}`}
        className="shrink-0 rounded-full bg-rose-gold px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep"
      >
        View all →
      </Link>
    </div>
  );
}
