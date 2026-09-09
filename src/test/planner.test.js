import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  createDefaultAvailability,
  availabilityHours,
  minutesAvailableOn,
  getDueCards,
  sessionsCompleted,
  taskHours,
  getOverdueTasks,
} from '../core/planner.js';
import { iso, addDays } from '../utils/dates.js';

// ---------------------------------------------------------------------------
// createDefaultAvailability
// ---------------------------------------------------------------------------
describe('createDefaultAvailability()', () => {
  it('returns an object with 7 day entries (0–6)', () => {
    const av = createDefaultAvailability(8);
    expect(Object.keys(av)).toHaveLength(7);
  });

  it('total active hours equals the requested hours', () => {
    const av = createDefaultAvailability(6);
    const total = Object.values(av).reduce((s, d) => s + (d.active ? d.hours : 0), 0);
    expect(total).toBe(6);
  });

  it('Sunday (day 0) is inactive by default', () => {
    const av = createDefaultAvailability(8);
    expect(av[0].active).toBe(false);
  });

  it('defaults to 8 hours when given 0 (falsy guard)', () => {
    // The function treats 0 as falsy and falls back to 8h — documented behaviour.
    const av = createDefaultAvailability(0);
    const active = Object.values(av).filter(d => d.active);
    expect(active.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// availabilityHours
// ---------------------------------------------------------------------------
describe('availabilityHours()', () => {
  it('sums only active days', () => {
    const exam = {
      availability: {
        0: { hours: 2, active: false },
        1: { hours: 3, active: true },
        2: { hours: 2, active: true },
        3: { hours: 2, active: false },
        4: { hours: 2, active: false },
        5: { hours: 2, active: false },
        6: { hours: 2, active: false },
      },
    };
    expect(availabilityHours(exam)).toBe(5);
  });

  it('returns 0 when availability is undefined', () => {
    expect(availabilityHours({})).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// minutesAvailableOn
// ---------------------------------------------------------------------------
describe('minutesAvailableOn()', () => {
  it('returns hours * 60 for an active day', () => {
    // Build an exam where Monday (day 1) is active with 2h
    const exam = { availability: { 1: { hours: 2, active: true } } };
    // Find next Monday
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    expect(minutesAvailableOn(exam, iso(d))).toBe(120);
  });

  it('returns 0 for an inactive day', () => {
    const exam = { availability: { 0: { hours: 3, active: false } } };
    // Find next Sunday
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
    expect(minutesAvailableOn(exam, iso(d))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getDueCards
// ---------------------------------------------------------------------------
describe('getDueCards()', () => {
  const today = iso();
  const yesterday = iso(addDays(new Date(), -1));
  const tomorrow = iso(addDays(new Date(), 1));

  const exam = {
    cards: [
      { id: '1', due: yesterday, repetition: 2 },
      { id: '2', due: today, repetition: 0 },
      { id: '3', due: tomorrow, repetition: 0 },
    ],
  };

  it('returns cards due today or earlier', () => {
    const due = getDueCards(exam);
    expect(due.map(c => c.id)).toContain('1');
    expect(due.map(c => c.id)).toContain('2');
  });

  it('excludes future cards', () => {
    const due = getDueCards(exam);
    expect(due.map(c => c.id)).not.toContain('3');
  });
});

// ---------------------------------------------------------------------------
// sessionsCompleted
// ---------------------------------------------------------------------------
describe('sessionsCompleted()', () => {
  it('counts only done tasks', () => {
    const exam = {
      tasks: [
        { done: true },
        { done: false },
        { done: true },
      ],
    };
    expect(sessionsCompleted(exam)).toBe(2);
  });

  it('returns 0 when no tasks', () => {
    expect(sessionsCompleted({ tasks: [] })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// taskHours
// ---------------------------------------------------------------------------
describe('taskHours()', () => {
  const today = iso();
  const exam = {
    tasks: [
      { date: today, done: true, duration: 60 },
      { date: today, done: false, duration: 45 },
      { date: iso(addDays(new Date(), -1)), done: true, duration: 30 },
    ],
  };

  it('sums only done tasks on the given date', () => {
    expect(taskHours(exam, today)).toBeCloseTo(1); // 60 min = 1 hour
  });

  it('excludes undone or different-date tasks', () => {
    expect(taskHours(exam, today)).not.toBeCloseTo(2.25);
  });
});

// ---------------------------------------------------------------------------
// getOverdueTasks
// ---------------------------------------------------------------------------
describe('getOverdueTasks()', () => {
  const yesterday = iso(addDays(new Date(), -1));
  const today = iso();

  const exam = {
    tasks: [
      { id: 'a', date: yesterday, done: false },
      { id: 'b', date: yesterday, done: true },
      { id: 'c', date: today, done: false },
    ],
  };

  it('returns past undone tasks only', () => {
    const overdue = getOverdueTasks(exam);
    expect(overdue.map(t => t.id)).toEqual(['a']);
  });

  it('excludes today\'s tasks (not yet overdue)', () => {
    const overdue = getOverdueTasks(exam);
    expect(overdue.find(t => t.id === 'c')).toBeUndefined();
  });
});
