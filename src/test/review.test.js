import { describe, it, expect } from 'vitest';
import { calcIntervals } from '../core/review.js';

describe('calcIntervals() — SM-2 spaced repetition', () => {
  const newCard = { ease: 2.5, repetition: 0, interval: 0 };

  it('again always returns 0 days (re-show immediately)', () => {
    expect(calcIntervals(newCard).again).toBe(0);
    expect(calcIntervals({ ease: 2.5, repetition: 5, interval: 20 }).again).toBe(0);
  });

  describe('new card (rep=0)', () => {
    it('hard → 1 day', () => {
      expect(calcIntervals(newCard).hard).toBe(1);
    });

    it('good → 1 day', () => {
      expect(calcIntervals(newCard).good).toBe(1);
    });

    it('easy → 4 days', () => {
      expect(calcIntervals(newCard).easy).toBe(4);
    });
  });

  describe('second rep (rep=1)', () => {
    const rep1 = { ease: 2.5, repetition: 1, interval: 1 };

    it('hard → at least 1 day', () => {
      expect(calcIntervals(rep1).hard).toBeGreaterThanOrEqual(1);
    });

    it('good → 6 days', () => {
      expect(calcIntervals(rep1).good).toBe(6);
    });

    it('easy → 6 days', () => {
      expect(calcIntervals(rep1).easy).toBe(6);
    });
  });

  describe('mature card (rep=5, interval=20)', () => {
    const mature = { ease: 2.5, repetition: 5, interval: 20 };

    it('good → interval * ease (rounds)', () => {
      expect(calcIntervals(mature).good).toBe(Math.round(20 * 2.5));
    });

    it('easy → larger than good', () => {
      const intervals = calcIntervals(mature);
      expect(intervals.easy).toBeGreaterThan(intervals.good);
    });

    it('hard → smaller than good', () => {
      const intervals = calcIntervals(mature);
      expect(intervals.hard).toBeLessThan(intervals.good);
    });

    it('all intervals are non-negative integers', () => {
      const intervals = calcIntervals(mature);
      for (const key of ['again', 'hard', 'good', 'easy']) {
        expect(intervals[key]).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(intervals[key])).toBe(true);
      }
    });
  });

  it('uses default ease=2.5 when not provided', () => {
    const card = { repetition: 5, interval: 10 };
    expect(() => calcIntervals(card)).not.toThrow();
    expect(calcIntervals(card).good).toBe(Math.round(10 * 2.5));
  });
});
