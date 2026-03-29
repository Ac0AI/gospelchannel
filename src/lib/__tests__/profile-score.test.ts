import { describe, it, expect } from 'vitest';
import { calculateProfileScore } from '../profile-score';

describe('calculateProfileScore', () => {
  it('returns score 0 and badge none for empty data', () => {
    const result = calculateProfileScore({ isClaimed: false, mergedData: {} });
    expect(result.score).toBe(0);
    expect(result.badgeStatus).toBe('none');
    expect(result.missingForBadge).toEqual(['service_times', 'address', 'contact']);
  });

  it('returns claimed badge when claimed but missing badge fields', () => {
    const result = calculateProfileScore({
      isClaimed: true,
      mergedData: { description: 'A great church with lots of activities and worship for the whole family and community.' },
    });
    expect(result.score).toBe(20);
    expect(result.badgeStatus).toBe('claimed');
    expect(result.missingForBadge).toEqual(['service_times', 'address', 'contact']);
  });

  it('returns verified badge when all badge requirements met', () => {
    const result = calculateProfileScore({
      isClaimed: true,
      mergedData: {
        serviceTimes: [{ day: 'Söndag', time: '10:00' }],
        streetAddress: 'Storgatan 1',
        city: 'Stockholm',
        country: 'Sweden',
        phone: '+46701234567',
      },
    });
    expect(result.badgeStatus).toBe('verified');
    expect(result.score).toBe(40);
    expect(result.missingForBadge).toEqual([]);
  });

  it('contact satisfied by email alone', () => {
    const result = calculateProfileScore({
      isClaimed: true,
      mergedData: {
        serviceTimes: [{ day: 'Söndag', time: '10:00' }],
        streetAddress: 'Storgatan 1',
        city: 'Stockholm',
        country: 'Sweden',
        contactEmail: 'info@church.se',
      },
    });
    expect(result.badgeStatus).toBe('verified');
    expect(result.missingForBadge).toEqual([]);
  });

  it('awards social media points for one link', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: { instagramUrl: 'https://instagram.com/church' },
    });
    expect(result.score).toBe(8);
  });

  it('awards social media points only once for multiple links', () => {
    const result = calculateProfileScore({
      isClaimed: false,
      mergedData: {
        instagramUrl: 'https://instagram.com/church',
        facebookUrl: 'https://facebook.com/church',
      },
    });
    expect(result.score).toBe(8);
  });

  it('calculates full 100 score', () => {
    const result = calculateProfileScore({
      isClaimed: true,
      mergedData: {
        serviceTimes: [{ day: 'Söndag', time: '10:00' }],
        streetAddress: 'Storgatan 1',
        city: 'Stockholm',
        country: 'Sweden',
        phone: '+46701234567',
        contactEmail: 'info@church.se',
        description: 'A great church with lots of activities and worship for the whole family and community.',
        instagramUrl: 'https://instagram.com/church',
        websiteUrl: 'https://church.se',
        denomination: 'Pingst',
        languages: ['Svenska'],
        logoUrl: 'https://storage.example.com/logo.png',
        ministries: ['Barnverksamhet'],
        churchSize: 'medium',
      },
    });
    expect(result.score).toBe(100);
    expect(result.badgeStatus).toBe('verified');
  });

  it('does not award contact points twice for both phone and email', () => {
    const result = calculateProfileScore({
      isClaimed: true,
      mergedData: {
        phone: '+46701234567',
        contactEmail: 'info@church.se',
      },
    });
    expect(result.score).toBe(20);
  });
});
