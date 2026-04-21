import Link from "next/link";
import { getNearbyChurchPlaceLabel } from "@/lib/content-quality";

type NearbyChurch = {
  slug: string;
  name: string;
  distance: number;
  country: string;
  location?: string;
};

function normalizePlacePart(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getVisiblePlaceLabel(church: NearbyChurch): string | undefined {
  const placeLabel = getNearbyChurchPlaceLabel(church.location, church.country);
  if (!placeLabel) return undefined;

  const normalizedName = normalizePlacePart(church.name);
  const placeParts = placeLabel.split(",").map((part) => part.trim()).filter(Boolean);
  const [primaryPart, ...remainingParts] = placeParts;

  if (primaryPart && normalizedName.endsWith(normalizePlacePart(primaryPart))) {
    return remainingParts.join(", ") || undefined;
  }

  if (normalizedName.endsWith(normalizePlacePart(placeLabel))) {
    return undefined;
  }

  return placeLabel;
}

export function NearbyChurches({ churches }: { churches: NearbyChurch[] }) {
  if (churches.length === 0) return null;

  return (
    <section>
      <h2 className="font-serif text-lg font-semibold text-espresso">Nearby Churches</h2>
      <p className="mt-1 text-sm text-warm-brown">Other churches in the area</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {churches.map((c) => {
          const placeLabel = getVisiblePlaceLabel(c);

          return (
            <Link
              key={c.slug}
              href={`/church/${c.slug}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-rose-200/60 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-blush-light"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-espresso">{c.name}</p>
                {placeLabel ? (
                  <p className="mt-0.5 text-xs text-muted-warm">{placeLabel}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-muted-warm">
                {c.distance < 1 ? "<1" : Math.round(c.distance)} km
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
