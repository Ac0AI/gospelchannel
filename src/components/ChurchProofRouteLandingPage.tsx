import Link from "next/link";
import type { ChurchDirectoryEntry } from "@/lib/church-directory";

type ProofRouteFaq = {
  question: string;
  answer: string;
};

type Breadcrumb = {
  href: string;
  label: string;
};

type RelatedLink = {
  href: string;
  label: string;
};

function truncate(value: string | undefined, maxLength = 96): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatLanguages(church: ChurchDirectoryEntry): string | null {
  const languages = Array.from(new Set([
    church.language,
    ...(church.enrichmentHint?.languages ?? []),
  ].filter((value): value is string => Boolean(value))));
  return languages.length > 0 ? languages.slice(0, 3).join(", ") : null;
}

function buildProofs(church: ChurchDirectoryEntry): string[] {
  const proofs = [
    church.enrichmentHint?.serviceTimes ? `Service: ${truncate(church.enrichmentHint.serviceTimes)}` : null,
    church.enrichmentHint?.childrenMinistry ? "Kids ministry" : null,
    church.enrichmentHint?.youthMinistry ? "Youth ministry" : null,
    formatLanguages(church) ? `Language: ${formatLanguages(church)}` : null,
    church.musicStyle?.[0] ? `Worship: ${church.musicStyle.slice(0, 2).join(", ")}` : null,
    church.playlistCount && church.playlistCount > 0 ? `${church.playlistCount} music signal${church.playlistCount === 1 ? "" : "s"}` : null,
    church.enrichmentHint?.location || church.location ? `Location: ${truncate(church.enrichmentHint?.location || church.location)}` : null,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(proofs)).slice(0, 4);
}

export function ChurchProofRouteLandingPage({
  canonicalPath,
  eyebrow,
  title,
  titleAccent,
  description,
  answer,
  methodology,
  count,
  churches,
  updatedIso,
  updatedLabel,
  breadcrumbs,
  faqs,
  relatedLinks,
}: {
  canonicalPath: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  description: string;
  answer: string;
  methodology: string;
  count: number;
  churches: ChurchDirectoryEntry[];
  updatedIso: string;
  updatedLabel: string;
  breadcrumbs: Breadcrumb[];
  faqs: ProofRouteFaq[];
  relatedLinks: RelatedLink[];
}) {
  const canonicalUrl = `https://gospelchannel.com${canonicalPath}`;
  const jsonLd: Array<Record<string, unknown>> = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${title} ${titleAccent}`,
      description,
      url: canonicalUrl,
      dateModified: updatedIso,
      mainEntity: { "@id": `${canonicalUrl}#itemlist` },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: `https://gospelchannel.com${crumb.href}`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${canonicalUrl}#itemlist`,
      name: `${title} ${titleAccent}`,
      numberOfItems: count,
      itemListElement: churches.map((church, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://gospelchannel.com/church/${church.slug}`,
        item: {
          "@type": "Church",
          "@id": `https://gospelchannel.com/church/${church.slug}`,
          name: church.name,
          url: `https://gospelchannel.com/church/${church.slug}`,
          description: buildProofs(church).join("; "),
          ...(church.logo ? { image: church.logo } : {}),
          address: {
            "@type": "PostalAddress",
            addressLocality: church.location ?? church.enrichmentHint?.location ?? undefined,
            addressCountry: church.country || undefined,
          },
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <main className="bg-linen text-espresso">
        <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-12 sm:py-20">
          <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted-warm">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.href} className="inline-flex items-center gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-espresso">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="text-muted-warm transition-colors hover:text-espresso">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>
            {eyebrow}
          </p>
          <h1
            className="mt-3 mb-0 font-serif font-semibold leading-[0.95] tracking-[-0.02em]"
            style={{ fontSize: "clamp(38px, 6vw, 68px)" }}
          >
            {title} <em className="gc-italic">{titleAccent}</em>
          </h1>

          <p className="mt-6 max-w-[760px] text-lg leading-relaxed text-espresso/80 sm:text-xl">
            {answer}
          </p>

          <p className="mt-3 text-xs text-muted-warm">Updated {updatedLabel}</p>

          {count === 0 ? (
            <p className="mt-10 text-muted-warm">No churches matched this proof route yet.</p>
          ) : (
            <>
              <div className="mt-10 overflow-x-auto rounded-2xl border border-rose-gold/20 bg-white/60">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-rose-gold/20 text-[11px] uppercase tracking-[0.08em] text-muted-warm">
                      <th className="px-4 py-3 font-semibold">Church</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Tradition</th>
                      <th className="px-4 py-3 font-semibold">Language</th>
                      <th className="px-4 py-3 font-semibold">Profile proof</th>
                    </tr>
                  </thead>
                  <tbody>
                    {churches.map((church) => {
                      const proofs = buildProofs(church);
                      return (
                        <tr key={church.slug} className="border-b border-rose-gold/10 last:border-0 align-top">
                          <td className="px-4 py-3">
                            <Link
                              href={`/church/${church.slug}`}
                              className="font-medium text-espresso underline decoration-rose-gold/40 underline-offset-2 hover:decoration-rose-gold"
                            >
                              {church.name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-espresso/75">{church.location || church.country || "-"}</td>
                          <td className="px-4 py-3 text-espresso/75">{church.denomination ?? "-"}</td>
                          <td className="px-4 py-3 text-espresso/75">{formatLanguages(church) ?? "-"}</td>
                          <td className="px-4 py-3 text-espresso/75">
                            {proofs.length > 0 ? proofs.join(" / ") : "Profile data available"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-xs text-muted-warm">{methodology}</p>
            </>
          )}

          {relatedLinks.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2.5">
              {relatedLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-rose-gold/20 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:text-espresso"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          <section className="mt-16">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">Frequently asked questions</h2>
            <dl className="mt-6 space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question} className="border-b border-rose-gold/10 pb-6 last:border-0">
                  <dt className="font-semibold text-espresso">{faq.question}</dt>
                  <dd className="mt-2 max-w-[760px] leading-relaxed text-espresso/80">{faq.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </main>
    </>
  );
}
