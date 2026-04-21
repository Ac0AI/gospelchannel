import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { ChurchActionCard } from "@/components/ChurchActionCard";
import { ChurchContactButton } from "@/components/ChurchContactButton";
import { ChurchLatestUpdatesSection } from "@/components/ChurchLatestUpdatesSection";
import { ChurchNetworkSection } from "@/components/ChurchNetworkSection";
import { FollowChurchButton } from "@/components/FollowChurchButton";
import { NearbyChurchesSection } from "@/components/NearbyChurchesSection";
import { PlayAllButton } from "@/components/PlayAllButton";
import { ServiceTimesDisplay } from "@/components/ServiceTimesDisplay";
import { SpotifyEmbedCard } from "@/components/SpotifyEmbedCard";
import { SpotifyPlaylistShelf } from "@/components/SpotifyPlaylistShelf";
import { ChurchPagePrayerSection } from "@/components/ChurchPagePrayerSection";
import { ChurchViewerActions } from "@/components/ChurchViewerActions";
import { getPrayers } from "@/lib/prayer";
import { HelpImproveCard, type MissingField } from "@/components/HelpImproveCard";
import { ClaimInterstitial, ClaimFooterLink, type ChurchPageClaimCtaMode } from "@/components/ClaimSection";
import { VideoGrid } from "@/components/VideoGrid";
import {
  extractCity,
  getPrimaryDenominationFilter,
  getPrimaryStyleFilter,
} from "@/lib/church-directory";
import { buildChurchAliases, checkChurchClaimed, getChurchPublicPageData, resolveChurchPrimaryImage } from "@/lib/church";
import {
  getFirstServiceTimeLabel,
  getPublicHostLabel,
  isPlayableSpotifyUrl,
  isValidPublicEmail,
  isValidOfficialWebsiteUrl,
  isValidPublicPhone,
  isValidPublicUrl,
  normalizeDisplayText,
  sanitizeServiceTimes,
} from "@/lib/content-quality";
import { getMusicPlatformLinks } from "@/lib/music-platform";
import { slugify } from "@/lib/prayer-filters";
import { uniqueSpotifyPlaylistIds } from "@/lib/spotify-playlist";
import { ScrollReveal } from "@/components/ScrollReveal";
import { HeroImage } from "@/components/HeroImage";
import { resolveCanonicalChurchSlug } from "@/lib/church-slugs";
import { CHURCH_SIZE_LABELS, getProfileOptionLabel } from "@/lib/profile-fields";
import { buildChurchDescription, buildChurchTitle } from "@/lib/church-metadata";

type ChurchPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;
export const dynamic = "force-static";

async function ChurchPrayerSection({ churchSlug, churchName }: { churchSlug: string; churchName: string }) {
  const prayers = await getPrayers({ churchSlug, limit: 5 });
  return (
    <ChurchPagePrayerSection
      churchSlug={churchSlug}
      churchName={churchName}
      initialPrayers={prayers}
    />
  );
}

/* ─── helpers ─── */

function formatSocialCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

function normalizeChurchNameForMatch(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function pickDisplayChurchName(churchName: string, officialChurchName?: string): string {
  const official = normalizeDisplayText(officialChurchName);
  if (!official) return churchName;

  const baseTokens = new Set(normalizeChurchNameForMatch(churchName));
  const officialTokens = new Set(normalizeChurchNameForMatch(official));
  if (baseTokens.size === 0 || officialTokens.size === 0) return churchName;

  let overlap = 0;
  for (const token of baseTokens) {
    if (officialTokens.has(token)) overlap += 1;
  }

  const tokenSimilarity = (2 * overlap) / (baseTokens.size + officialTokens.size);
  return tokenSimilarity >= 0.6 ? official : churchName;
}

/* ─── metadata (unchanged) ─── */

export async function generateMetadata({ params }: ChurchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const canonicalSlug = resolveCanonicalChurchSlug(slug);
  const pageData = await getChurchPublicPageData(canonicalSlug);

  if (!pageData) {
    return { title: "Church Not Found" };
  }

  const { church, enrichment, mergedProfile } = pageData;
  const displayName = pickDisplayChurchName(church.name, enrichment?.officialChurchName);
  const hasPlaylists = (church.spotifyPlaylistIds?.length ?? 0) > 0
    || (church.additionalPlaylists?.length ?? 0) > 0;

  const metadataInput = { church, enrichment, mergedProfile, displayName };
  const title = buildChurchTitle(metadataInput);
  const seoDesc = buildChurchDescription(metadataInput);

  const aliases = buildChurchAliases(church);
  const keywordSet = new Set<string>([
    `${church.name} church`, `${church.name} worship`, `${church.name} music`,
    ...(hasPlaylists ? [`${church.name} playlist`, `${church.name} worship playlist`, `${church.name} spotify`] : []),
    `${church.name} songs`, `${church.name} worship songs`, "church worship",
  ]);
  for (const alias of aliases) {
    keywordSet.add(`${alias} church`);
    keywordSet.add(`${alias} music`);
  }

  const pageUrl = `https://gospelchannel.com/church/${church.slug}`;

  return {
    title,
    description: seoDesc,
    keywords: Array.from(keywordSet).slice(0, 20),
    alternates: { canonical: pageUrl },
    openGraph: { title, description: seoDesc, type: "website", url: pageUrl, siteName: "GospelChannel" },
    twitter: { card: "summary_large_image", title, description: seoDesc },
  };
}

/* ─── page ─── */

export default async function ChurchDetailPage({ params }: ChurchPageProps) {
  const { slug } = await params;
  const canonicalSlug = resolveCanonicalChurchSlug(slug);
  if (canonicalSlug !== slug) {
    permanentRedirect(`/church/${canonicalSlug}`);
  }

  const pageData = await getChurchPublicPageData(canonicalSlug);
  if (!pageData) notFound();

  const { church, videos, latestUpdates, enrichment, mergedProfile } = pageData;
  const network = "network" in pageData ? pageData.network as import("@/types/gospel").ChurchNetwork | undefined : undefined;
  const isCampus = "isCampus" in pageData ? (pageData.isCampus as boolean) : false;
  const parentChurchName = "parentChurchName" in pageData ? (pageData.parentChurchName as string | undefined) : undefined;
  const isClaimed = await checkChurchClaimed(church.slug);
  const claimCtaMode: ChurchPageClaimCtaMode = isClaimed ? "claimed" : "unclaimed";

  const spotifyPlaylistIds = uniqueSpotifyPlaylistIds([
    ...church.spotifyPlaylistIds,
    ...(church.additionalPlaylists ?? []),
  ]);
  const playlistMetaById = new Map((church.spotifyPlaylists ?? []).map((p) => [p.id, p]));
  const allPlaylists = spotifyPlaylistIds.map((playlistId, index) => {
    const meta = playlistMetaById.get(playlistId);
    const isPrimary = meta?.primary ?? index === 0;
    return {
      playlistId,
      title: meta?.title ?? (isPrimary ? `${church.name} Start Here` : `${church.name} Collection ${index + 1}`),
      subtitle: meta?.subtitle ?? (isPrimary ? "Primary playlist for first-time visitors" : `More from ${church.name}`),
      description: meta?.description,
      tag: isPrimary ? "Start Here" : undefined,
      href: index === 0 && church.spotifyUrl ? church.spotifyUrl : `https://open.spotify.com/playlist/${playlistId}`,
    };
  });
  const primaryPlaylist = allPlaylists[0] ?? null;

  const crossPlatformLinks = getMusicPlatformLinks({
    title: `${church.name} worship songs`,
    channelTitle: church.name,
  }).filter((p) => p.id !== "spotify");

  const styles = church.musicStyle?.slice(0, 5) ?? [];
  const topArtists = church.notableArtists?.slice(0, 6) ?? [];
  const primaryStyleFilter = getPrimaryStyleFilter(church);
  const heroImage = resolveChurchPrimaryImage({
    headerImage: church.headerImage,
    videos,
    coverImageUrl: (mergedProfile.coverImageUrl as string | undefined) || enrichment?.coverImageUrl,
  }) || "";
  const churchLogo = isValidPublicUrl((mergedProfile.logoUrl as string | undefined) || enrichment?.logoImageUrl || church.logo)
    ? ((mergedProfile.logoUrl as string | undefined) || enrichment?.logoImageUrl || church.logo)!
    : null;
  const websiteUrl = isValidOfficialWebsiteUrl((mergedProfile.websiteUrl as string | undefined) || enrichment?.websiteUrl || church.website)
    ? ((mergedProfile.websiteUrl as string | undefined) || enrichment?.websiteUrl || church.website)
    : undefined;
  const websiteHostLabel = getPublicHostLabel(websiteUrl);
  const displayName = pickDisplayChurchName(church.name, enrichment?.officialChurchName);
  const serviceTimes = sanitizeServiceTimes(
    (mergedProfile.serviceTimes as import("@/types/gospel").ServiceTime[] | undefined) || enrichment?.serviceTimes
  );
  const serviceTimeLabel = getFirstServiceTimeLabel(serviceTimes);
  const streetAddress = normalizeDisplayText((mergedProfile.streetAddress as string | undefined) || enrichment?.streetAddress);
  const city = normalizeDisplayText(mergedProfile.city as string | undefined) || extractCity(church.location);
  const rawEmail = (mergedProfile.contactEmail as string | undefined) || enrichment?.contactEmail || church.email;
  const hasValidEmail = isValidPublicEmail(rawEmail);
  // Email is only exposed publicly when the church is human-verified AND has explicitly opted in.
  // Otherwise visitors use the contact form, which forwards to the email server-side.
  const emailVisiblePublicly = Boolean(church.verifiedAt && church.showEmailPublicly);
  const contactEmail = hasValidEmail && emailVisiblePublicly ? rawEmail : undefined;
  const phone = isValidPublicPhone((mergedProfile.phone as string | undefined) || enrichment?.phone)
    ? ((mergedProfile.phone as string | undefined) || enrichment?.phone)
    : undefined;
  const communityDenomination = normalizeDisplayText((mergedProfile.denomination as string | undefined) || enrichment?.denominationNetwork || church.denomination);
  const communitySize = normalizeDisplayText((mergedProfile.churchSize as string | undefined) || enrichment?.churchSize);
  const communityLanguages = Array.isArray(mergedProfile.languages)
    ? (mergedProfile.languages as string[])
    : (enrichment?.languages ?? []);
  const communityMinistries = Array.isArray(mergedProfile.ministries)
    ? (mergedProfile.ministries as string[])
    : (enrichment?.ministries ?? []);
  const aboutDescription =
    normalizeDisplayText((mergedProfile.description as string | undefined) || enrichment?.summary || church.description)
    || church.description;
  const primaryDenominationFilter = getPrimaryDenominationFilter({ denomination: communityDenomination });

  // Social stats for hero
  const socialStats: { platform: string; count: number; url?: string }[] = [];
  const youtubeUrl = isValidPublicUrl((mergedProfile.youtubeUrl as string | undefined) || enrichment?.youtubeUrl || church.youtubeUrl)
    ? ((mergedProfile.youtubeUrl as string | undefined) || enrichment?.youtubeUrl || church.youtubeUrl)!
    : undefined;
  const instagramUrl = isValidPublicUrl((mergedProfile.instagramUrl as string | undefined) || enrichment?.instagramUrl || church.instagramUrl)
    ? ((mergedProfile.instagramUrl as string | undefined) || enrichment?.instagramUrl || church.instagramUrl)!
    : undefined;
  const facebookUrl = isValidPublicUrl((mergedProfile.facebookUrl as string | undefined) || enrichment?.facebookUrl || church.facebookUrl)
    ? ((mergedProfile.facebookUrl as string | undefined) || enrichment?.facebookUrl || church.facebookUrl)!
    : undefined;

  if (enrichment?.youtubeSubscribers && youtubeUrl) {
    socialStats.push({ platform: "YouTube", count: enrichment.youtubeSubscribers, url: youtubeUrl });
  }
  if (enrichment?.instagramFollowers && instagramUrl) {
    socialStats.push({ platform: "Instagram", count: enrichment.instagramFollowers, url: instagramUrl });
  }
  if (enrichment?.facebookFollowers && facebookUrl) {
    socialStats.push({ platform: "Facebook", count: enrichment.facebookFollowers, url: facebookUrl });
  }

  // Social links (even without counts)
  const socialLinks: { platform: string; url: string; icon: string }[] = [];
  if (youtubeUrl) socialLinks.push({ platform: "YouTube", url: youtubeUrl, icon: "youtube" });
  if (instagramUrl) socialLinks.push({ platform: "Instagram", url: instagramUrl, icon: "instagram" });
  if (facebookUrl) socialLinks.push({ platform: "Facebook", url: facebookUrl, icon: "facebook" });

  // Quick facts for hero pills
  const quickFacts: string[] = [];
  if (streetAddress) {
    quickFacts.push(streetAddress.split(",")[0] ?? streetAddress);
  } else if (church.location) {
    quickFacts.push(church.location);
  }
  if (communityDenomination) quickFacts.push(getProfileOptionLabel(communityDenomination));
  if (serviceTimeLabel) quickFacts.push(serviceTimeLabel);
  if (communitySize) {
    quickFacts.push(CHURCH_SIZE_LABELS[communitySize] ?? getProfileOptionLabel(communitySize));
  }
  if (communityLanguages.length > 0) {
    quickFacts.push(communityLanguages.map((language) => getProfileOptionLabel(language)).join(", "));
  }
  if (church.founded) quickFacts.push(`Since ${church.founded}`);

  // New profile fields
  const pastorName = (mergedProfile.pastorName as string | undefined) || enrichment?.pastorName || undefined;
  const pastorTitle = (mergedProfile.pastorTitle as string | undefined) || enrichment?.pastorTitle || undefined;
  const livestreamUrl = isValidPublicUrl((mergedProfile.livestreamUrl as string | undefined) || enrichment?.livestreamUrl)
    ? ((mergedProfile.livestreamUrl as string | undefined) || enrichment?.livestreamUrl)
    : undefined;
  const givingUrl = isValidPublicUrl((mergedProfile.givingUrl as string | undefined) || enrichment?.givingUrl)
    ? ((mergedProfile.givingUrl as string | undefined) || enrichment?.givingUrl)
    : undefined;
  const whatToExpect = (mergedProfile.whatToExpect as string | undefined) || enrichment?.whatToExpect || undefined;
  const pastorPhotoUrl = (mergedProfile.pastorPhotoUrl as string | undefined) || enrichment?.pastorPhotoUrl || undefined;
  const serviceDurationMinutes = (mergedProfile.serviceDurationMinutes as number | undefined) || enrichment?.serviceDurationMinutes || undefined;
  const parkingInfo = (mergedProfile.parkingInfo as string | undefined) || enrichment?.parkingInfo || undefined;
  const goodFitTags = (mergedProfile.goodFitTags as string[] | undefined) || enrichment?.goodFitTags || undefined;
  const visitorFaq = (mergedProfile.visitorFaq as { question: string; answer: string }[] | undefined) || enrichment?.visitorFaq || undefined;

  // Enrichment: about section data
  const hasServiceTimes = serviceTimes.length > 0;
  const hasAddress = Boolean(streetAddress);
  const hasContact = Boolean(contactEmail || phone || hasValidEmail);
  const hasMinistries = !!(enrichment?.childrenMinistry || enrichment?.youthMinistry || communityMinistries.length > 0);
  const hasAboutData = hasServiceTimes || hasAddress || hasContact || hasMinistries || socialLinks.length > 0 || Boolean(whatToExpect);
  const hasSocialMedia = socialLinks.length > 0;
  const hasPlaylist = allPlaylists.length > 0;
  const hasPlayableSpotify = isPlayableSpotifyUrl(church.spotifyUrl);
  const spotifyArtistId = !hasPlaylist && church.spotifyUrl?.includes("/artist/")
    ? church.spotifyUrl.split("/artist/")[1]?.split(/[?#]/)[0] ?? null
    : null;

  // Compute missing fields for HelpImproveCard
  const missingFields: MissingField[] = [];
  if (!hasServiceTimes) missingFields.push({ key: "service_times", label: "Service times", placeholder: "e.g. Sundays 10:00 AM" });
  if (!hasValidEmail && !phone) missingFields.push({ key: "contact", label: "Contact email", placeholder: "e.g. info@church.org" });
  if (!hasAddress) missingFields.push({ key: "address", label: "Street address", placeholder: "e.g. 123 Main St, City" });
  if (!hasSocialMedia) missingFields.push({ key: "social_media", label: "Social media", placeholder: "e.g. instagram.com/church" });
  if (!hasPlaylist && videos.length === 0) missingFields.push({ key: "playlist", label: "Worship playlist", placeholder: "e.g. Spotify or YouTube link" });
  if (!hasMinistries) missingFields.push({ key: "ministries", label: "Ministries", placeholder: "e.g. Youth, Children, Small Groups" });
  if (!pastorName) missingFields.push({ key: "pastor", label: "Pastor / Leader", placeholder: "e.g. Pastor John Smith" });
  if (!whatToExpect) missingFields.push({ key: "what_to_expect", label: "What a first visit feels like", placeholder: "e.g. Casual dress, 75-minute service, coffee after" });

  const pageUrl = `https://gospelchannel.com/church/${church.slug}`;
  const relatedBrowseLinks = [
    church.country
      ? { href: `/church/country/${slugify(church.country)}`, label: `More churches in ${church.country}` }
      : null,
    city
      ? { href: `/church/city/${slugify(city)}`, label: `Churches in ${city}` }
      : null,
    primaryStyleFilter
      ? { href: `/church/style/${primaryStyleFilter.slug}`, label: `${primaryStyleFilter.seoLabel} churches` }
      : null,
    primaryDenominationFilter
      ? { href: `/church/denomination/${primaryDenominationFilter.slug}`, label: `${primaryDenominationFilter.label} churches` }
      : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  const videoSchemaItems = videos
    .filter((video) => Boolean(video.publishedAt && video.thumbnailUrl))
    .slice(0, 20);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `${church.name} Playlist`,
      description: `Stream ${church.name} worship playlist. Curated songs, videos, and gospel music.`,
      url: pageUrl,
      about: {
        "@type": "Organization",
        name: church.name,
        ...(websiteUrl && { url: websiteUrl }),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Church",
      name: displayName,
      ...(websiteUrl && { url: websiteUrl }),
      ...(streetAddress && {
        address: {
          "@type": "PostalAddress",
          streetAddress,
          ...(city && { addressLocality: city }),
          ...(((mergedProfile.country as string | undefined) || church.country) && {
            addressCountry: (mergedProfile.country as string | undefined) || church.country,
          }),
        },
      }),
      ...(!streetAddress && city && ((mergedProfile.country as string | undefined) || church.country) && {
        address: {
          "@type": "PostalAddress",
          addressLocality: city,
          addressCountry: (mergedProfile.country as string | undefined) || church.country,
        },
      }),
      ...(enrichment?.latitude && enrichment?.longitude && {
        geo: { "@type": "GeoCoordinates", latitude: enrichment.latitude, longitude: enrichment.longitude },
      }),
      ...(phone && { telephone: phone }),
      ...(contactEmail && { email: contactEmail }),
      ...(communityDenomination && { additionalType: getProfileOptionLabel(communityDenomination) }),
      ...(church.founded && { foundingDate: `${church.founded}` }),
      ...(communityLanguages.length > 0 && { knowsLanguage: communityLanguages.map(l => getProfileOptionLabel(l)) }),
      ...(serviceDurationMinutes && { eventSchedule: { "@type": "Schedule", duration: `PT${serviceDurationMinutes}M` } }),
      ...(parkingInfo && { amenityFeature: { "@type": "LocationFeatureSpecification", name: "Parking", value: parkingInfo } }),
      ...(goodFitTags && goodFitTags.length > 0 && { keywords: goodFitTags.join(", ") }),
    },
    ...(allPlaylists.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: `${church.name} Worship Playlist 2026`,
      description: aboutDescription,
      url: pageUrl,
      numTracks: videos.length,
      track: videos.slice(0, 20).map((v) => ({
        "@type": "MusicRecording", name: v.title, url: `https://www.youtube.com/watch?v=${v.videoId}`,
      })),
    }] : []),
    ...(videoSchemaItems.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${church.name} Worship Videos`,
      itemListElement: videoSchemaItems.map((video, index) => ({
        "@type": "VideoObject",
        position: index + 1,
        name: video.title,
        description: `${video.title} from ${video.channelTitle || displayName} on GospelChannel.`,
        thumbnailUrl: video.thumbnailUrl,
        uploadDate: video.publishedAt,
        embedUrl: `https://www.youtube.com/embed/${video.videoId}`,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
      })),
    }] : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Churches", item: "https://gospelchannel.com/church" },
        { "@type": "ListItem", position: 2, name: church.name, item: pageUrl },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: `Where can I find ${church.name} worship playlist?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `You can stream the official ${church.name} worship playlist on GospelChannel at gospelchannel.com/church/${church.slug}. The page includes curated Spotify playlists${videos.length > 0 ? `, ${videos.length} worship videos` : ""}, and links to all major streaming platforms.`,
          },
        },
        {
          "@type": "Question",
          name: `What kind of music does ${church.name} play?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${church.name} is known for ${styles.length > 0 ? styles.join(", ") : "worship music"}. ${topArtists.length > 0 ? `Notable artists include ${topArtists.join(", ")}.` : ""} ${church.description.slice(0, 150)}`,
          },
        },
        {
          "@type": "Question",
          name: `How can I listen to ${church.name} songs on Spotify?`,
          acceptedAnswer: {
            "@type": "Answer",
            text: `${church.name} has ${allPlaylists.length} curated Spotify ${allPlaylists.length === 1 ? "playlist" : "playlists"} available on GospelChannel. You can listen directly on the page or open the playlist in Spotify. Visit gospelchannel.com/church/${church.slug} to start streaming.`,
          },
        },
        ...(visitorFaq ?? []).map((faqItem) => ({
          "@type": "Question" as const,
          name: faqItem.question,
          acceptedAnswer: { "@type": "Answer" as const, text: faqItem.answer },
        })),
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ━━━ 1. COMPACT HERO ━━━ */}
      <section className="relative flex min-h-[35vh] flex-col overflow-hidden bg-gradient-to-br from-[#1d0f0b] via-[#3b2016] to-[#7b4a34] sm:min-h-[40vh]">
        {heroImage && (
          <>
            <HeroImage src={heroImage} className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
            {/* Layered cinematic overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a0e09] via-[#1a0e09]/60 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_50%,rgba(26,14,9,0.7)_0%,transparent_70%)]" />
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#1a0e09]/40 to-transparent" />
          </>
        )}

        {/* Nav inside hero */}
        <nav className="relative z-10 px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <Link href="/church" className="inline-flex items-center gap-1 text-sm font-medium text-white/60 transition-colors hover:text-white/90">
              ← Churches
            </Link>
            <ChurchViewerActions churchSlug={church.slug} />
          </div>
        </nav>

        {/* Content anchored to bottom */}
        <div className="relative z-10 mt-auto px-4 pb-8 pt-16 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-4">
              {churchLogo && (
                <HeroImage src={churchLogo} className="h-14 w-14 shrink-0 rounded-full border-2 border-white/30 object-cover shadow-lg sm:h-16 sm:w-16" />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                    {displayName}
                  </h1>
                  {isClaimed && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-semibold text-blue-100"
                      title="Verified church"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </span>
                  )}
                  {isCampus && network && (
                    <Link href={`/network/${network.slug}`} className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25">
                      Part of {network.name}
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/50">
                  {church.country}{styles[0] && ` · ${styles[0]}`}{allPlaylists.length > 0 && ` · ${allPlaylists.length} ${allPlaylists.length === 1 ? "playlist" : "playlists"}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-10">
      <div className="space-y-10 lg:min-w-0">

      {/* ━━━ MOBILE ACTION CARD ━━━ */}
      <div className="lg:hidden">
        <ChurchActionCard
          churchSlug={church.slug}
          displayName={displayName}
          streetAddress={streetAddress}
          city={city}
          country={(mergedProfile.country as string | undefined) || church.country || undefined}
          googleMapsUrl={isValidPublicUrl(enrichment?.googleMapsUrl) ? enrichment!.googleMapsUrl : undefined}
          phone={phone}
          contactEmail={contactEmail}
          hasContactForm={hasValidEmail && !emailVisiblePublicly}
          websiteUrl={websiteUrl}
          websiteHostLabel={websiteHostLabel}
          livestreamUrl={livestreamUrl}
          givingUrl={givingUrl}
          isClaimed={isClaimed}
        />
      </div>

      {/* ━━━ ABOUT & CTAs ━━━ */}
      <section className="rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
        <h2 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">About</h2>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-warm-brown sm:text-lg">
          {aboutDescription}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {hasPlayableSpotify && (
            <a
              href={church.spotifyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#1aa34a] hover:shadow-lg hover:shadow-[#1DB954]/20"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>
              Tune in on Spotify
            </a>
          )}
          <FollowChurchButton churchSlug={church.slug} churchName={displayName} variant="hero" />
        </div>

        {/* Social pills */}
        {socialLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {socialLinks.map((s) => {
              const stat = socialStats.find((st) => st.platform === s.platform);
              return (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-espresso/10 bg-linen-deep/30 px-3 py-1.5 text-xs font-medium text-warm-brown transition-colors hover:border-espresso/20 hover:bg-linen-deep/50"
                >
                  {s.icon === "youtube" && (
                    <svg className="h-3.5 w-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                  )}
                  {s.icon === "instagram" && (
                    <svg className="h-3.5 w-3.5 text-pink-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
                  )}
                  {s.icon === "facebook" && (
                    <svg className="h-3.5 w-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  )}
                  {s.platform}
                  {stat && (
                    <span className="text-warm-brown/50">{formatSocialCount(stat.count)}</span>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Campus note */}
      {isCampus && parentChurchName && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-warm-brown">
          Music from <span className="font-semibold text-espresso">{parentChurchName}</span> - shared across all {network?.name} campuses.
        </div>
      )}

      {/* ━━━ WORD FROM THE TEAM ━━━ */}
      {pastorName && (
        <ScrollReveal>
          <section className="rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="mb-4 font-serif text-xl font-semibold text-espresso sm:text-2xl">Word from the team</h2>
            <div className="flex items-start gap-4">
              {pastorPhotoUrl ? (
                <img
                  src={pastorPhotoUrl}
                  alt={`${pastorName}${pastorTitle ? `, ${pastorTitle}` : ''} at ${church.name}`}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <svg className="h-16 w-16 shrink-0 text-muted-warm/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
              <div>
                <p className="font-serif text-lg font-semibold text-espresso">{pastorName}</p>
                {pastorTitle && <p className="text-sm text-muted-warm">{pastorTitle}</p>}
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━ 2. WHAT SUNDAY FEELS LIKE ━━━ */}
      {hasAboutData && (
        <ScrollReveal>
          <section className="rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">Your visit at a glance</h2>

            <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {hasAddress && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" /></svg>
                    Location
                  </dt>
                  <dd className="mt-1 text-sm text-espresso">{streetAddress}</dd>
                </div>
              )}

              {hasServiceTimes && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Service Times
                  </dt>
                  <dd className="mt-1"><ServiceTimesDisplay times={serviceTimes} /></dd>
                </div>
              )}

              {hasContact && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                    Contact
                  </dt>
                  <dd className="mt-1 space-y-0.5 text-sm">
                    {contactEmail && (
                      <a href={`mailto:${contactEmail}`} className="block text-espresso hover:text-rose-gold">{contactEmail}</a>
                    )}
                    {phone && (
                      <a href={`tel:${phone}`} className="block text-espresso hover:text-rose-gold">{phone}</a>
                    )}
                    {!contactEmail && hasValidEmail && (
                      <ChurchContactButton churchSlug={church.slug} churchName={church.name} />
                    )}
                  </dd>
                </div>
              )}

              {whatToExpect && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                    What to expect
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-espresso">{whatToExpect}</dd>
                </div>
              )}

              {serviceDurationMinutes && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Service length
                  </dt>
                  <dd className="mt-1 text-sm text-espresso">{serviceDurationMinutes} min</dd>
                </div>
              )}

              {parkingInfo && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h17.25m0 0V6.169a1.125 1.125 0 00-.923-1.107l-9.138-1.598a1.125 1.125 0 00-.392 0l-9.138 1.598A1.125 1.125 0 001.125 6.17v8.08" /></svg>
                    Parking & accessibility
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-espresso">{parkingInfo}</dd>
                </div>
              )}

              {(enrichment?.theologicalOrientation || communityLanguages.length > 0 || communityDenomination) && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                    Community
                  </dt>
                  <dd className="mt-1 space-y-1 text-sm text-espresso">
                    {communityDenomination && (
                      <p><span className="text-muted-warm">Denomination:</span> {getProfileOptionLabel(communityDenomination)}</p>
                    )}
                    {enrichment?.theologicalOrientation && (
                      <p><span className="text-muted-warm">Tradition:</span> {enrichment.theologicalOrientation.charAt(0).toUpperCase() + enrichment.theologicalOrientation.slice(1)}</p>
                    )}
                    {communityLanguages.length > 0 && (
                      <p><span className="text-muted-warm">Languages:</span> {communityLanguages.map((language) => getProfileOptionLabel(language)).join(", ")}</p>
                    )}
                  </dd>
                </div>
              )}

              {hasMinistries && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                    Ministries
                  </dt>
                  <dd className="mt-1 text-sm text-espresso">
                    {Array.from(new Set([
                      enrichment!.childrenMinistry && "Children",
                      enrichment!.youthMinistry && "Youth",
                      ...communityMinistries.map((ministry) => getProfileOptionLabel(ministry)),
                    ].filter(Boolean))).join(", ")}
                  </dd>
                </div>
              )}

              {(styles.length > 0 || topArtists.length > 0) && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
                    Music
                  </dt>
                  <dd className="mt-1 space-y-1 text-sm text-espresso">
                    {styles.length > 0 && (
                      <p><span className="text-muted-warm">Style:</span> {styles.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}</p>
                    )}
                    {topArtists.length > 0 && (
                      <p><span className="text-muted-warm">Artists:</span> {topArtists.join(", ")}</p>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━ GOOD FIT FOR ━━━ */}
      {goodFitTags && goodFitTags.length > 0 && (
        <ScrollReveal>
          <section className="rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">Good fit for</h2>
            <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Good fit for">
              {goodFitTags.map((tag) => (
                <span key={tag} role="listitem" className="inline-flex items-center rounded-full bg-blush-light/60 px-3 py-1.5 text-sm font-medium text-warm-brown">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━ VISITOR FAQ ━━━ */}
      {visitorFaq && visitorFaq.length > 0 && (
        <ScrollReveal>
          <section className="rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
            <h2 className="font-serif text-xl font-semibold text-espresso sm:text-2xl">Common questions</h2>
            <div className="mt-4 divide-y divide-rose-200/30">
              {visitorFaq.slice(0, 10).map((item, i) => (
                <details key={i} className="group" {...(i === 0 ? { open: true } : {})}>
                  <summary className="flex cursor-pointer items-center justify-between px-1 py-3 text-sm font-medium text-espresso hover:text-rose-gold">
                    {item.question}
                    <svg className="h-4 w-4 shrink-0 text-muted-warm transition-transform duration-200 group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </summary>
                  <p className="px-1 pb-3 text-sm leading-relaxed text-espresso/80">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      <ScrollReveal>
        <ChurchLatestUpdatesSection items={latestUpdates} />
      </ScrollReveal>

      {/* Help improve this page */}
      <ScrollReveal delay={100}>
      <HelpImproveCard
        churchSlug={church.slug}
        churchName={displayName}
        missingFields={missingFields}
        claimMode={claimCtaMode}
      />
      </ScrollReveal>

      {/* ━━━ 3. MUSIC ━━━ */}
      {primaryPlaylist && (
        <ScrollReveal>
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Their worship</p>
            <h2 className="mt-2 font-serif text-2xl font-semibold italic text-espresso sm:text-3xl">The sound of {displayName}</h2>
            {styles.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {styles.map((style) => (
                  <span key={style} className="rounded-full border border-rose-200/60 bg-blush-light/50 px-3 py-1 text-xs font-medium text-warm-brown">
                    {style}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-warm-brown">
              Hear what Sunday sounds like before you go.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-br from-linen to-blush-light/40 shadow-sm">
            <SpotifyEmbedCard
              playlistId={primaryPlaylist.playlistId}
              title={primaryPlaylist.title}
              height={352}
              theme="dark"
            />
            {/* Cross-platform links under embed */}
            <div className="flex flex-wrap items-center gap-3 border-t border-rose-200/40 px-4 py-3">
              {crossPlatformLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-warm-brown transition-colors hover:text-espresso"
                >
                  {link.label} ↗
                </a>
              ))}
              <span className="ml-auto text-xs text-muted-warm">
                {allPlaylists.length} {allPlaylists.length === 1 ? "playlist" : "playlists"}
              </span>
            </div>
          </div>

          {/* Additional playlists shelf (only if more than 1) */}
          {allPlaylists.length > 1 && (
            <SpotifyPlaylistShelf
              eyebrow="More from their channel"
              title={`${church.name} channel collection`}
              subtitle="More from their worship."
              items={allPlaylists.slice(1)}
            />
          )}
        </section>
        </ScrollReveal>
      )}

      {/* Spotify artist embed (when no playlists but has artist page) */}
      {!hasPlaylist && spotifyArtistId && (
        <section className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-br from-linen to-blush-light/40 shadow-sm">
            <SpotifyEmbedCard
              artistId={spotifyArtistId}
              title={`${church.name} on Spotify`}
              height={352}
              theme="dark"
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-rose-200/40 px-4 py-3">
              {crossPlatformLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-warm-brown transition-colors hover:text-espresso"
                >
                  {link.label} ↗
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {relatedBrowseLinks.length > 0 && (
        <section className="rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-serif text-lg font-semibold text-espresso">Browse more churches</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedBrowseLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex rounded-full border border-rose-200/70 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light hover:text-espresso"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ━━━ CLAIM INTERSTITIAL ━━━ */}
      <Suspense fallback={null}>
        <ClaimInterstitial slug={church.slug} displayName={displayName} mode={claimCtaMode} />
      </Suspense>

      {/* ━━━ 3. WATCH ━━━ */}
      {videos.length > 0 && (
        <ScrollReveal>
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-rose-gold">Watch</p>
              <h2 className="font-serif text-xl font-bold text-espresso sm:text-2xl">
                See what it&apos;s like inside
              </h2>
              <p className="mt-1 text-sm text-warm-brown">
                Sermons, worship nights, and Sunday mornings.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <PlayAllButton videos={videos.map((v) => ({ videoId: v.videoId, title: v.title }))} />
              <span className="hidden text-xs text-muted-warm sm:inline">{videos.length} videos</span>
            </div>
          </div>
          <VideoGrid
            videos={videos.map((v) => ({
              videoId: v.videoId,
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              channelTitle: v.channelTitle,
            }))}
          />
        </section>
        </ScrollReveal>
      )}

      {/* ━━━ 5. PAGE FOOTER ━━━ */}
      <ScrollReveal>
      <footer className="space-y-6">
        {/* Network */}
        {!isCampus && (
          <Suspense fallback={null}>
            <ChurchNetworkSection churchSlug={church.slug} />
          </Suspense>
        )}

        {/* Nearby */}
        <Suspense fallback={null}>
          <NearbyChurchesSection
            churchSlug={church.slug}
            latitude={enrichment?.latitude}
            longitude={enrichment?.longitude}
          />
        </Suspense>

        {/* Claim this page */}
        <Suspense fallback={null}>
          <ClaimFooterLink slug={church.slug} displayName={displayName} mode={claimCtaMode} />
        </Suspense>

        {/* Prayer */}
        <div className="rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-serif text-base font-semibold text-espresso">Pray for {displayName}</h2>
          <div className="mt-3">
            <ChurchPrayerSection churchSlug={church.slug} churchName={displayName} />
          </div>
          <Link
            href={`/prayerwall/church/${church.slug}`}
            className="mt-3 inline-block text-xs text-muted-warm transition-colors hover:text-espresso"
          >
            See all prayers →
          </Link>
        </div>

      </footer>
      </ScrollReveal>

      </div>

      {/* ━━━ DESKTOP STICKY SIDEBAR ━━━ */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <ChurchActionCard
            churchSlug={church.slug}
            displayName={displayName}
            streetAddress={streetAddress}
            city={city}
            country={(mergedProfile.country as string | undefined) || church.country || undefined}
            googleMapsUrl={isValidPublicUrl(enrichment?.googleMapsUrl) ? enrichment!.googleMapsUrl : undefined}
            phone={phone}
            contactEmail={contactEmail}
            hasContactForm={hasValidEmail && !emailVisiblePublicly}
            websiteUrl={websiteUrl}
            websiteHostLabel={websiteHostLabel}
            livestreamUrl={livestreamUrl}
            givingUrl={givingUrl}
            isClaimed={isClaimed}
          />
        </div>
      </aside>

      </div>
    </div>
    </>
  );
}
