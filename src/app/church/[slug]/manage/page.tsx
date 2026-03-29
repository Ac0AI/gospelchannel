import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerUser } from '@/lib/auth/server';
import { getChurchPageData } from '@/lib/church';
import { getChurchMembershipForUserAndSlug } from '@/lib/church-community';
import { getProfileEditsForChurch } from '@/lib/church-profile';
import { PROFILE_FIELDS, CHURCH_SIZE_LABELS, DAY_OPTIONS } from '@/lib/profile-fields';
import { ProfileManageClient } from './profile-manage-client';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Hantera profil — ${slug}`,
    robots: { index: false },
  };
}

export default async function ManagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);
  if (!user) redirect(`/church-admin/login?redirect=/church/${slug}/manage`);

  const membership = await getChurchMembershipForUserAndSlug(user.id, slug);
  if (!membership) redirect(`/church/${slug}`);

  const pageData = await getChurchPageData(slug);
  if (!pageData) redirect('/');

  const edits = await getProfileEditsForChurch(slug);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <a href={`/church/${slug}`} className="text-sm text-rose-500 hover:underline">
          ← Tillbaka till kyrksidan
        </a>
        <h1 className="mt-2 font-serif text-3xl font-bold">
          Hantera profil — {pageData.church.name}
        </h1>
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
