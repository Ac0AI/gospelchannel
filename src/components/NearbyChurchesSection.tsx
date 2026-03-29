import { NearbyChurches } from "@/components/NearbyChurches";
import { getNearbyChurches } from "@/lib/church";

type NearbyChurchesSectionProps = {
  churchSlug: string;
  latitude?: number | null;
  longitude?: number | null;
};

export async function NearbyChurchesSection({
  churchSlug,
  latitude,
  longitude,
}: NearbyChurchesSectionProps) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  const churches = await getNearbyChurches(churchSlug, latitude, longitude);
  if (churches.length === 0) return null;

  return <NearbyChurches churches={churches} />;
}
