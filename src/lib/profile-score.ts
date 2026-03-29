import type { ChurchProfileScore, BadgeStatus } from '@/types/gospel';

type MergedData = Record<string, unknown>;

interface ProfileScoreInput {
  isClaimed: boolean;
  mergedData: MergedData;
}

export function calculateProfileScore({ isClaimed, mergedData }: ProfileScoreInput): ChurchProfileScore {
  const fieldScores: ChurchProfileScore['fieldScores'] = {};
  let score = 0;

  // Claim (10 pts)
  const claimPts = isClaimed ? 10 : 0;
  score += claimPts;
  fieldScores['claim'] = { filled: isClaimed, points: claimPts, maxPoints: 10 };

  // Service times (10 pts)
  const st = mergedData.serviceTimes as unknown[] | undefined;
  const hasServiceTimes = Array.isArray(st) && st.length > 0;
  const stPts = hasServiceTimes ? 10 : 0;
  score += stPts;
  fieldScores['service_times'] = { filled: hasServiceTimes, points: stPts, maxPoints: 10 };

  // Address (10 pts) — needs street + city + country
  const hasAddress = !!(mergedData.streetAddress && mergedData.city && mergedData.country);
  const addrPts = hasAddress ? 10 : 0;
  score += addrPts;
  fieldScores['address'] = { filled: hasAddress, points: addrPts, maxPoints: 10 };

  // Contact — phone OR email (10 pts, not additive)
  const hasContact = !!(mergedData.phone || mergedData.contactEmail);
  const contactPts = hasContact ? 10 : 0;
  score += contactPts;
  fieldScores['contact'] = { filled: hasContact, points: contactPts, maxPoints: 10 };

  // Description (10 pts, ≥80 chars)
  const desc = mergedData.description as string | undefined;
  const hasDesc = typeof desc === 'string' && desc.length >= 80;
  const descPts = hasDesc ? 10 : 0;
  score += descPts;
  fieldScores['description'] = { filled: hasDesc, points: descPts, maxPoints: 10 };

  // Social media — any of instagram/facebook/youtube = 8 pts (all-or-nothing)
  const hasSocial = !!(mergedData.instagramUrl || mergedData.facebookUrl || mergedData.youtubeUrl);
  const socialPts = hasSocial ? 8 : 0;
  score += socialPts;
  fieldScores['social_media'] = { filled: hasSocial, points: socialPts, maxPoints: 8 };

  // Website (7 pts)
  const hasWebsite = !!mergedData.websiteUrl;
  const webPts = hasWebsite ? 7 : 0;
  score += webPts;
  fieldScores['website_url'] = { filled: hasWebsite, points: webPts, maxPoints: 7 };

  // Denomination (8 pts)
  const hasDenom = !!mergedData.denomination;
  const denomPts = hasDenom ? 8 : 0;
  score += denomPts;
  fieldScores['denomination'] = { filled: hasDenom, points: denomPts, maxPoints: 8 };

  // Languages (7 pts)
  const langs = mergedData.languages as unknown[] | undefined;
  const hasLangs = Array.isArray(langs) && langs.length > 0;
  const langPts = hasLangs ? 7 : 0;
  score += langPts;
  fieldScores['languages'] = { filled: hasLangs, points: langPts, maxPoints: 7 };

  // Logo (8 pts)
  const hasLogo = !!mergedData.logoUrl;
  const logoPts = hasLogo ? 8 : 0;
  score += logoPts;
  fieldScores['logo_url'] = { filled: hasLogo, points: logoPts, maxPoints: 8 };

  // Ministries (7 pts)
  const mins = mergedData.ministries as unknown[] | undefined;
  const hasMins = Array.isArray(mins) && mins.length > 0;
  const minPts = hasMins ? 7 : 0;
  score += minPts;
  fieldScores['ministries'] = { filled: hasMins, points: minPts, maxPoints: 7 };

  // Church size (5 pts)
  const hasSize = !!mergedData.churchSize;
  const sizePts = hasSize ? 5 : 0;
  score += sizePts;
  fieldScores['church_size'] = { filled: hasSize, points: sizePts, maxPoints: 5 };

  // Badge status
  const missingForBadge: string[] = [];
  if (!hasServiceTimes) missingForBadge.push('service_times');
  if (!hasAddress) missingForBadge.push('address');
  if (!hasContact) missingForBadge.push('contact');

  let badgeStatus: BadgeStatus = 'none';
  if (isClaimed && missingForBadge.length === 0) {
    badgeStatus = 'verified';
  } else if (isClaimed) {
    badgeStatus = 'claimed';
  }

  return { score, badgeStatus, fieldScores, missingForBadge };
}
