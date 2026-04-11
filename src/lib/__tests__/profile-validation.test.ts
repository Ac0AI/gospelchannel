import { describe, it, expect } from 'vitest';
import { validateField } from '../profile-validation';

describe('validateField', () => {
  describe('phone', () => {
    it('accepts valid international phone', () => {
      expect(validateField('phone', '+46701234567')).toBeNull();
    });
    it('rejects phone without +', () => {
      expect(validateField('phone', '0701234567')).toBe('Phone number must start with +');
    });
    it('rejects too short phone', () => {
      expect(validateField('phone', '+12345')).toBe('Phone number must be 7-15 digits');
    });
  });

  describe('contact_email', () => {
    it('accepts valid email', () => {
      expect(validateField('contact_email', 'info@church.se')).toBeNull();
    });
    it('rejects invalid email', () => {
      expect(validateField('contact_email', 'notanemail')).toBe('Invalid email address');
    });
  });

  describe('description', () => {
    it('rejects too short', () => {
      expect(validateField('description', 'Short')).toBe('Description must be at least 80 characters');
    });
    it('rejects too long', () => {
      expect(validateField('description', 'x'.repeat(501))).toBe('Description must be 500 characters or less');
    });
    it('rejects all caps', () => {
      expect(validateField('description', 'A'.repeat(80))).toBe('Description cannot be all caps');
    });
    it('rejects spam (>3 URLs)', () => {
      const spam = 'Check out https://a.com and https://b.com also https://c.com plus https://d.com for more info and details';
      expect(validateField('description', spam)).toBe('Description contains too many links');
    });
    it('accepts valid description', () => {
      const desc = 'A wonderful church with lots of worship and community for the whole family. Welcome to join us every Sunday!';
      expect(validateField('description', desc)).toBeNull();
    });
  });

  describe('website_url', () => {
    it('accepts https URL', () => {
      expect(validateField('website_url', 'https://church.se')).toBeNull();
    });
    it('rejects http URL', () => {
      expect(validateField('website_url', 'http://church.se')).toBe('URL must start with https://');
    });
  });

  describe('service_times', () => {
    it('accepts valid entry', () => {
      expect(validateField('service_times', [{ day: 'Sunday', time: '10:00' }])).toBeNull();
    });
    it('rejects empty array', () => {
      expect(validateField('service_times', [])).toBe('Add at least one service time');
    });
    it('rejects >10 entries', () => {
      const times = Array.from({ length: 11 }, (_, i) => ({ day: 'Monday', time: `${i}:00` }));
      expect(validateField('service_times', times)).toBe('Maximum 10 service times');
    });
  });

  describe('address', () => {
    it('accepts valid address', () => {
      expect(validateField('address', { street: 'Storgatan 1', city: 'Stockholm', country: 'Sweden' })).toBeNull();
    });
    it('rejects missing street', () => {
      expect(validateField('address', { street: '', city: 'Stockholm', country: 'Sweden' })).toBe('Street address is required');
    });
    it('rejects missing city', () => {
      expect(validateField('address', { street: 'Storgatan 1', city: '', country: 'Sweden' })).toBe('City is required');
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
      expect(validateField('languages', [])).toBe('Select at least one language');
    });
    it('rejects >10', () => {
      expect(validateField('languages', Array.from({ length: 11 }, (_, i) => `Lang${i}`))).toBe('Maximum 10 languages');
    });
  });

  describe('ministries', () => {
    it('rejects >15', () => {
      expect(validateField('ministries', Array.from({ length: 16 }, (_, i) => `Min${i}`))).toBe('Maximum 15 ministries');
    });
  });
});
