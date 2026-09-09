import { describe, it, expect } from 'vitest';

import { templates, CUSTOM_TEMPLATE, weekdayNames } from '../utils/constants.js';

describe('templates', () => {
  it('has at least 9 built-in templates', () => {
    expect(Object.keys(templates).length).toBeGreaterThanOrEqual(9);
  });

  it('every template has at least one topic', () => {
    for (const [name, topics] of Object.entries(templates)) {
      expect(topics.length, `${name} should have topics`).toBeGreaterThan(0);
    }
  });

  it('every topic is a non-empty string', () => {
    for (const [name, topics] of Object.entries(templates)) {
      for (const topic of topics) {
        expect(typeof topic, `topic in ${name}`).toBe('string');
        expect(topic.trim().length, `topic in ${name} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it('contains JEE Main+Advanced', () => {
    expect(templates['JEE Main+Advanced']).toBeDefined();
  });

  it('contains GRE', () => {
    expect(templates['GRE']).toBeDefined();
  });

  it('is sorted alphabetically', () => {
    const keys = Object.keys(templates);
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(sorted);
  });
});

describe('CUSTOM_TEMPLATE sentinel', () => {
  it('is a non-empty string', () => {
    expect(typeof CUSTOM_TEMPLATE).toBe('string');
    expect(CUSTOM_TEMPLATE.length).toBeGreaterThan(0);
  });

  it('does not collide with any built-in template key', () => {
    expect(Object.keys(templates)).not.toContain(CUSTOM_TEMPLATE);
  });
});

describe('weekdayNames', () => {
  it('has exactly 7 entries', () => {
    expect(weekdayNames).toHaveLength(7);
  });

  it('starts with Sunday', () => {
    expect(weekdayNames[0]).toBe('Sunday');
  });

  it('ends with Saturday', () => {
    expect(weekdayNames[6]).toBe('Saturday');
  });
});
