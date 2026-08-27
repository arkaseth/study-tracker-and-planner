/**
 * Calculates the spaced repetition intervals (again, hard, good, easy) for a given flashcard
 * based on its current ease factor, repetition count, and previous interval.
 *
 * @param {Object} c - The flashcard object containing current SM-2 state.
 * @returns {Object} An object containing the calculated intervals in days.
 */
export function calcIntervals(c) {
  const ease = c.ease || 2.5,
    rep = c.repetition || 0,
    int = c.interval || 0;
  return {
    again: 0,
    hard: rep === 0 ? 1 : Math.max(1, Math.round(int * 1.2)),
    good: rep === 0 ? 1 : rep === 1 ? 6 : Math.round(int * ease),
    easy: rep === 0 ? 4 : rep === 1 ? 6 : Math.round(int * ease * 1.3),
  };
}
