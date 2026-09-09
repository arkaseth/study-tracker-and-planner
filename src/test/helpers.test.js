import { describe, it, expect, beforeEach } from 'vitest';
import { uid, escapeHTML, toast } from '../utils/helpers.js';

describe('uid()', () => {
  it('returns a non-empty string', () => {
    expect(typeof uid()).toBe('string');
    expect(uid().length).toBeGreaterThan(0);
  });

  it('generates unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, uid));
    expect(ids.size).toBe(100);
  });
});

describe('escapeHTML()', () => {
  it('escapes &', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('escapes <', () => {
    expect(escapeHTML('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes >', () => {
    expect(escapeHTML('1 > 0')).toBe('1 &gt; 0');
  });

  it('escapes double quotes', () => {
    expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHTML("it's")).toBe('it&#39;s');
  });

  it('returns plain text unchanged', () => {
    expect(escapeHTML('hello world')).toBe('hello world');
  });

  it('coerces non-strings via String()', () => {
    expect(escapeHTML(42)).toBe('42');
  });
});

describe('toast()', () => {
  beforeEach(() => {
    // Set up a minimal #toast element in the document
    document.body.innerHTML = '<div id="toast"></div>';
  });

  it('sets textContent on #toast', () => {
    toast('Hello!');
    expect(document.getElementById('toast').textContent).toBe('Hello!');
  });

  it('adds the "show" class', () => {
    toast('Test message');
    expect(document.getElementById('toast')).toHaveClass('show');
  });

  it('does not throw when #toast element is absent', () => {
    document.body.innerHTML = '';
    expect(() => toast('Safe?')).not.toThrow();
  });
});
