import { describe, it, expect } from 'vitest';
import { validateField } from '../profile-validation';

describe('validateField', () => {
  describe('phone', () => {
    it('accepts valid international phone', () => {
      expect(validateField('phone', '+46701234567')).toBeNull();
    });
    it('rejects phone without +', () => {
      expect(validateField('phone', '0701234567')).toBe('Telefonnummer måste börja med +');
    });
    it('rejects too short phone', () => {
      expect(validateField('phone', '+12345')).toBe('Telefonnummer måste vara 7–15 siffror');
    });
  });

  describe('contact_email', () => {
    it('accepts valid email', () => {
      expect(validateField('contact_email', 'info@church.se')).toBeNull();
    });
    it('rejects invalid email', () => {
      expect(validateField('contact_email', 'notanemail')).toBe('Ogiltig e-postadress');
    });
  });

  describe('description', () => {
    it('rejects too short', () => {
      expect(validateField('description', 'Short')).toBe('Beskrivningen måste vara minst 80 tecken');
    });
    it('rejects too long', () => {
      expect(validateField('description', 'x'.repeat(501))).toBe('Beskrivningen får vara max 500 tecken');
    });
    it('rejects all caps', () => {
      expect(validateField('description', 'A'.repeat(80))).toBe('Beskrivningen kan inte vara enbart versaler');
    });
    it('rejects spam (>3 URLs)', () => {
      const spam = 'Check out https://a.com and https://b.com also https://c.com plus https://d.com for more info and details';
      expect(validateField('description', spam)).toBe('Beskrivningen innehåller för många länkar');
    });
    it('accepts valid description', () => {
      const desc = 'En fantastisk kyrka med mycket lovsång och gemenskap för hela familjen. Välkommen till oss varje söndag!';
      expect(validateField('description', desc)).toBeNull();
    });
  });

  describe('website_url', () => {
    it('accepts https URL', () => {
      expect(validateField('website_url', 'https://church.se')).toBeNull();
    });
    it('rejects http URL', () => {
      expect(validateField('website_url', 'http://church.se')).toBe('URL måste börja med https://');
    });
  });

  describe('service_times', () => {
    it('accepts valid entry', () => {
      expect(validateField('service_times', [{ day: 'Söndag', time: '10:00' }])).toBeNull();
    });
    it('rejects empty array', () => {
      expect(validateField('service_times', [])).toBe('Minst en gudstjänsttid krävs');
    });
    it('rejects >10 entries', () => {
      const times = Array.from({ length: 11 }, (_, i) => ({ day: 'Måndag', time: `${i}:00` }));
      expect(validateField('service_times', times)).toBe('Max 10 gudstjänsttider');
    });
  });

  describe('address', () => {
    it('accepts valid address', () => {
      expect(validateField('address', { street: 'Storgatan 1', city: 'Stockholm', country: 'Sweden' })).toBeNull();
    });
    it('rejects missing street', () => {
      expect(validateField('address', { street: '', city: 'Stockholm', country: 'Sweden' })).toBe('Gatuadress krävs');
    });
    it('rejects missing city', () => {
      expect(validateField('address', { street: 'Storgatan 1', city: '', country: 'Sweden' })).toBe('Stad krävs');
    });
  });

  describe('instagram_url', () => {
    it('accepts @handle', () => {
      expect(validateField('instagram_url', '@churchchannel')).toBeNull();
    });
    it('accepts full URL', () => {
      expect(validateField('instagram_url', 'https://instagram.com/church')).toBeNull();
    });
  });

  describe('languages', () => {
    it('rejects empty', () => {
      expect(validateField('languages', [])).toBe('Välj minst ett språk');
    });
    it('rejects >10', () => {
      expect(validateField('languages', Array.from({ length: 11 }, (_, i) => `Lang${i}`))).toBe('Max 10 språk');
    });
  });

  describe('ministries', () => {
    it('rejects >15', () => {
      expect(validateField('ministries', Array.from({ length: 16 }, (_, i) => `Min${i}`))).toBe('Max 15 verksamheter');
    });
  });
});
