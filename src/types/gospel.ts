export type ChurchSpotifyPlaylist = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  primary?: boolean;
};

export type ChurchCachedVideo = {
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  channelTitle?: string;
  channelId?: string;
  publishedAt?: string;
  viewCount?: number;
};

export type ChurchConfig = {
  slug: string;
  name: string;
  description: string;
  spotifyPlaylistIds: string[];
  spotifyPlaylists?: ChurchSpotifyPlaylist[];
  logo: string;
  website: string;
  spotifyUrl: string;
  country: string;
  denomination?: string;
  founded?: number;
  location?: string;
  musicStyle?: string[];
  notableArtists?: string[];
  youtubeChannelId?: string;
  youtubeVideos?: ChurchCachedVideo[];
  spotifyArtistIds?: string[];
  additionalPlaylists?: string[];
  email?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  headerImage?: string;
  headerImageAttribution?: string;
  lastResearched?: string;
  aliases?: string[];
  playlistCount?: number;
  qualityScore?: number;
  verifiedAt?: string;
  showEmailPublicly?: boolean;
  dataFlags?: string[];
  promotionTier?: "promotable" | "catalog_only";
  displayReady?: boolean;
  displayScore?: number;
  displayFlags?: string[];
  language?: string;
  sourceKind?: "manual" | "suggested" | "discovered" | "claimed";
};

export type ChurchFeedback = {
  id: string;
  churchSlug: string;
  kind: "data_issue" | "playlist_addition" | "profile_addition";
  playlistUrl?: string;
  field?: string;
  message: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "applied" | "rejected";
  source?: "public" | "claimed_owner";
  submittedByName?: string;
  submittedByEmail?: string;
};

export type SpotifyTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  albumArt?: string;
  manualYoutubeVideoId?: string;
};

export type YouTubeVideo = {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  viewCount: number;
  publishedAt?: string;
  channelId?: string;
  relevance?: "official" | "affiliated" | "uncertain" | "unrelated";
  relevanceScore?: number;
};

export type TrackMatch = {
  youtubeVideoId: string;
  confidence: number;
  matchedAt: string;
  manualOverride: boolean;
  lowConfidence?: boolean;
};

export type ChurchPageVideo = YouTubeVideo & {
  track: SpotifyTrack;
  confidence: number;
  lowConfidence: boolean;
};

export type ChurchSuggestion = {
  id: string;
  name: string;
  city: string;
  country: string;
  website: string;
  contactEmail: string;
  denomination: string;
  language: string;
  playlistUrl: string;
  message: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "approved" | "rejected";
};

export type ChurchClaim = {
  id: string;
  churchSlug: string;
  name: string;
  role?: string;
  email: string;
  message?: string;
  submittedAt: string;
  status: "pending" | "verified" | "rejected";
};

export type ChurchCandidate = {
  slug: string;
  name: string;
  spotifyOwnerId?: string;
  spotifyPlaylistIds: string[];
  website?: string;
  email?: string;
  location?: string;
  country?: string;
  confidence: number;
  reason?: string;
  discoveredAt: string;
  discoverySource?: "spotify-search" | "youtube-search" | "suggestion-upgrade" | "google-search" | "directory-import";
  sourceKind?: string;
  candidateId?: string;
  headerImage?: string;
  status: "pending" | "approved" | "rejected";
};

export type ChurchPlaylistReview = {
  churchSlug: string;
  playlistId: string;
  status: "kept" | "rejected";
  reviewedAt: string;
};

/** @deprecated Use ChurchPlaylistReview instead */
export type ChurchCandidatePlaylistReview = {
  candidateId: string;
  playlistId: string;
  status: "kept" | "rejected";
  reviewedAt: string;
};

export type ChurchMembership = {
  id: string;
  churchSlug: string;
  email: string;
  fullName?: string;
  role: "owner" | "editor";
  status: "active" | "revoked";
  claimId?: string;
  createdAt: string;
};

export type CatalogVideo = {
  videoId: string;
  title: string;
  artist?: string;
  thumbnailUrl: string;
  source: "staff" | "trending" | "church" | "category";
  href?: string;
};

export type ServiceTime = {
  day: string;
  time: string;
  label?: string;
};

export type ChurchUpdateSourceKind = "website_rss" | "youtube_channel" | "google_news_search";

export type ChurchUpdateSource = {
  id: string;
  churchSlug: string;
  sourceKind: ChurchUpdateSourceKind;
  sourceValue: string;
  sourceUrl?: string;
  sourceLabel?: string;
  isPrimary: boolean;
  active: boolean;
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChurchUpdateItem = {
  id: string;
  churchSlug: string;
  sourceId: string;
  externalId: string;
  title: string;
  url: string;
  summary?: string;
  publishedAt?: string;
  sourceKind: ChurchUpdateSourceKind;
  sourceLabel?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChurchEnrichment = {
  id: string;
  churchSlug?: string;
  candidateId?: string;
  officialChurchName?: string;

  // Level 1
  streetAddress?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  serviceTimes?: ServiceTime[];
  theologicalOrientation?: string;
  denominationNetwork?: string;
  languages?: string[];
  phone?: string;
  contactEmail?: string;
  websiteUrl?: string;

  // Social links
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;

  // Social stats
  facebookFollowers?: number;
  instagramFollowers?: number;
  youtubeSubscribers?: number;
  socialStatsFetchedAt?: string;

  // Level 2
  childrenMinistry?: boolean;
  youthMinistry?: boolean;
  ministries?: string[];
  churchSize?: "small" | "medium" | "large" | "mega";

  // Images
  coverImageUrl?: string;
  logoImageUrl?: string;

  // Profile fields
  pastorName?: string;
  pastorTitle?: string;
  livestreamUrl?: string;
  givingUrl?: string;
  whatToExpect?: string;

  // Level 3
  seoDescription?: string;
  summary?: string;

  // Metadata
  sources?: { type: string; fetchedAt: string }[];
  enrichmentStatus:
    | "pending"
    | "enriching"
    | "complete"
    | "failed"
    | "stale";
  confidence: number;
  schemaVersion: number;
  lastEnrichedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChurchNetwork = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  parentChurchSlug?: string;
  founded?: number;
  headquartersCountry?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChurchCampus = {
  id: string;
  slug: string;
  networkId: string;
  name: string;
  city?: string;
  country?: string;
  status: "pending" | "published" | "archived";
  discoveredBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ChurchCampusWithDetails = ChurchCampus & {
  network: ChurchNetwork;
  enrichment?: ChurchEnrichment;
};

export type Prayer = {
  id: string;
  churchSlug: string;
  content: string;
  originalContent?: string;
  authorName?: string;
  prayedCount: number;
  moderated: boolean;
  createdAt: string;
};

// --- Profile Strength ---

export type ProfileEditReviewStatus = 'pending' | 'auto_approved' | 'approved' | 'rejected';
export type EnrichmentMatch = 'matched' | 'no_data' | 'mismatch';
export type BadgeStatus = 'none' | 'claimed' | 'verified';

export type ChurchProfileEdit = {
  id: string;
  churchSlug: string;
  submittedBy: string;
  fieldName: string;
  fieldValue: unknown;
  reviewStatus: ProfileEditReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  enrichmentMatch?: EnrichmentMatch;
  submittedAt: string;
  updatedAt: string;
};

export type ProfileFieldDefinition = {
  name: string;
  label: string;
  hint?: string;
  category: 'badge' | 'bonus' | 'extra';
  points: number;
  type: 'text' | 'url' | 'email' | 'tel' | 'textarea' | 'select' | 'multi-select' | 'checkboxes' | 'service-times' | 'address' | 'image' | 'pastor';
  required?: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
};

export type ChurchProfileScore = {
  score: number;
  badgeStatus: BadgeStatus;
  fieldScores: Record<string, { filled: boolean; points: number; maxPoints: number }>;
  missingForBadge: string[];
};

export type ChurchOutreach = {
  id: string;
  churchSlug: string;
  email: string;
  sentAt: string;
  status: 'sent' | 'bounced' | 'claimed';
  claimId?: string;
};
