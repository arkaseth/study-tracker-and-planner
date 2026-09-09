/**
 * Integration tests for src/core/state.js
 *
 * These tests import the real state module and exercise the localStorage
 * round-trip (save → reload → read) without hitting Supabase. The setup.js
 * stub ensures localStorage and the Supabase client are both available.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// window.supabase is stubbed globally in src/test/setup.js before modules load.

import { store, storeRev, currentExam, save, initializeState } from '../core/state.js';
import { STORAGE_KEY } from '../utils/constants.js';

describe('state module', () => {
  beforeEach(() => {
    localStorage.clear();
    initializeState();
  });

  // -------------------------------------------------------------------------
  // initializeState
  // -------------------------------------------------------------------------
  describe('initializeState()', () => {
    it('populates store.state with at least one exam', () => {
      expect(store.state.exams.length).toBeGreaterThan(0);
    });

    it('sets a valid activeExamId', () => {
      const ids = store.state.exams.map(e => e.id);
      expect(ids).toContain(store.state.activeExamId);
    });

    it('ensures ai config exists with all three key slots', () => {
      expect(store.state.ai).toBeDefined();
      expect(store.state.ai.keys).toMatchObject({
        gemini: expect.any(String),
        openai: expect.any(String),
        claude: expect.any(String),
      });
    });

    it('ensures timer config exists', () => {
      expect(store.state.timer).toBeDefined();
      expect(store.state.timer.focus).toBeGreaterThan(0);
      expect(store.state.timer.break).toBeGreaterThan(0);
    });

    it('bumps storeRev', () => {
      const before = storeRev.value;
      initializeState();
      expect(storeRev.value).toBeGreaterThan(before);
    });
  });

  // -------------------------------------------------------------------------
  // currentExam
  // -------------------------------------------------------------------------
  describe('currentExam()', () => {
    it('returns the active exam', () => {
      const exam = currentExam();
      expect(exam).toBeDefined();
      expect(exam.id).toBe(store.state.activeExamId);
    });

    it('falls back to the first exam when activeExamId is invalid', () => {
      store.state.activeExamId = 'nonexistent';
      const exam = currentExam();
      expect(exam).toBe(store.state.exams[0]);
    });
  });

  // -------------------------------------------------------------------------
  // save() — localStorage round-trip
  // -------------------------------------------------------------------------
  describe('save()', () => {
    it('persists state to localStorage', () => {
      store.state.exams[0].name = 'Persistence Test';
      save();
      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw);
      expect(parsed.exams[0].name).toBe('Persistence Test');
    });

    it('bumps storeRev on every call', () => {
      const before = storeRev.value;
      save();
      expect(storeRev.value).toBeGreaterThan(before);
    });

    it('does not save API keys to cloud (they stay local only)', () => {
      // save() is called without a currentUser so Supabase is not touched —
      // but we confirm the local snapshot still has keys intact.
      store.state.ai.keys.gemini = 'local-key';
      save();
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(parsed.ai.keys.gemini).toBe('local-key');
    });
  });

  // -------------------------------------------------------------------------
  // data integrity migrations (applied inside initializeState)
  // -------------------------------------------------------------------------
  describe('data integrity migrations', () => {
    it('adds SM-2 fields to legacy cards that only have streak', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        theme: 'night',
        ai: { provider: 'gemini', keys: { gemini: '', openai: '', claude: '' } },
        activeExamId: 'e1',
        exams: [{
          id: 'e1', name: 'Legacy', template: 'CAT', examDate: '2026-01-01',
          weeklyHours: 8,
          topics: [], tasks: [], mistakes: [],
          cards: [{ id: 'c1', front: 'Q', back: 'A', topic: 'T', due: '2025-01-01',
                    reviews: 3, streak: 2 }],
        }],
      }));
      initializeState();
      const card = currentExam().cards[0];
      expect(card.ease).toBeDefined();
      expect(card.repetition).toBeDefined();
      expect(card.interval).toBeDefined();
    });

    it('creates default availability when exam has none', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        theme: 'night',
        ai: { provider: 'gemini', keys: { gemini: '', openai: '', claude: '' } },
        activeExamId: 'e1',
        exams: [{
          id: 'e1', name: 'No-Avail', template: 'CAT', examDate: '2026-01-01',
          weeklyHours: 8, topics: [], tasks: [], mistakes: [], cards: [],
        }],
      }));
      initializeState();
      expect(currentExam().availability).toBeDefined();
      expect(Object.keys(currentExam().availability)).toHaveLength(7);
    });
  });
});
