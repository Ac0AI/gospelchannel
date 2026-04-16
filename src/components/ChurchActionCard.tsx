import Link from "next/link";
import { ChurchContactButton } from "@/components/ChurchContactButton";

type ChurchActionCardProps = {
  churchSlug: string;
  displayName: string;
  streetAddress?: string;
  city?: string;
  country?: string;
  googleMapsUrl?: string;
  phone?: string;
  contactEmail?: string;
  hasContactForm: boolean;
  websiteUrl?: string;
  websiteHostLabel?: string;
  livestreamUrl?: string;
  givingUrl?: string;
  isClaimed: boolean;
};

function buildDirectionsHref({
  googleMapsUrl,
  streetAddress,
  city,
  country,
}: {
  googleMapsUrl?: string;
  streetAddress?: string;
  city?: string;
  country?: string;
}): string | undefined {
  if (googleMapsUrl) return googleMapsUrl;
  const query = [streetAddress, city, country].filter(Boolean).join(", ");
  if (!query) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function ChurchActionCard(props: ChurchActionCardProps) {
  const {
    churchSlug,
    displayName,
    streetAddress,
    city,
    country,
    googleMapsUrl,
    phone,
    contactEmail,
    hasContactForm,
    websiteUrl,
    websiteHostLabel,
    livestreamUrl,
    givingUrl,
    isClaimed,
  } = props;

  const directionsHref = buildDirectionsHref({ googleMapsUrl, streetAddress, city, country });
  const hasAnyAction = Boolean(
    directionsHref || phone || contactEmail || hasContactForm || websiteUrl || livestreamUrl || givingUrl
  );
  if (!hasAnyAction && isClaimed) return null;

  return (
    <div className="rounded-2xl border border-rose-200/60 bg-white/90 p-5 shadow-sm backdrop-blur-sm sm:p-6">
      {hasAnyAction && (
        <>
          <h2 className="font-serif text-base font-semibold text-espresso">Visit or contact</h2>
          <div className="mt-4 space-y-2">
            {directionsHref && (
              <a
                href={directionsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-gold px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-rose-gold-deep hover:shadow-md"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                </svg>
                Get directions
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-espresso/15 bg-white px-4 py-2.5 text-sm font-semibold text-espresso transition-all hover:border-espresso/30 hover:bg-linen-deep/40"
              >
                <svg className="h-4 w-4 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                </svg>
                Call church
              </a>
            )}
            {contactEmail ? (
              <a
                href={`mailto:${contactEmail}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-espresso/15 bg-white px-4 py-2.5 text-sm font-semibold text-espresso transition-all hover:border-espresso/30 hover:bg-linen-deep/40"
              >
                <svg className="h-4 w-4 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                Email
              </a>
            ) : hasContactForm ? (
              <ChurchContactButton churchSlug={churchSlug} churchName={displayName} />
            ) : null}
            {websiteUrl && websiteHostLabel && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-espresso/15 bg-white px-4 py-2.5 text-sm font-semibold text-espresso transition-all hover:border-espresso/30 hover:bg-linen-deep/40"
              >
                <svg className="h-4 w-4 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                {websiteHostLabel} ↗
              </a>
            )}
            {livestreamUrl && (
              <a
                href={livestreamUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-espresso/15 bg-white px-4 py-2.5 text-sm font-semibold text-espresso transition-all hover:border-espresso/30 hover:bg-linen-deep/40"
              >
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
                Watch live ↗
              </a>
            )}
            {givingUrl && (
              <a
                href={givingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-espresso/15 bg-white px-4 py-2.5 text-sm font-semibold text-espresso transition-all hover:border-espresso/30 hover:bg-linen-deep/40"
              >
                <svg className="h-4 w-4 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
                Give ↗
              </a>
            )}
          </div>
        </>
      )}

      {!isClaimed && (
        <div className={hasAnyAction ? "mt-5 border-t border-rose-200/40 pt-5" : ""}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">For church leaders</p>
          <p className="mt-2 text-sm text-warm-brown">Is this your church? Claim the page to keep info current.</p>
          <Link
            href={`/church/${churchSlug}/claim`}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-gold transition-colors hover:text-rose-gold-deep"
          >
            Claim this page →
          </Link>
        </div>
      )}
      {isClaimed && hasAnyAction && (
        <div className="mt-5 flex items-center gap-2 border-t border-rose-200/40 pt-4 text-xs font-semibold text-blue-700">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Verified by church leaders
        </div>
      )}
    </div>
  );
}
