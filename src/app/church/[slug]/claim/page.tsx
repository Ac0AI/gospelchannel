import { notFound } from "next/navigation";
import { getChurchBySlugAsync } from "@/lib/content";
import { ClaimChurchForm } from "@/components/ClaimChurchForm";

type ClaimPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;

export default async function ClaimChurchPage({ params }: ClaimPageProps) {
  const { slug } = await params;
  const church = await getChurchBySlugAsync(slug);

  if (!church) {
    notFound();
  }

  return <ClaimChurchForm slug={church.slug} churchName={church.name} />;
}
