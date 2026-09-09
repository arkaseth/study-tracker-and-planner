import { describe, it, expect } from 'vitest';
import { iso, addDays, daysBetween, formatDate } from '../utils/dates.js';

describe('dates utilities', () => {
  describe('iso()', () => {
    it('returns a YYYY-MM-DD string', () => {
      const result = iso(new Date('2025-06-15T12:00:00Z'));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('defaults to today when called with no arguments', () => {
      const today = new Date();
      const expected = today.toISOString().slice(0, 10);
      // Allow ±1 day tolerance for timezone edge cases
      expect(Math.abs(new Date(iso()).getTime() - new Date(expected).getTime()))
        .toBeLessThanOrEqual(86400000);
    });
  });

  describe('addDays()', () => {
    it('adds positive days', () => {
      const base = new Date('2025-01-01T12:00:00');
      const result = addDays(base, 5);
      expect(result.getDate()).toBe(6);
    });

    it('adds negative days (goes back in time)', () => {
      const base = new Date('2025-01-10T12:00:00');
      const result = addDays(base, -3);
      expect(result.getDate()).toBe(7);
    });

    it('crosses month boundaries correctly', () => {
      const base = new Date('2025-01-29T12:00:00');
      const result = addDays(base, 5);
      expect(result.getMonth()).toBe(1); // February (0-indexed)
    });
  });

  describe('daysBetween()', () => {
    it('returns positive days between two dates', () => {
      expect(daysBetween('2025-01-01', '2025-01-10')).toBe(9);
    });

    it('returns 0 for the same date', () => {
      expect(daysBetween('2025-06-01', '2025-06-01')).toBe(0);
    });

    it('returns 0 when end is before start (clamps to 0)', () => {
      expect(daysBetween('2025-06-10', '2025-06-01')).toBe(0);
    });
  });

  describe('formatDate()', () => {
    it('returns a non-empty human-readable string', () => {
      const result = formatDate('2025-06-15');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
