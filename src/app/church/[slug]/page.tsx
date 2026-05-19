import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
import { buildChurchAliases, checkChurchClaimed, getChurchPublicPageData, resolveChurchImageCandidates } from "@/lib/church";
import {
  getFirstServiceTimeLabel,
  getPublicHostLabel,
  isIndexableChurch,
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
import { isRenderableImageUrl } from "@/lib/media";
import { resolveCanonicalChurchSlug } from "@/lib/church-slugs";
import { CHURCH_SIZE_LABELS, getProfileOptionLabel } from "@/lib/profile-fields";
import { buildChurchDescription, buildChurchTitle } from "@/lib/church-metadata";

type ChurchPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 3600;
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

/** Splits a church name for the variant-3-bold cinematic title:
 *  first word goes upright, rest go italic-lowercase on a second line.
 *  Single-word names render as one upright line. */
function splitDisplayName(name: string): { first: string; rest: string } {
  const trimmed = name.trim();
  const space = trimmed.indexOf(" ");
  if (space === -1) return { first: trimmed, rest: "" };
  return { first: trimmed.slice(0, space), rest: trimmed.slice(space + 1) };
}

/** First sentence of the about description — for the hero italic tagline. */
function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : text).trim();
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

  // Gate genuinely empty stubs out of the index (no real text/media/music).
  // follow:true so internal link equity still flows to facet/hub pages.
  // Self-healing: enrichment lifts indexScore past the threshold and the page
  // flips back to indexable on the next revalidate.
  const indexable = isIndexableChurch(church.indexScore);

  return {
    title,
    description: seoDesc,
    keywords: Array.from(keywordSet).slice(0, 20),
    alternates: { canonical: pageUrl },
    robots: indexable ? undefined : { index: false, follow: true },
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
  const heroImageCandidates = resolveChurchImageCandidates({
    headerImage: church.headerImage,
    videos,
    coverImageUrl: (mergedProfile.coverImageUrl as string | undefined) || enrichment?.coverImageUrl,
  }).filter(isRenderableImageUrl);
  const heroImage = heroImageCandidates[0] || "";
  const heroIsVideoThumb = /(?:^|\.)(ytimg|youtube)\.com/i.test(heroImage);
  const churchLogo = isRenderableImageUrl((mergedProfile.logoUrl as string | undefined) || enrichment?.logoImageUrl || church.logo)
    ? ((mergedProfile.logoUrl as string | undefined) || enrichment?.logoImageUrl || church.logo)!
    : null;
  const websiteUrl = isValidOfficialWebsiteUrl((mergedProfile.websiteUrl as string | undefined) || enrichment?.websiteUrl || church.website)
    ? ((mergedProfile.websiteUrl as string | undefined) || enrichment?.websiteUrl || church.website)
    : undefined;
  const websiteHostLabel = getPublicHostLabel(websiteUrl);
  const displayName = pickDisplayChurchName(church.name, enrichment?.officialChurchName);
  const { first: nameFirst, rest: nameRest } = splitDisplayName(displayName);
  const serviceTimes = sanitizeServiceTimes(
    (mergedProfile.serviceTimes as import("@/types/gospel").ServiceTime[] | undefined) || enrichment?.serviceTimes
  );
  const serviceTimeLabel = getFirstServiceTimeLabel(serviceTimes);
  const streetAddress = normalizeDisplayText((mergedProfile.streetAddress as string | undefined) || enrichment?.streetAddress);
  const city = normalizeDisplayText(mergedProfile.city as string | undefined) || extractCity(church.location);
  const rawEmail = (mergedProfile.contactEmail as string | undefined) || enrichment?.contactEmail || church.email;
  const hasValidEmail = isValidPublicEmail(rawEmail);
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
    normalizeDisplayText(enrichment?.summary)
    || normalizeDisplayText(mergedProfile.description as string | undefined)
    || normalizeDisplayText(church.description)
    || church.description;
  const heroTagline = aboutDescription ? firstSentence(aboutDescription) : undefined;
  const primaryDenominationFilter = getPrimaryDenominationFilter({ denomination: communityDenomination });

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

  const socialLinks: { platform: string; url: string; icon: string }[] = [];
  if (youtubeUrl) socialLinks.push({ platform: "YouTube", url: youtubeUrl, icon: "youtube" });
  if (instagramUrl) socialLinks.push({ platform: "Instagram", url: instagramUrl, icon: "instagram" });
  if (facebookUrl) socialLinks.push({ platform: "Facebook", url: facebookUrl, icon: "facebook" });

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
    primaryStyleFilter
      ? { href: "/guides/worship-style-match", label: "Match my worship style" }
      : { href: "/guides/first-visit-guide", label: "First visit guide" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));
  const videoSchemaItems = videos
    .filter((video) => Boolean(video.publishedAt && video.thumbnailUrl))
    .slice(0, 20);

  // FAQ schema is built conditionally: only assert Spotify playlists when the
  // church actually has them (the old unconditional Q1 + a "has 0 playlists"
  // Q3 produced self-contradictory markup on every playlist-less page), and
  // only answer "what music" when there's a real style/artist signal rather
  // than padding with generic description text. Empty FAQPage is omitted
  // entirely — invalid/penalisable markup otherwise.
  const faqMainEntity = [
    ...(allPlaylists.length > 0
      ? [
          {
            "@type": "Question" as const,
            name: `Where can I find ${church.name} worship playlist?`,
            acceptedAnswer: {
              "@type": "Answer" as const,
              text: `You can stream the official ${church.name} worship playlist on GospelChannel at gospelchannel.com/church/${church.slug}. The page includes ${allPlaylists.length} curated Spotify ${allPlaylists.length === 1 ? "playlist" : "playlists"}${videos.length > 0 ? `, ${videos.length} worship videos` : ""}, and links to all major streaming platforms.`,
            },
          },
          {
            "@type": "Question" as const,
            name: `How can I listen to ${church.name} songs on Spotify?`,
            acceptedAnswer: {
              "@type": "Answer" as const,
              text: `${church.name} has ${allPlaylists.length} curated Spotify ${allPlaylists.length === 1 ? "playlist" : "playlists"} available on GospelChannel. You can listen directly on the page or open the playlist in Spotify. Visit gospelchannel.com/church/${church.slug} to start streaming.`,
            },
          },
        ]
      : []),
    ...(styles.length > 0 || topArtists.length > 0
      ? [
          {
            "@type": "Question" as const,
            name: `What kind of music does ${church.name} play?`,
            acceptedAnswer: {
              "@type": "Answer" as const,
              text: `${church.name} is known for ${styles.length > 0 ? styles.join(", ") : "worship music"}.${topArtists.length > 0 ? ` Notable artists include ${topArtists.join(", ")}.` : ""}`,
            },
          },
        ]
      : []),
    ...(visitorFaq ?? []).map((faqItem) => ({
      "@type": "Question" as const,
      name: faqItem.question,
      acceptedAnswer: { "@type": "Answer" as const, text: faqItem.answer },
    })),
  ];

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
    ...(faqMainEntity.length > 0
      ? [{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqMainEntity,
        }]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ━━━━━━━━━━ 1. CINEMATIC HERO ━━━━━━━━━━ */}
      <section className="relative min-h-[680px] overflow-hidden bg-[#120906] text-white sm:min-h-[820px] lg:min-h-[920px]">
        {heroImage && (
          <HeroImage
            src={heroImage}
            fallbackSrcs={heroImageCandidates.slice(1)}
            className={
              heroIsVideoThumb
                ? "absolute inset-0 h-full w-full scale-105 object-cover object-[center_35%] saturate-[0.85] contrast-[1.05] opacity-80"
                : "absolute inset-0 h-full w-full object-cover object-[center_35%] saturate-[0.85] contrast-[1.05]"
            }
          />
        )}

        {/* Arch SVG outline */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M 700 200 Q 530 200 530 400 L 530 760 L 870 760 L 870 400 Q 870 200 700 200 Z"
            fill="none"
            stroke="rgba(244,201,192,0.18)"
            strokeWidth="1"
          />
          <path
            d="M 700 240 Q 560 240 560 420 L 560 760 L 840 760 L 840 420 Q 840 240 700 240 Z"
            fill="none"
            stroke="rgba(244,201,192,0.10)"
            strokeWidth="1"
          />
        </svg>

        {/* Cinematic gradient stack */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(18,9,6,0.65) 0%, rgba(18,9,6,0.2) 30%, rgba(18,9,6,0.5) 70%, rgba(18,9,6,0.95) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 30%, rgba(176,106,80,0.25) 0%, transparent 50%)",
          }}
        />

        {/* Top nav */}
        <nav className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-5 py-7 sm:px-12 sm:py-8">
          <Link
            href="/church"
            className="text-[12px] font-bold uppercase tracking-[0.22em] text-blush/70 no-underline transition-colors hover:text-blush"
          >
            &larr; All churches
          </Link>
          <div className="hidden text-[11px] font-bold uppercase tracking-[0.32em] text-white/50 lg:block">
            GospelChannel &middot; A Pilgrim&rsquo;s Index
          </div>
          <ChurchViewerActions churchSlug={church.slug} />
        </nav>

        {/* Center title */}
        <div className="relative z-10 flex flex-col items-center px-5 pb-32 pt-20 text-center sm:px-12 sm:pb-40 sm:pt-28 lg:pt-32">
          {churchLogo && (
            <HeroImage
              src={churchLogo}
              fallbackSrcs={[
                (mergedProfile.logoUrl as string | undefined) || "",
                enrichment?.logoImageUrl || "",
                church.logo || "",
              ].filter(isRenderableImageUrl)}
              className="mb-7 h-14 w-14 rounded-full border border-blush/30 bg-white object-cover shadow-[0_4px_18px_rgba(0,0,0,0.3)] sm:h-16 sm:w-16"
            />
          )}
          <div className="mb-6 inline-flex items-center gap-4 sm:mb-8">
            <span className="h-px w-8 bg-blush" />
            <span className="text-[11px] font-bold uppercase tracking-[0.36em] text-blush">
              {communityDenomination ? getProfileOptionLabel(communityDenomination) : "Pilgrim's Index"}
              {church.country && ` · ${church.country}`}
            </span>
            <span className="h-px w-8 bg-blush" />
          </div>

          <h1 className="m-0 font-serif font-semibold tracking-[-0.04em] text-white drop-shadow-[0_2px_60px_rgba(0,0,0,0.5)]">
            <span
              className="block max-w-[14ch] leading-[0.85]"
              style={{ fontSize: "clamp(64px, 14vw, 200px)" }}
            >
              {nameFirst}
            </span>
            {nameRest && (
              <span
                className="mt-2 block max-w-[18ch] font-medium italic leading-[0.85] tracking-[-0.03em] text-blush sm:mt-3"
                style={{ fontSize: "clamp(40px, 10vw, 140px)" }}
              >
                {nameRest.toLowerCase()}
              </span>
            )}
          </h1>

          {(isClaimed || (isCampus && network)) && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {isClaimed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-blue-100">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
              {isCampus && network && (
                <Link
                  href={`/network/${network.slug}`}
                  className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                >
                  Part of {network.name}
                </Link>
              )}
            </div>
          )}

          {heroTagline && (
            <p className="mx-auto mt-12 max-w-3xl font-serif text-xl italic leading-[1.4] text-white/85 sm:mt-14 sm:text-2xl lg:text-[26px]">
              &ldquo;{heroTagline}&rdquo;
            </p>
          )}
        </div>

        {/* Bottom strip */}
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-blush/[0.18] bg-gradient-to-t from-[#120906] to-transparent">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-12 sm:py-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-blush/70">
              {(church.country?.toUpperCase()) || ""}
              {city && ` · ${city.toUpperCase()}`}
              {church.founded && ` · EST. ${church.founded}`}
            </div>
            {serviceTimeLabel && (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/[0.08] px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.24em] text-white backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                Service {serviceTimeLabel}
              </div>
            )}
            <div className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-blush/50 md:block">
              &darr; Scroll to enter
            </div>
          </div>
        </div>
      </section>

      {/* Campus note */}
      {isCampus && parentChurchName && (
        <div className="border-b border-rose-gold/10 bg-amber-50/50 px-5 py-3 text-center text-sm text-warm-brown sm:px-12">
          Music from <span className="font-semibold text-espresso">{parentChurchName}</span> &mdash; shared across all {network?.name} campuses.
        </div>
      )}

      {/* ━━━━━━━━━━ 2. WORD FROM THE TEAM (only if pastor present) ━━━━━━━━━━ */}
      {pastorName && (
        <ScrollReveal>
          <section
            className="px-5 py-32 text-white sm:px-12 sm:py-44"
            style={{ background: "linear-gradient(180deg, #120906 0%, #1d0f0b 100%)" }}
          >
            <div className="mx-auto max-w-[1100px] text-center">
              <div className="mb-12 text-[11px] font-bold uppercase tracking-[0.4em] text-blush">
                A word from the team
              </div>
              <p className="m-0 font-serif text-3xl font-medium italic leading-[1.15] tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
                &ldquo;{aboutDescription ? firstSentence(aboutDescription) : `We&rsquo;d love to meet you on Sunday at ${displayName}.`}&rdquo;
              </p>
              <div className="mt-16 inline-flex items-center gap-5">
                {pastorPhotoUrl ? (
                  <Image
                    unoptimized
                    src={pastorPhotoUrl}
                    alt={`${pastorName}${pastorTitle ? `, ${pastorTitle}` : ""} at ${church.name}`}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] shrink-0 rounded-full border-2 border-blush object-cover"
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-2 border-blush bg-white/5">
                    <svg className="h-9 w-9 text-blush/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                <div className="text-left">
                  <div className="font-serif text-2xl font-semibold text-white">{pastorName}</div>
                  {pastorTitle && (
                    <div className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-blush">
                      {pastorTitle}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━━━━━━━━ 3. WELCOME / ABOUT ━━━━━━━━━━ */}
      <ScrollReveal>
        <section className="px-5 pt-32 sm:px-12 sm:pt-40">
          <div className="mx-auto max-w-[1400px]">
            <div className="text-center">
              <div className="mb-6 text-[11px] font-bold uppercase tracking-[0.36em] text-rose-gold">
                About this place
              </div>
              <h2 className="mx-auto m-0 max-w-[1100px] font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.025em] text-espresso sm:text-6xl lg:text-[88px]">
                About{" "}
                <em className="gc-italic">{displayName}</em>
                {city ? <>, in <em className="gc-italic">{city}</em>.</> : "."}
              </h2>
            </div>

            {heroImage && (
              <div className="mx-auto mt-16 max-w-[1100px]">
                <div className="relative aspect-[16/9] overflow-hidden rounded-lg shadow-[0_32px_80px_-24px_rgba(59,42,34,0.4)]">
                  <HeroImage
                    src={heroImage}
                    fallbackSrcs={heroImageCandidates.slice(1)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </div>
            )}

            {aboutDescription && (
              <div className="mx-auto mt-16 max-w-[760px] text-center">
                <p className="m-0 font-serif text-xl italic leading-[1.6] text-warm-brown sm:text-[22px]">
                  {aboutDescription}
                </p>
              </div>
            )}

            {/* Spotify CTA + Follow + Social inline */}
            <div className="mx-auto mt-12 flex max-w-[760px] flex-wrap items-center justify-center gap-3">
              {hasPlayableSpotify && (
                <a
                  href={church.spotifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-[#1aa34a] hover:shadow-lg hover:shadow-[#1DB954]/20"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                  Tune in on Spotify
                </a>
              )}
              <FollowChurchButton churchSlug={church.slug} churchName={displayName} variant="default" />
              {socialLinks.length > 0 && socialLinks.map((s) => {
                const stat = socialStats.find((st) => st.platform === s.platform);
                return (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-rose-gold/15 bg-white px-3 py-1.5 text-xs font-medium text-warm-brown transition-colors hover:border-rose-gold/30 hover:bg-rose-gold/[0.04]"
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
                    {stat && <span className="text-warm-brown/50">{formatSocialCount(stat.count)}</span>}
                  </a>
                );
              })}
            </div>

          </div>
        </section>
      </ScrollReveal>

      {/* ━━━━━━━━━━ 4. YOUR FIRST SUNDAY ━━━━━━━━━━ */}
      {hasAboutData && (
        <ScrollReveal>
          <section className="px-5 pt-32 sm:px-12 sm:pt-40">
            <div className="mx-auto max-w-[1400px]">
              <div className="grid items-start gap-16 lg:grid-cols-2 lg:gap-20">
                <div>
                  <div className="mb-6 text-[11px] font-bold uppercase tracking-[0.36em] text-rose-gold">
                    Your first Sunday
                  </div>
                  <h2 className="m-0 font-serif text-4xl font-semibold leading-[0.95] tracking-[-0.025em] text-espresso sm:text-6xl lg:text-[80px]">
                    You&rsquo;ll know
                    <br />
                    <span className="italic text-rose-gold">what to expect</span>
                    <br />
                    before you arrive.
                  </h2>

                  <dl className="mt-12 flex flex-col gap-0">
                    {hasServiceTimes && (
                      <div className="grid grid-cols-[auto_1fr] items-baseline gap-8 border-t border-rose-gold/25 py-5">
                        <dt className="whitespace-nowrap font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Service times
                        </dt>
                        <dd className="max-w-[60ch] justify-self-end text-right text-sm leading-relaxed text-warm-brown">
                          <ServiceTimesDisplay times={serviceTimes} />
                        </dd>
                      </div>
                    )}
                    {serviceDurationMinutes && (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-rose-gold/25 py-5">
                        <dt className="font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Service length
                        </dt>
                        <dd className="font-serif text-2xl font-semibold italic text-rose-gold tabular-nums sm:text-[28px]">
                          {serviceDurationMinutes} min
                        </dd>
                      </div>
                    )}
                    {hasAddress && (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-rose-gold/25 py-5">
                        <dt className="font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Location
                        </dt>
                        <dd className="text-right text-sm leading-relaxed text-warm-brown">
                          {streetAddress}
                        </dd>
                      </div>
                    )}
                    {hasContact && (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-rose-gold/25 py-5">
                        <dt className="font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Contact
                        </dt>
                        <dd className="text-right text-sm">
                          {contactEmail && (
                            <a href={`mailto:${contactEmail}`} className="block text-espresso transition-colors hover:text-rose-gold">{contactEmail}</a>
                          )}
                          {phone && (
                            <a href={`tel:${phone}`} className="block text-espresso transition-colors hover:text-rose-gold">{phone}</a>
                          )}
                          {!contactEmail && hasValidEmail && (
                            <ChurchContactButton churchSlug={church.slug} churchName={church.name} />
                          )}
                        </dd>
                      </div>
                    )}
                    {parkingInfo && (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-rose-gold/25 py-5">
                        <dt className="font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Parking &amp; access
                        </dt>
                        <dd className="max-w-[40ch] text-right text-sm leading-relaxed text-warm-brown">
                          {parkingInfo}
                        </dd>
                      </div>
                    )}
                    {hasMinistries && (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-rose-gold/25 py-5">
                        <dt className="font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Ministries
                        </dt>
                        <dd className="max-w-[40ch] text-right text-sm leading-relaxed text-warm-brown">
                          {Array.from(new Set([
                            enrichment!.childrenMinistry && "Children",
                            enrichment!.youthMinistry && "Youth",
                            ...communityMinistries.map((ministry) => getProfileOptionLabel(ministry)),
                          ].filter(Boolean))).join(", ")}
                        </dd>
                      </div>
                    )}
                    {(communityDenomination || communityLanguages.length > 0 || enrichment?.theologicalOrientation) && (
                      <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-rose-gold/25 py-5">
                        <dt className="font-serif text-xl font-medium tracking-[-0.01em] text-espresso sm:text-2xl">
                          Community
                        </dt>
                        <dd className="space-y-1 text-right text-sm text-warm-brown">
                          {communityDenomination && <p>{getProfileOptionLabel(communityDenomination)}</p>}
                          {enrichment?.theologicalOrientation && (
                            <p>{enrichment.theologicalOrientation.charAt(0).toUpperCase() + enrichment.theologicalOrientation.slice(1)}</p>
                          )}
                          {communityLanguages.length > 0 && (
                            <p>{communityLanguages.map((language) => getProfileOptionLabel(language)).join(", ")}</p>
                          )}
                          {communitySize && (
                            <p className="text-muted-warm">{CHURCH_SIZE_LABELS[communitySize] ?? getProfileOptionLabel(communitySize)}</p>
                          )}
                        </dd>
                      </div>
                    )}
                    <div className="border-t border-rose-gold/25" />
                  </dl>
                </div>

                {whatToExpect && heroImage && (
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl shadow-[0_32px_80px_-24px_rgba(59,42,34,0.4)]">
                    <HeroImage
                      src={heroImage}
                      fallbackSrcs={heroImageCandidates.slice(1)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-x-0 bottom-0 p-8 text-white"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
                    >
                      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-blush">
                        What to expect
                      </div>
                      <p className="m-0 font-serif text-xl font-medium italic leading-[1.4] sm:text-[22px]">
                        {whatToExpect}
                      </p>
                    </div>
                  </div>
                )}
                {whatToExpect && !heroImage && (
                  <div className="rounded-xl border border-rose-gold/15 bg-white p-8">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-rose-gold">
                      What to expect
                    </div>
                    <p className="m-0 font-serif text-xl font-medium italic leading-[1.4] text-espresso sm:text-[22px]">
                      {whatToExpect}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━━━━━━━━ 5. THE SOUND ━━━━━━━━━━ */}
      {(primaryPlaylist || (!hasPlaylist && spotifyArtistId)) && (
        <ScrollReveal>
          <section
            className="relative mt-32 overflow-hidden px-5 py-32 text-white sm:px-12 sm:py-36"
            style={{ background: "radial-gradient(ellipse at 30% 20%, #4a2519 0%, #1d0f0b 70%)" }}
          >
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
              viewBox="0 0 1400 800"
              preserveAspectRatio="xMidYMid slice"
            >
              <g stroke="var(--blush)" strokeWidth="1" fill="none">
                <path d="M 200 800 L 200 300 Q 200 100 350 100 Q 500 100 500 300 L 500 800" />
                <path d="M 600 800 L 600 250 Q 600 50 750 50 Q 900 50 900 250 L 900 800" />
                <path d="M 1000 800 L 1000 300 Q 1000 100 1150 100 Q 1300 100 1300 300 L 1300 800" />
              </g>
            </svg>

            <div className="relative mx-auto max-w-[1400px]">
              <div className="mb-12 flex flex-wrap items-center gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                  Now playing
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-blush/50">
                  The {nameFirst} Sound
                </span>
              </div>

              <div className="grid items-start gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
                {/* Embed wrapped in dark frame */}
                <div className="relative">
                  <div className="overflow-hidden rounded-2xl border border-blush/10 bg-black/30 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-sm">
                    {primaryPlaylist ? (
                      <SpotifyEmbedCard
                        playlistId={primaryPlaylist.playlistId}
                        title={primaryPlaylist.title}
                        height={420}
                        theme="dark"
                      />
                    ) : spotifyArtistId ? (
                      <SpotifyEmbedCard
                        artistId={spotifyArtistId}
                        title={`${church.name} on Spotify`}
                        height={420}
                        theme="dark"
                      />
                    ) : null}
                    {crossPlatformLinks.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3 border-t border-blush/10 px-5 py-3">
                        {crossPlatformLinks.map((link) => (
                          <a
                            key={link.id}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blush/70 transition-colors hover:text-blush"
                          >
                            {link.label} &uarr;
                          </a>
                        ))}
                        <span className="ml-auto text-xs text-blush/50">
                          {allPlaylists.length} {allPlaylists.length === 1 ? "playlist" : "playlists"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: styles + artists */}
                <div>
                  <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.28em] text-blush">
                    The character of this sound
                  </div>
                  {styles.length > 0 && (
                    <div className="mb-8 flex flex-wrap gap-2">
                      {styles.map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-blush/20 bg-blush/[0.12] px-3.5 py-1.5 text-xs font-semibold text-blush"
                        >
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </span>
                      ))}
                    </div>
                  )}
                  {topArtists.length > 0 && (
                    <p className="m-0 text-sm leading-relaxed text-blush/70">
                      Featured artists:{" "}
                      <span className="font-semibold text-blush">{topArtists.slice(0, 6).join(" · ")}</span>
                    </p>
                  )}
                  <p className="mt-8 max-w-md font-serif text-lg italic leading-[1.5] text-blush/85 sm:text-xl">
                    Hear what Sunday sounds like before you go.
                  </p>
                </div>
              </div>

              {allPlaylists.length > 1 && (
                <div className="mt-16">
                  <SpotifyPlaylistShelf
                    eyebrow="More from their channel"
                    title={`${church.name} channel collection`}
                    subtitle="More from their worship."
                    items={allPlaylists.slice(1)}
                  />
                </div>
              )}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━━━━━━━━ 6. GOOD FIT FOR ━━━━━━━━━━ */}
      {goodFitTags && goodFitTags.length > 0 && (
        <ScrollReveal>
          <section className="px-5 pt-32 sm:px-12 sm:pt-40">
            <div className="mx-auto max-w-[1400px] text-center">
              <div className="mb-7 text-[11px] font-bold uppercase tracking-[0.36em] text-rose-gold">
                Could be your church if&hellip;
              </div>
              <h2 className="mx-auto m-0 max-w-[1200px] font-serif text-5xl font-semibold leading-[0.92] tracking-[-0.03em] text-espresso sm:text-7xl lg:text-[96px]">
                You&rsquo;re <span className="italic text-rose-gold">looking for</span>&hellip;
              </h2>

              <div className="mt-20 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {goodFitTags.slice(0, 6).map((tag, i) => {
                  const variants = [
                    { bg: "var(--linen-deep)", color: "var(--espresso)", accent: "var(--rose-gold)" },
                    { bg: "var(--rose-gold)", color: "white", accent: "var(--blush)" },
                    { bg: "var(--blush-light)", color: "var(--espresso)", accent: "var(--rose-gold)" },
                    { bg: "var(--espresso)", color: "white", accent: "var(--blush)" },
                    { bg: "var(--mauve-light)", color: "var(--espresso)", accent: "var(--mauve)" },
                    { bg: "white", color: "var(--espresso)", accent: "var(--rose-gold)" },
                  ];
                  const v = variants[i % variants.length];
                  return (
                    <div
                      key={tag}
                      className="flex aspect-[5/4] flex-col justify-between rounded-2xl px-8 py-12 text-left"
                      style={{
                        background: v.bg,
                        color: v.color,
                        border: v.bg === "white" ? "1px solid rgba(244,201,192,0.4)" : "none",
                      }}
                    >
                      <div
                        className="text-[11px] font-bold uppercase tracking-[0.28em]"
                        style={{ color: v.accent }}
                      >
                        No. 0{i + 1}
                      </div>
                      <div className="font-serif text-3xl font-semibold leading-[1] tracking-[-0.02em] sm:text-4xl lg:text-[44px]">
                        {tag}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━━━━━━━━ 7. FAQ ━━━━━━━━━━ */}
      {visitorFaq && visitorFaq.length > 0 && (
        <ScrollReveal>
          <section className="px-5 pt-32 sm:px-12 sm:pt-40">
            <div className="mx-auto max-w-[1100px]">
              <div className="mb-20 text-center">
                <div className="mb-7 text-[11px] font-bold uppercase tracking-[0.36em] text-rose-gold">
                  Things you&rsquo;re wondering
                </div>
                <h2 className="m-0 font-serif text-5xl font-semibold leading-[0.92] tracking-[-0.03em] text-espresso sm:text-7xl lg:text-[96px]">
                  We&rsquo;ve been
                  <br />
                  <span className="italic text-rose-gold">asked them all.</span>
                </h2>
              </div>

              <div>
                {visitorFaq.slice(0, 10).map((item, i) => (
                  <details
                    key={i}
                    {...(i === 0 ? { open: true } : {})}
                    className="group grid cursor-pointer grid-cols-[60px_1fr_60px] items-start gap-6 border-b border-rose-gold/25 py-8 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="contents list-none">
                      <div className="font-serif text-2xl font-semibold italic text-rose-gold sm:text-[28px]">
                        /0{i + 1}
                      </div>
                      <div className="font-serif text-2xl font-semibold leading-[1.25] tracking-[-0.015em] text-espresso sm:text-[32px]">
                        {item.question}
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full border border-rose-gold text-[22px] font-light text-rose-gold transition-colors group-open:bg-rose-gold group-open:text-white">
                        <span className="block group-open:hidden">+</span>
                        <span className="hidden group-open:block">−</span>
                      </div>
                    </summary>
                    <div className="col-span-3 col-start-2 -mt-4 sm:col-span-1 sm:col-start-2 sm:mt-0">
                      <p className="m-0 max-w-[70ch] text-base leading-[1.65] text-warm-brown sm:text-[17px]">
                        {item.answer}
                      </p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* ━━━━━━━━━━ 8. SUPPORTING SECTIONS (latest updates, help-improve, watch, related, prayer) ━━━━━━━━━━ */}
      <div className="mx-auto mt-32 w-full max-w-[1280px] space-y-12 px-5 sm:px-12">
        <ScrollReveal>
          <ChurchLatestUpdatesSection items={latestUpdates} />
        </ScrollReveal>

        <ScrollReveal delay={100}>
          <HelpImproveCard
            churchSlug={church.slug}
            churchName={displayName}
            missingFields={missingFields}
            claimMode={claimCtaMode}
          />
        </ScrollReveal>

        {videos.length > 0 && (
          <ScrollReveal>
            <section className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="gc-eyebrow" style={{ color: "var(--rose-gold)" }}>Watch</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
                    See what it&rsquo;s like inside
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

        {relatedBrowseLinks.length > 0 && (
          <section>
            <h2 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Browse more churches</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {relatedBrowseLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex rounded-full border border-rose-gold/20 bg-white px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-gold/40 hover:bg-rose-gold/[0.04] hover:text-espresso"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        )}

        <Suspense fallback={null}>
          <ClaimInterstitial slug={church.slug} displayName={displayName} mode={claimCtaMode} />
        </Suspense>

        {!isCampus && (
          <Suspense fallback={null}>
            <ChurchNetworkSection churchSlug={church.slug} />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <NearbyChurchesSection
            churchSlug={church.slug}
            latitude={enrichment?.latitude}
            longitude={enrichment?.longitude}
          />
        </Suspense>

        {/* Prayer card */}
        <section>
          <h2 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-espresso">Pray for {displayName}</h2>
          <div className="mt-4">
            <ChurchPrayerSection churchSlug={church.slug} churchName={displayName} />
          </div>
          <Link
            href={`/prayerwall/church/${church.slug}`}
            className="mt-4 inline-block text-xs font-semibold uppercase tracking-[0.18em] text-muted-warm transition-colors hover:text-rose-gold"
          >
            See all prayers &rarr;
          </Link>
        </section>

        <Suspense fallback={null}>
          <ClaimFooterLink slug={church.slug} displayName={displayName} mode={claimCtaMode} />
        </Suspense>
      </div>

      {/* ━━━━━━━━━━ 9. FINAL CTA: "We've saved you a seat" ━━━━━━━━━━ */}
      <ScrollReveal>
        <section className="relative mt-32 min-h-[640px] overflow-hidden bg-[#1d0f0b] text-white sm:min-h-[720px]">
          {heroImage && (
            <HeroImage
              src={heroImage}
              fallbackSrcs={heroImageCandidates.slice(1)}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
          )}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, rgba(29,15,11,0.85) 0%, rgba(176,106,80,0.6) 100%)" }}
          />
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.15]"
            viewBox="0 0 1400 720"
            preserveAspectRatio="xMidYMid slice"
          >
            <path
              d="M 700 200 Q 530 200 530 400 L 530 720 L 870 720 L 870 400 Q 870 200 700 200 Z"
              fill="none"
              stroke="var(--blush)"
              strokeWidth="1"
            />
          </svg>

          <div className="relative mx-auto max-w-[1100px] px-5 py-32 text-center sm:px-12 sm:py-36">
            <div className="mb-8 text-[11px] font-bold uppercase tracking-[0.4em] text-blush">
              See you Sunday?
            </div>
            <h2
              className="m-0 font-serif font-semibold leading-[0.92] tracking-[-0.03em]"
              style={{ fontSize: "clamp(48px, 9vw, 124px)" }}
            >
              We&rsquo;ve saved
              <br />
              <span className="italic text-blush">you a seat.</span>
            </h2>
            <p className="mt-8 font-serif text-xl italic leading-[1.4] text-white/80 sm:text-2xl">
              The coffee&rsquo;s already on. There&rsquo;ll be someone at the door looking for you.
            </p>

            <div className="mt-14 flex flex-wrap items-center justify-center gap-3.5">
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white px-10 py-5 text-sm font-bold tracking-[0.02em] text-espresso transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(255,255,255,0.2)]"
                >
                  Plan my first visit &rarr;
                </a>
              )}
              {livestreamUrl && (
                <a
                  href={livestreamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/50 bg-transparent px-10 py-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Watch this Sunday&rsquo;s service
                </a>
              )}
              {!websiteUrl && hasValidEmail && (
                <ChurchContactButton churchSlug={church.slug} churchName={church.name} />
              )}
            </div>

            {(streetAddress || phone || contactEmail) && (
              <div className="mx-auto mt-20 grid max-w-3xl grid-cols-1 gap-8 border-t border-blush/20 pt-8 text-sm sm:grid-cols-3">
                {streetAddress && (
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-blush/60">
                      Address
                    </div>
                    <div className="font-serif text-base text-white sm:text-[17px]">{streetAddress}</div>
                  </div>
                )}
                {phone && (
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-blush/60">
                      Phone
                    </div>
                    <a href={`tel:${phone}`} className="font-serif text-base text-white transition-colors hover:text-blush sm:text-[17px]">
                      {phone}
                    </a>
                  </div>
                )}
                {contactEmail && (
                  <div>
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em] text-blush/60">
                      Email
                    </div>
                    <a href={`mailto:${contactEmail}`} className="break-all font-serif text-base text-white transition-colors hover:text-blush sm:text-[17px]">
                      {contactEmail}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Mobile-first inline action card so visitors don't lose access to giving / livestream / map */}
            <div className="mx-auto mt-16 max-w-md text-left lg:hidden">
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
          </div>
        </section>
      </ScrollReveal>
    </>
  );
}
