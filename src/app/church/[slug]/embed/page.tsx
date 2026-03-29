import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerUser } from '@/lib/auth/server';
import { getChurchPageData } from '@/lib/church';
import { getChurchMembershipForUserAndSlug } from '@/lib/church-community';
import { getSiteUrlFromHeaders } from '@/lib/site-url';
import { EmbedBadgeClient } from './embed-badge-client';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Verified Badge — ${slug}`,
    robots: { index: false },
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);
  if (!user) redirect(`/church-admin/login?redirect=/church/${slug}/embed`);

  const membership = await getChurchMembershipForUserAndSlug(user.id, slug);
  if (!membership) redirect(`/church/${slug}`);

  const pageData = await getChurchPageData(slug);
  if (!pageData) redirect('/');

  const { church } = pageData;
  const isVerified = pageData.profileScore.badgeStatus === 'verified';
  const siteUrl = getSiteUrlFromHeaders(requestHeaders);
  const churchUrl = `${siteUrl}/church/${slug}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <a
        href={`/church/${slug}/manage`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-warm-brown hover:text-espresso"
      >
        &larr; Tillbaka till profilen
      </a>

      <h1 className="font-serif text-3xl font-bold text-espresso">
        Din Verified Badge
      </h1>
      <p className="mt-2 text-warm-brown">
        Lägg till din GospelChannel Verified-badge på er hemsida.
      </p>

      {isVerified ? (
        <EmbedBadgeClient
          churchName={church.name}
          churchUrl={churchUrl}
        />
      ) : (
        <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <span className="text-2xl">🔒</span>
          </div>
          <h2 className="font-serif text-xl font-bold text-espresso">
            Nästan där
          </h2>
          <p className="mt-2 text-sm text-warm-brown">
            Fyll i de sista uppgifterna för att låsa upp din badge.
          </p>
          <div className="mt-4 space-y-1">
            {pageData.profileScore.missingForBadge.map(field => (
              <p key={field} className="text-sm text-yellow-700">
                {field === 'service_times' && '- Gudstjänsttider'}
                {field === 'address' && '- Adress (gata, stad, land)'}
                {field === 'contact' && '- Kontaktinfo (telefon eller e-post)'}
              </p>
            ))}
          </div>
          <a
            href={`/church/${slug}/manage`}
            className="mt-6 inline-block rounded-xl bg-rose-gold px-6 py-2.5 text-sm font-semibold text-white hover:bg-rose-gold-deep"
          >
            Komplettera profilen
          </a>
        </div>
      )}
    </main>
  );
}
