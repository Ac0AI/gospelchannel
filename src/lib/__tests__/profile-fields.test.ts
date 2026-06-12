import { describe, it, expect } from 'vitest';
import { DENOMINATION_OPTIONS, getProfileOptionLabel } from '../profile-fields';
import { DENOMINATIONS } from '../denomination-taxonomy';

describe('DENOMINATION_OPTIONS', () => {
  it('does not include Swedish denomination values', () => {
    const swedish = ['Pingst', 'EFK', 'Equmenia', 'Svenska kyrkan', 'Annat'];
    for (const value of swedish) {
      expect(DENOMINATION_OPTIONS).not.toContain(value);
    }
  });

  it('every option except Other and Vineyard maps to a canonical denomination', () => {
    const canonicalSet = new Set(DENOMINATIONS.map((d) => d.canonical));
    const exceptions = new Set(['Other', 'Vineyard']);
    for (const option of DENOMINATION_OPTIONS) {
      if (exceptions.has(option)) continue;
      expect(canonicalSet.has(option)).toBe(true);
    }
  });

  it('getProfileOptionLabel maps legacy Swedish value Pingst to Pentecostal', () => {
    expect(getProfileOptionLabel('Pingst')).toBe('Pentecostal');
  });
});
