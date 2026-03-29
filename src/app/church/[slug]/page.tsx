import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChurchLatestUpdatesSection } from "@/components/ChurchLatestUpdatesSection";
import { ChurchNetworkSection } from "@/components/ChurchNetworkSection";
import { FollowChurchButton } from "@/components/FollowChurchButton";
import { NearbyChurchesSection } from "@/components/NearbyChurchesSection";
import { PlayAllButton } from "@/components/PlayAllButton";
import { ServiceTimesDisplay } from "@/components/ServiceTimesDisplay";
import { SpotifyEmbedCard } from "@/components/SpotifyEmbedCard";
import { SpotifyPlaylistShelf } from "@/components/SpotifyPlaylistShelf";
import { PrayerForm } from "@/components/PrayerForm";
import { HelpImproveCard, type MissingField } from "@/components/HelpImproveCard";
import { VerifiedChurchBadge } from "@/components/VerifiedChurchBadge";
import { VideoGrid } from "@/components/VideoGrid";
import {
  extractCity,
  getPrimaryDenominationFilter,
  getPrimaryStyleFilter,
} from "@/lib/church-directory";
import { buildChurchAliases, getChurchPublicPageData, resolveChurchPrimaryImage } from "@/lib/church";
import {
  getFirstServiceTimeLabel,
  getPublicHostLabel,
  isPlayableSpotifyUrl,
  isValidPublicEmail,
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

type ChurchPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 300;

/* ─── helpers ─── */

function formatSocialCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US");
}

/* ─── metadata (unchanged) ─── */

export async function generateMetadata({ params }: ChurchPageProps): Promise<Metadata> {
  const { slug } = await params;
  const pageData = await getChurchPublicPageData(slug);

  if (!pageData) {
    return { title: "Church Not Found" };
  }

  const { church, enrichment } = pageData;
  const displayName = enrichment?.officialChurchName || church.name;
  const hasPlaylists = (church.spotifyPlaylistIds?.length ?? 0) > 0
    || (church.additionalPlaylists?.length ?? 0) > 0;

  const seoDesc = enrichment?.seoDescription
    || (hasPlaylists
      ? `Stream ${church.name} worship playlist on Spotify. Curated worship songs, best gospel music, and live videos from ${church.name}. ${church.description.slice(0, 80)}`
      : `Discover ${church.name} — ${church.description.slice(0, 120)}`);

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
  const title = hasPlaylists
    ? `${displayName} — Worship Playlists & Church`
    : `${displayName} — Church & Community`;

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
  const pageData = await getChurchPublicPageData(slug);
  if (!pageData) notFound();

  const { church, videos, latestUpdates, enrichment, mergedProfile, badgeEligible } = pageData;
  const network = "network" in pageData ? pageData.network as import("@/types/gospel").ChurchNetwork | undefined : undefined;
  const isCampus = "isCampus" in pageData ? (pageData.isCampus as boolean) : false;
  const parentChurchName = "parentChurchName" in pageData ? (pageData.parentChurchName as string | undefined) : undefined;

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
  const primaryDenominationFilter = getPrimaryDenominationFilter(church);
  const heroImage = resolveChurchPrimaryImage({
    headerImage: church.headerImage,
    videos,
    coverImageUrl: enrichment?.coverImageUrl,
  }) || "";
  const churchLogo = isValidPublicUrl(enrichment?.logoImageUrl) ? enrichment!.logoImageUrl : null;
  const websiteUrl = isValidPublicUrl((mergedProfile.websiteUrl as string | undefined) || enrichment?.websiteUrl || church.website)
    ? ((mergedProfile.websiteUrl as string | undefined) || enrichment?.websiteUrl || church.website)
    : undefined;
  const websiteHostLabel = getPublicHostLabel(websiteUrl);
  const displayName = enrichment?.officialChurchName || church.name;
  const serviceTimes = sanitizeServiceTimes(enrichment?.serviceTimes);
  const serviceTimeLabel = getFirstServiceTimeLabel(serviceTimes);
  const streetAddress = normalizeDisplayText(enrichment?.streetAddress);
  const city = extractCity(church.location);
  const contactEmail = isValidPublicEmail(enrichment?.contactEmail || church.email) ? (enrichment?.contactEmail || church.email) : undefined;
  const phone = isValidPublicPhone(enrichment?.phone) ? enrichment?.phone : undefined;

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
  if (church.denomination) quickFacts.push(church.denomination);
  if (serviceTimeLabel) quickFacts.push(serviceTimeLabel);
  if (enrichment?.churchSize) {
    const sizeLabels: Record<string, string> = { small: "Small church", medium: "Mid-size church", large: "Large church", mega: "Mega church" };
    quickFacts.push(sizeLabels[enrichment.churchSize] ?? enrichment.churchSize);
  }
  if (enrichment?.languages?.length) quickFacts.push(enrichment.languages.join(", "));
  if (church.founded) quickFacts.push(`Since ${church.founded}`);

  // Enrichment: about section data
  const hasServiceTimes = serviceTimes.length > 0;
  const hasAddress = Boolean(streetAddress);
  const hasContact = Boolean(contactEmail || phone);
  const hasMinistries = !!(enrichment?.childrenMinistry || enrichment?.youthMinistry || (enrichment?.ministries?.length ?? 0) > 0);
  const hasAboutData = hasServiceTimes || hasAddress || hasContact || hasMinistries || socialLinks.length > 0;
  const hasSocialMedia = socialLinks.length > 0;
  const hasPlaylist = allPlaylists.length > 0;
  const hasPlayableSpotify = isPlayableSpotifyUrl(church.spotifyUrl);
  const spotifyArtistId = !hasPlaylist && church.spotifyUrl?.includes("/artist/")
    ? church.spotifyUrl.split("/artist/")[1]?.split(/[?#]/)[0] ?? null
    : null;

  // Compute missing fields for HelpImproveCard
  const missingFields: MissingField[] = [];
  if (!hasServiceTimes) missingFields.push({ key: "service_times", label: "Service times", placeholder: "e.g. Sundays 10:00 AM" });
  if (!hasContact) missingFields.push({ key: "contact", label: "Contact email", placeholder: "e.g. info@church.org" });
  if (!hasAddress) missingFields.push({ key: "address", label: "Street address", placeholder: "e.g. 123 Main St, City" });
  if (!hasSocialMedia) missingFields.push({ key: "social_media", label: "Social media", placeholder: "e.g. instagram.com/church" });
  if (!hasPlaylist && videos.length === 0) missingFields.push({ key: "playlist", label: "Worship playlist", placeholder: "e.g. Spotify or YouTube link" });
  if (!hasMinistries) missingFields.push({ key: "ministries", label: "Ministries", placeholder: "e.g. Youth, Children, Small Groups" });

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
      about: { "@type": "Organization", name: church.name, url: church.website },
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
          ...(church.location && { addressLocality: church.location }),
          ...(church.country && { addressCountry: church.country }),
        },
      }),
      ...(!streetAddress && church.location && church.country && {
        address: { "@type": "PostalAddress", addressLocality: church.location, addressCountry: church.country },
      }),
      ...(enrichment?.latitude && enrichment?.longitude && {
        geo: { "@type": "GeoCoordinates", latitude: enrichment.latitude, longitude: enrichment.longitude },
      }),
      ...(phone && { telephone: phone }),
      ...(contactEmail && { email: contactEmail }),
      ...(church.denomination && { additionalType: church.denomination }),
      ...(church.founded && { foundingDate: `${church.founded}` }),
    },
    ...(allPlaylists.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "MusicPlaylist",
      name: `${church.name} Worship Playlist 2026`,
      description: church.description,
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
      ],
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ━━━ 1. FULL-BLEED HERO ━━━ */}
      <section className="relative flex min-h-[55vh] flex-col overflow-hidden bg-gradient-to-br from-[#1d0f0b] via-[#3b2016] to-[#7b4a34] sm:min-h-[60vh]">
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
          <div className="mx-auto max-w-7xl">
            <Link href="/church" className="inline-flex items-center gap-1 text-sm font-medium text-white/60 transition-colors hover:text-white/90">
              ← Churches
            </Link>
          </div>
        </nav>

        {/* Content anchored to bottom */}
        <div className="relative z-10 mt-auto px-4 pb-10 pt-20 sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              {/* Left: name, description, CTAs */}
              <div className="max-w-3xl flex-1">
                <div className="flex items-center gap-4">
                  {churchLogo && (
                    <HeroImage src={churchLogo} className="h-14 w-14 shrink-0 rounded-full border-2 border-white/30 object-cover shadow-lg sm:h-16 sm:w-16" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
                        {displayName}
                      </h1>
                      <Suspense fallback={null}>
                        <VerifiedChurchBadge churchSlug={church.slug} badgeEligible={badgeEligible} />
                      </Suspense>
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

                <p className="mt-5 font-serif text-base leading-relaxed text-white/85 sm:text-lg lg:max-w-2xl">
                  {enrichment?.summary || church.description}
                </p>

                {/* CTAs */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
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
                  {websiteUrl && websiteHostLabel && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:text-white"
                    >
                      {websiteHostLabel} ↗
                    </a>
                  )}
                </div>

                {/* Social pills */}
                {socialLinks.length > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {socialLinks.map((s) => {
                      const stat = socialStats.find((st) => st.platform === s.platform);
                      return (
                        <a
                          key={s.platform}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
                        >
                          {s.icon === "youtube" && (
                            <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                          )}
                          {s.icon === "instagram" && (
                            <svg className="h-3.5 w-3.5 text-pink-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
                          )}
                          {s.icon === "facebook" && (
                            <svg className="h-3.5 w-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                          )}
                          {s.platform}
                          {stat && (
                            <span className="text-white/40">{formatSocialCount(stat.count)}</span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: Glass stats panel (desktop) */}
              {(quickFacts.length > 0 || socialStats.length > 0) && (
                <div className="hidden shrink-0 lg:block">
                  <div className="w-72 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
                    {quickFacts.length > 0 && (
                      <div className="space-y-3">
                        {quickFacts.map((fact, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-sm text-white/80">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-gold/80" />
                            {fact}
                          </div>
                        ))}
                      </div>
                    )}
                    {socialStats.length > 0 && quickFacts.length > 0 && (
                      <div className="my-4 border-t border-white/10" />
                    )}
                    {socialStats.length > 0 && (
                      <div className="flex flex-wrap gap-4">
                        {socialStats.map((s) => (
                          <div key={s.platform} className="text-center">
                            <div className="font-serif text-lg font-bold text-white">{formatSocialCount(s.count)}</div>
                            <div className="text-[10px] uppercase tracking-wider text-white/50">{s.platform}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">

      {/* Campus note */}
      {isCampus && parentChurchName && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-warm-brown">
          Music from <span className="font-semibold text-espresso">{parentChurchName}</span> - shared across all {network?.name} campuses.
        </div>
      )}

      {/* ━━━ 2. AT A GLANCE ━━━ */}
      {hasAboutData && (
        <ScrollReveal>
          <section className="rounded-2xl border border-rose-200/40 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">At a glance</p>
            <h2 className="mt-1 font-serif text-xl font-semibold text-espresso sm:text-2xl">Know before you go</h2>

            <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              {hasAddress && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" /></svg>
                    Location
                  </dt>
                  <dd className="mt-1 text-sm text-espresso">{streetAddress}</dd>
                  {isValidPublicUrl(enrichment?.googleMapsUrl) && (
                    <a href={enrichment!.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-block text-xs font-semibold text-rose-gold hover:text-rose-gold-deep">
                      Open in Google Maps →
                    </a>
                  )}
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
                  </dd>
                </div>
              )}

              {(enrichment?.theologicalOrientation || enrichment?.languages || church.denomination) && (
                <div>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-warm">
                    <svg className="h-3.5 w-3.5 text-rose-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                    Community
                  </dt>
                  <dd className="mt-1 space-y-1 text-sm text-espresso">
                    {enrichment?.theologicalOrientation && (
                      <p><span className="text-muted-warm">Tradition:</span> {enrichment.theologicalOrientation.charAt(0).toUpperCase() + enrichment.theologicalOrientation.slice(1)}</p>
                    )}
                    {enrichment?.denominationNetwork && (
                      <p><span className="text-muted-warm">Network:</span> {enrichment.denominationNetwork}</p>
                    )}
                    {enrichment?.languages && enrichment.languages.length > 0 && (
                      <p><span className="text-muted-warm">Languages:</span> {enrichment.languages.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(", ")}</p>
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
                    {[
                      enrichment!.childrenMinistry && "Children",
                      enrichment!.youthMinistry && "Youth",
                      ...(enrichment!.ministries ?? []).map(m => m.charAt(0).toUpperCase() + m.slice(1)),
                    ].filter(Boolean).join(", ")}
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

      <ScrollReveal>
        <ChurchLatestUpdatesSection items={latestUpdates} />
      </ScrollReveal>

      {/* Help improve this page */}
      <ScrollReveal delay={100}>
      <HelpImproveCard
        churchSlug={church.slug}
        churchName={displayName}
        missingFields={missingFields}
      />
      </ScrollReveal>

      {/* ━━━ 3. MUSIC ━━━ */}
      {primaryPlaylist && (
        <ScrollReveal>
        <section className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Their channel</p>
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
              Tune in through worship, service cues, and what this church sounds like before you decide whether it feels like the right fit.
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
              subtitle="Open more playlists if you want a wider feel for the room before your first visit."
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
          <h2 className="font-serif text-lg font-semibold text-espresso">Browse More Church Channels</h2>
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
      <ScrollReveal>
        <Link
          href={`/church/${church.slug}/claim`}
          className="group relative block overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-r from-linen-deep via-blush-light/40 to-white p-6 shadow-sm transition-all hover:border-rose-gold/30 hover:shadow-md sm:p-8"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-gold/10">
                  <svg className="h-4 w-4 text-rose-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Is this your church?</p>
              </div>
              <h2 className="mt-3 font-serif text-xl font-semibold text-espresso sm:text-2xl">
                Claim your page on GospelChannel
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-warm-brown">
                Add your logo, verify your information, and manage how your church appears to first-time visitors looking for a place to worship.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 font-semibold text-blue-600">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                  Verified badge
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-gold/10 px-2.5 py-1 font-semibold text-rose-gold">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  Edit details
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-gold/10 px-2.5 py-1 font-semibold text-rose-gold">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                  Your logo
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-gold px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all group-hover:bg-rose-gold-deep group-hover:shadow-md">
                Claim this page →
              </span>
            </div>
          </div>
        </Link>
      </ScrollReveal>

      {/* ━━━ 3. WATCH ━━━ */}
      {videos.length > 0 && (
        <ScrollReveal>
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-rose-gold">Live Worship</p>
              <h2 className="font-serif text-xl font-bold text-espresso sm:text-2xl">
                Experience {displayName} Live
              </h2>
              <p className="mt-1 text-sm text-warm-brown">
                Sunday services, worship nights, and special events.
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
        <Link
          href={`/church/${church.slug}/claim`}
          className="group flex items-center gap-4 rounded-2xl border border-rose-200/60 bg-gradient-to-r from-white to-blush-light/30 p-5 shadow-sm transition-all hover:border-rose-gold/40 hover:shadow-md sm:p-6"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-gold/10 text-rose-gold transition-colors group-hover:bg-rose-gold/20">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-espresso">Are you part of {displayName}?</p>
            <p className="mt-0.5 text-xs text-warm-brown">Claim this page to strengthen your church channel with clearer first-visit information, official details, and community signals.</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-rose-gold transition-colors group-hover:text-rose-gold-deep">
            Claim →
          </span>
        </Link>

        {/* Prayer */}
        <div className="rounded-2xl border border-rose-200/60 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-serif text-base font-semibold text-espresso">Pray for {displayName}</h2>
          <div className="mt-3">
            <PrayerForm churchSlug={church.slug} churchName={displayName} />
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
    </>
  );
}
