import type { ChurchEnrichment } from "@/types/gospel";
import { ServiceTimesDisplay } from "./ServiceTimesDisplay";
import {
  isValidPublicEmail,
  isValidPublicPhone,
  isValidPublicUrl,
  normalizeDisplayText,
  sanitizeServiceTimes,
} from "@/lib/content-quality";

export function ChurchEnrichmentInfo({ enrichment, inline = false }: { enrichment: ChurchEnrichment; inline?: boolean }) {
  const serviceTimes = sanitizeServiceTimes(enrichment.serviceTimes);
  const streetAddress = normalizeDisplayText(enrichment.streetAddress);
  const contactEmail = isValidPublicEmail(enrichment.contactEmail) ? enrichment.contactEmail : undefined;
  const phone = isValidPublicPhone(enrichment.phone) ? enrichment.phone : undefined;
  const hasContact = Boolean(contactEmail || phone);
  const hasMinistries = enrichment.childrenMinistry || enrichment.youthMinistry || (enrichment.ministries && enrichment.ministries.length > 0);

  const Wrapper = inline ? "div" : "section";

  return (
    <Wrapper className={inline ? "" : "overflow-hidden rounded-2xl border border-rose-200/60 bg-white shadow-sm"}>
      <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
        {streetAddress && (
          <div>
            <h3 className="flex items-center gap-1.5 font-serif text-sm font-semibold text-espresso">
              <svg className="h-3.5 w-3.5 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
              Location
            </h3>
            <p className="mt-1 text-sm text-warm-brown">{streetAddress}</p>
            {isValidPublicUrl(enrichment.googleMapsUrl) && (
              <a href={enrichment.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-rose-gold hover:text-rose-gold-deep">
                Open in Google Maps →
              </a>
            )}
          </div>
        )}

        {serviceTimes.length > 0 && (
          <div>
            <h3 className="flex items-center gap-1.5 font-serif text-sm font-semibold text-espresso">
              <svg className="h-3.5 w-3.5 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Service Times
            </h3>
            <div className="mt-1"><ServiceTimesDisplay times={serviceTimes} /></div>
          </div>
        )}

        {hasContact && (
          <div>
            <h3 className="flex items-center gap-1.5 font-serif text-sm font-semibold text-espresso">
              <svg className="h-3.5 w-3.5 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
              Contact
            </h3>
            <div className="mt-1 space-y-1 text-sm text-warm-brown">
              {contactEmail && <a href={`mailto:${contactEmail}`} className="block hover:text-rose-gold">{contactEmail}</a>}
              {phone && <a href={`tel:${phone}`} className="block hover:text-rose-gold">{phone}</a>}
            </div>
          </div>
        )}

        {/* Social links moved to SocialPresenceSection */}

        {(enrichment.theologicalOrientation || enrichment.languages) && (
          <div>
            <h3 className="flex items-center gap-1.5 font-serif text-sm font-semibold text-espresso">
              <svg className="h-3.5 w-3.5 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
              About
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {enrichment.theologicalOrientation && <span className="rounded-full bg-linen-deep px-3 py-1 text-xs text-warm-brown">{enrichment.theologicalOrientation}</span>}
              {enrichment.denominationNetwork && <span className="rounded-full bg-linen-deep px-3 py-1 text-xs text-warm-brown">{enrichment.denominationNetwork}</span>}
              {enrichment.languages?.map((lang) => <span key={lang} className="rounded-full border border-blush px-3 py-1 text-xs text-warm-brown">{lang}</span>)}
            </div>
          </div>
        )}

        {hasMinistries && (
          <div>
            <h3 className="flex items-center gap-1.5 font-serif text-sm font-semibold text-espresso">
              <svg className="h-3.5 w-3.5 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
              Ministries
            </h3>
            <div className="mt-1 flex flex-wrap gap-2">
              {enrichment.childrenMinistry && <span className="rounded-full bg-linen-deep px-3 py-1 text-xs text-warm-brown">Children</span>}
              {enrichment.youthMinistry && <span className="rounded-full bg-linen-deep px-3 py-1 text-xs text-warm-brown">Youth</span>}
              {enrichment.ministries?.map((m) => <span key={m} className="rounded-full bg-linen-deep px-3 py-1 text-xs text-warm-brown">{m}</span>)}
            </div>
          </div>
        )}
      </div>

      {enrichment.summary && (
        <div className="border-t border-rose-200/40 px-5 py-4 sm:px-6">
          <p className="text-sm leading-relaxed text-warm-brown">{enrichment.summary}</p>
        </div>
      )}
    </Wrapper>
  );
}
