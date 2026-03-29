import { checkChurchClaimed } from "@/lib/church";

export async function VerifiedChurchBadge({
  churchSlug,
  badgeEligible,
}: {
  churchSlug: string;
  badgeEligible: boolean;
}) {
  if (!badgeEligible) return null;

  const isClaimed = await checkChurchClaimed(churchSlug);
  if (!isClaimed) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-100"
      title="Verified church"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      Verified
    </span>
  );
}
