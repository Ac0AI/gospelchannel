import Link from "next/link";
import { getNearbyChurchPlaceLabel } from "@/lib/content-quality";

type NearbyChurch = {
  slug: string;
  name: string;
  distance: number;
  country: string;
  location?: string;
};

export function NearbyChurches({ churches }: { churches: NearbyChurch[] }) {
  if (churches.length === 0) return null;

  return (
    <section>
      <h2 className="font-serif text-lg font-semibold text-espresso">Nearby Churches</h2>
      <p className="mt-1 text-sm text-warm-brown">Other churches in the area</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {churches.map((c) => (
          <Link
            key={c.slug}
            href={`/church/${c.slug}`}
            className="flex items-center justify-between rounded-xl border border-rose-200/60 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-blush-light"
          >
            <div>
              <span className="text-sm font-semibold text-espresso">{c.name}</span>
              {getNearbyChurchPlaceLabel(c.location, c.country) && (
                <span className="ml-2 text-xs text-muted-warm">{getNearbyChurchPlaceLabel(c.location, c.country)}</span>
              )}
            </div>
            <span className="text-xs text-muted-warm">
              {c.distance < 1 ? "<1" : Math.round(c.distance)} km
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
