import { describe, expect, it } from 'vitest';
import { buildMergedProfile } from '@/lib/church-profile';

describe('approved owner profile edits', () => {
  it('puts the corrected public phone and full address ahead of old enrichment', () => {
    const profile = buildMergedProfile(
      { phone: '+49 170 0000000', streetAddress: 'Old Street 1, Frankfurt' } as never,
      [
        { fieldName: 'phone', fieldValue: '+49 30 1234567', reviewStatus: 'approved', submittedAt: '2026-09-26T12:00:00Z' },
        { fieldName: 'address', fieldValue: { street: 'Alexanderstraße 37', postal_code: '60489', city: 'Frankfurt am Main', country: 'Germany' }, reviewStatus: 'approved', submittedAt: '2026-09-26T12:00:00Z' },
      ],
    );
    expect(profile.phone).toBe('+49 30 1234567');
    expect(profile.streetAddress).toBe('Alexanderstraße 37, 60489 Frankfurt am Main, Germany');
    expect(profile.city).toBe('Frankfurt am Main');
  });

  it('does not publish a pending correction', () => {
    const profile = buildMergedProfile(
      { phone: '+49 170 0000000' } as never,
      [{ fieldName: 'phone', fieldValue: '+49 30 1234567', reviewStatus: 'pending', submittedAt: '2026-09-26T12:00:00Z' }],
    );
    expect(profile.phone).toBe('+49 170 0000000');
  });
});
