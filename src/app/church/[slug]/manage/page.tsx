import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getServerUser } from '@/lib/auth/server';
import { getChurchPageData } from '@/lib/church';
import { getChurchMembershipForUserAndSlug, getChurchMembershipsForUser } from '@/lib/church-community';
import { getProfileEditsForChurch } from '@/lib/church-profile';
import { PROFILE_FIELDS, CHURCH_SIZE_LABELS, DAY_OPTIONS } from '@/lib/profile-fields';
import { ProfileManageClient } from './profile-manage-client';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Manage Profile — ${slug}`,
    robots: { index: false },
  };
}

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);
  if (!user) redirect(`/church-admin/login?redirect=/church/${slug}/manage`);

  const [membership, memberships, pageData, edits] = await Promise.all([
    getChurchMembershipForUserAndSlug(user.id, slug),
    getChurchMembershipsForUser(user.id),
    getChurchPageData(slug),
    getProfileEditsForChurch(slug),
  ]);

  if (!membership) redirect(`/church/${slug}`);
  if (!pageData) redirect('/');
  const hasMultipleChurches = memberships.length > 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href={`/church/${slug}`} className="text-sm text-rose-500 hover:underline">
            ← Back to church page
          </a>
          <h1 className="mt-2 font-serif text-3xl font-bold">
            Manage profile — {pageData.church.name}
          </h1>
        </div>
        {hasMultipleChurches ? (
          <Link href="/church-admin" className="text-sm text-warm-brown hover:text-espresso hover:underline">
            Choose another church
          </Link>
        ) : null}
      </div>

      <ProfileManageClient
        slug={slug}
        profileScore={pageData.profileScore}
        mergedProfile={pageData.mergedProfile}
        edits={edits}
        fields={PROFILE_FIELDS}
        churchSizeLabels={CHURCH_SIZE_LABELS}
        dayOptions={DAY_OPTIONS}
      />
    </div>
  );
}
