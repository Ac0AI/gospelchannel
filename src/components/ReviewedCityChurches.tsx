import { ChurchDirectoryGrid } from "@/components/ChurchDirectoryGrid";
import type { ReviewedCityChurch } from "@/lib/official-church-review-data";

export function ReviewedCityChurches({ churches, cityName }: { churches: ReviewedCityChurch[]; cityName: string }) {
  if (!churches.length) return null;
  return (
    <section id="checked-visit-details" className="mx-auto mt-10 max-w-[1280px] scroll-mt-24 px-5 sm:px-12" aria-labelledby="checked-churches-heading">
      <p className="gc-eyebrow">Plan your Sunday</p>
      <h2 id="checked-churches-heading" className="mt-3 font-serif text-3xl font-semibold text-espresso">{cityName} churches with checked visit details</h2>
      <p className="mb-6 mt-3 max-w-3xl text-sm leading-relaxed text-warm-brown">
        These {churches.length} profiles link to official sources for service times and visiting information.
        {" "}Listed alphabetically, with details to help you choose what fits your visit.
      </p>
      <ChurchDirectoryGrid churches={churches} />
    </section>
  );
}
