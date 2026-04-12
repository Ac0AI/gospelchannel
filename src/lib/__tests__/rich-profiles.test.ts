import { describe, it, expect } from 'vitest';
import { calculateProfileScore } from '../profile-score';
import { buildMergedProfile } from '../church-profile';

describe('profile score — new fields', () => {
  it('awards pastor photo points', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: { pastorPhotoUrl: 'https://media.gospelchannel.com/church-pastors/test/pastor.jpg' },
    });
    expect(result.fieldScores['pastor_photo_url']?.filled).toBe(true);
    expect(result.fieldScores['pastor_photo_url']?.points).toBe(5);
  });

  it('awards good fit tags points', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: { goodFitTags: ['Families', 'Young adults'] },
    });
    expect(result.fieldScores['good_fit_tags']?.filled).toBe(true);
    expect(result.fieldScores['good_fit_tags']?.points).toBe(5);
  });

  it('does not award good fit tags for empty array', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: { goodFitTags: [] },
    });
    expect(result.fieldScores['good_fit_tags']?.filled).toBe(false);
  });

  it('awards visitor FAQ points', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: { visitorFaq: [{ question: 'What should I wear?', answer: 'Casual dress is fine.' }] },
    });
    expect(result.fieldScores['visitor_faq']?.filled).toBe(true);
    expect(result.fieldScores['visitor_faq']?.points).toBe(5);
  });

  it('does not award visitor FAQ for empty array', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: { visitorFaq: [] },
    });
    expect(result.fieldScores['visitor_faq']?.filled).toBe(false);
  });

  it('full score with new fields exceeds 100', () => {
    const result = calculateProfileScore({
      isClaimed: true,
      mergedData: {
        serviceTimes: [{ day: 'Sunday', time: '10:00' }],
        streetAddress: 'Storgatan 1',
        city: 'Stockholm',
        country: 'Sweden',
        phone: '+46701234567',
        description: 'A great church with lots of activities and worship for the whole family and community.',
        instagramUrl: 'https://instagram.com/church',
        websiteUrl: 'https://church.se',
        denomination: 'Pingst',
        languages: ['Svenska'],
        logoUrl: 'https://storage.example.com/logo.png',
        ministries: ['Children'],
        churchSize: 'medium',
        pastorPhotoUrl: 'https://media.gospelchannel.com/pastor.jpg',
        goodFitTags: ['Families'],
        visitorFaq: [{ question: 'Q?', answer: 'A.' }],
      },
    });
    expect(result.score).toBe(115);
  });
});

describe('buildMergedProfile — new fields', () => {
  const baseEnrichment = {
    id: '1',
    enrichmentStatus: 'complete' as const,
    confidence: 1,
    schemaVersion: 1,
    createdAt: '',
    updatedAt: '',
  };

  it('merges pastor photo from enrichment', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, pastorPhotoUrl: 'https://media.gospelchannel.com/pastor.jpg' },
      [],
    );
    expect(merged.pastorPhotoUrl).toBe('https://media.gospelchannel.com/pastor.jpg');
  });

  it('merges service duration from enrichment', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, serviceDurationMinutes: 90 },
      [],
    );
    expect(merged.serviceDurationMinutes).toBe(90);
  });

  it('merges parking info from enrichment', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, parkingInfo: 'Free parking behind the building' },
      [],
    );
    expect(merged.parkingInfo).toBe('Free parking behind the building');
  });

  it('merges good fit tags from enrichment', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, goodFitTags: ['Families', 'Seekers'] },
      [],
    );
    expect(merged.goodFitTags).toEqual(['Families', 'Seekers']);
  });

  it('merges visitor FAQ from enrichment', () => {
    const faq = [{ question: 'What should I wear?', answer: 'Casual dress is fine.' }];
    const merged = buildMergedProfile(
      { ...baseEnrichment, visitorFaq: faq },
      [],
    );
    expect(merged.visitorFaq).toEqual(faq);
  });

  it('profile edit overrides enrichment for pastor photo', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, pastorPhotoUrl: 'https://old.jpg' },
      [{
        fieldName: 'pastor_photo_url',
        fieldValue: 'https://new.jpg',
        reviewStatus: 'approved',
        submittedAt: '2026-04-12T00:00:00.000Z',
      }],
    );
    expect(merged.pastorPhotoUrl).toBe('https://new.jpg');
  });

  it('profile edit overrides enrichment for good fit tags', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, goodFitTags: ['Families'] },
      [{
        fieldName: 'good_fit_tags',
        fieldValue: ['Young adults', 'Students'],
        reviewStatus: 'approved',
        submittedAt: '2026-04-12T00:00:00.000Z',
      }],
    );
    expect(merged.goodFitTags).toEqual(['Young adults', 'Students']);
  });

  it('profile edit overrides enrichment for visitor FAQ', () => {
    const newFaq = [{ question: 'Is there parking?', answer: 'Yes, free.' }];
    const merged = buildMergedProfile(
      { ...baseEnrichment, visitorFaq: [{ question: 'Old Q', answer: 'Old A' }] },
      [{
        fieldName: 'visitor_faq',
        fieldValue: newFaq,
        reviewStatus: 'approved',
        submittedAt: '2026-04-12T00:00:00.000Z',
      }],
    );
    expect(merged.visitorFaq).toEqual(newFaq);
  });

  it('does not merge empty good fit tags', () => {
    const merged = buildMergedProfile(
      { ...baseEnrichment, goodFitTags: [] },
      [],
    );
    expect(merged.goodFitTags).toBeUndefined();
  });
});
