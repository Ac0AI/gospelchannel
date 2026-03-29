import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { getServerUser } from "@/lib/auth/server";
import { getChurchMembershipsForUser } from "@/lib/church-community";
import { getChurchBySlugAsync } from "@/lib/content";
import { ChurchAdminLogoutButton } from "@/components/church-admin/ChurchAdminLogoutButton";
import { ChurchAdminUpdateForm } from "@/components/church-admin/ChurchAdminUpdateForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Church Admin — Gospel Channel",
  robots: { index: false, follow: false },
};

export default async function ChurchAdminPage() {
  const requestHeaders = await headers();
  const user = await getServerUser(requestHeaders);

  if (!user) {
    redirect("/church-admin/login");
  }

  const memberships = await getChurchMembershipsForUser(user.id);
  const churchesBySlug = new Map(
    await Promise.all(
      memberships.map(async (membership) => [membership.churchSlug, await getChurchBySlugAsync(membership.churchSlug)] as const)
    )
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-espresso">Church Admin</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-warm-brown">
            Submit official website, contact email, and playlist changes for your church. Updates go into review before they are applied to the public catalog.
          </p>
        </div>
        <ChurchAdminLogoutButton />
      </div>

      {memberships.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-sm text-warm-brown shadow-sm ring-1 ring-rose-200/70">
          No active church access was found for this account. Use the same email that was verified on your claim, or contact support if the claim was approved under a different address.
        </div>
      ) : (
        <div className="space-y-6">
          {memberships.map((membership) => {
            const church = churchesBySlug.get(membership.churchSlug);

            return (
              <article key={membership.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-rose-200/70">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold text-espresso">
                        {church?.name || membership.churchSlug}
                      </h2>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {membership.role}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-warm-brown">
                      <span>{membership.email}</span>
                      <span>{membership.churchSlug}</span>
                      {church?.country && <span>{church.country}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/church/${membership.churchSlug}`}
                      className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                    >
                      Open public page
                    </Link>
                    {church?.website && (
                      <a
                        href={church.website}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full bg-blush-light px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-rose-100"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-2xl bg-linen p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Current public data</div>
                    <dl className="mt-3 grid gap-3 text-sm text-warm-brown sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-espresso">Website</dt>
                        <dd>{church?.website || "Missing"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-espresso">Contact email</dt>
                        <dd>{church?.email || "Missing"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-espresso">Playlists</dt>
                        <dd>{church?.spotifyPlaylistIds.length || 0}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-espresso">Language</dt>
                        <dd>{church?.language || "Unknown"}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-2xl bg-linen p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-warm-brown">Submit update</div>
                    <p className="mt-2 text-sm leading-6 text-warm-brown">
                      Use this form for official fixes and playlist additions. Each submission is routed into the review queue with your claimed-owner identity attached.
                    </p>
                    <div className="mt-4">
                      <ChurchAdminUpdateForm
                        churchSlug={membership.churchSlug}
                        currentWebsite={church?.website}
                        currentEmail={church?.email}
                      />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
