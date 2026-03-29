import { describe, it, expect } from 'vitest';
import { autoVerifyField } from '../auto-verify';
import type { ChurchEnrichment } from '@/types/gospel';

const baseEnrichment: Partial<ChurchEnrichment> = {
  phone: '+46701234567',
  contactEmail: 'info@church.se',
  streetAddress: 'Storgatan 1, Stockholm',
  websiteUrl: 'https://www.church.se',
  denominationNetwork: 'Pingströrelsen',
};

describe('autoVerifyField', () => {
  it('returns no_data when enrichment field is empty', () => {
    const result = autoVerifyField('phone', '+46709999999', {} as ChurchEnrichment);
    expect(result).toBe('no_data');
  });

  it('returns no_data when enrichment is null', () => {
    const result = autoVerifyField('phone', '+46709999999', null);
    expect(result).toBe('no_data');
  });

  it('returns matched for exact phone match', () => {
    const result = autoVerifyField('phone', '+46701234567', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('matched');
  });

  it('returns mismatch for different phone', () => {
    const result = autoVerifyField('phone', '+46709999999', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('mismatch');
  });

  it('returns matched for exact email match', () => {
    const result = autoVerifyField('contact_email', 'info@church.se', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('matched');
  });

  it('returns matched for email case-insensitive', () => {
    const result = autoVerifyField('contact_email', 'Info@Church.se', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('matched');
  });

  it('returns matched for address city match', () => {
    const addr = { street: 'Kungsgatan 5', city: 'Stockholm', country: 'Sweden' };
    const result = autoVerifyField('address', addr, baseEnrichment as ChurchEnrichment);
    expect(result).toBe('matched');
  });

  it('returns mismatch for address city mismatch', () => {
    const addr = { street: 'Kungsgatan 5', city: 'Göteborg', country: 'Sweden' };
    const result = autoVerifyField('address', addr, baseEnrichment as ChurchEnrichment);
    expect(result).toBe('mismatch');
  });

  it('returns matched for website domain match ignoring www', () => {
    const result = autoVerifyField('website_url', 'https://church.se/', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('matched');
  });

  it('returns mismatch for different website domain', () => {
    const result = autoVerifyField('website_url', 'https://otherchurch.se', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('mismatch');
  });

  it('returns matched for denomination fuzzy match', () => {
    const result = autoVerifyField('denomination', 'Pingst', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('matched');
  });

  it('returns mismatch for denomination no match', () => {
    const result = autoVerifyField('denomination', 'Katolska', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('mismatch');
  });

  it('returns no_data for logo (always admin review)', () => {
    const result = autoVerifyField('logo_url', 'https://storage.example.com/logo.png', baseEnrichment as ChurchEnrichment);
    expect(result).toBe('no_data');
  });

  it('returns no_data for fields without enrichment mapping', () => {
    const result = autoVerifyField('languages', ['Svenska'], baseEnrichment as ChurchEnrichment);
    expect(result).toBe('no_data');
  });
});
