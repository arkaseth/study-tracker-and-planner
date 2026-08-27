import { uid } from "../utils/helpers.js";
import { addDays, iso, dayMs } from "../utils/dates.js";
import { templates } from "../utils/constants.js";

/**
 * Creates default study availability for the week based on a given number of hours.
 */
export function createDefaultAvailability(hours = 8) {
  const availability = {
    0: { hours: 2, active: false },
    1: { hours: 2, active: false },
    2: { hours: 2, active: false },
    3: { hours: 2, active: false },
    4: { hours: 2, active: false },
    5: { hours: 2, active: false },
    6: { hours: 2, active: false },
  };
  let remaining = Number(hours) || 8;
  for (const day of [1, 2, 3, 4, 5, 6]) {
    const allotted = Math.min(2, remaining);
    availability[day] = { hours: allotted || 2, active: allotted > 0 };
    remaining -= allotted;
    if (remaining <= 0) break;
  }
  return availability;
}

/**
 * Calculates the total number of availability hours for a given exam across the entire week.
 */
export function availabilityHours(exam) {
  return Object.values(exam.availability || {}).reduce(
    (total, day) => total + (day?.active ? Number(day.hours) : 0),
    0,
  );
}

/**
 * Retrieves the available study time in minutes for a specific exam on a given date.
 */
export function minutesAvailableOn(exam, date) {
  const d = exam.availability?.[new Date(date + "T12:00").getDay()];
  return (d?.active ? Number(d.hours) : 0) * 60;
}

/**
 * Generates the initial, default application state structure.
 */
export function starterData() {
  const now = new Date();
  const tomorrow = iso(addDays(now, 1));
  return {
    theme: "night",
    ai: { provider: "gemini", keys: { gemini: "", openai: "", claude: "" } },
    activeExamId: "cat",
    tutorialCompleted: false,
    exams: [
      {
        id: "cat",
        name: "CAT 2026",
        template: "CAT",
        examDate: iso(addDays(now, 105)),
        weeklyHours: 12,
        topics: templates.CAT.map((name, i) => ({
          id: uid(),
          name,
          confidence: [2, 1, 2, 1, 1][i],
          completed: 0,
          concepts: [],
        })),
        tasks: [
          {
            id: uid(),
            date: iso(now),
            topic: "Arithmetic & Algebra",
            type: "Learn",
            duration: 45,
            done: false,
          },
          {
            id: uid(),
            date: iso(now),
            topic: "Reading comprehension",
            type: "Active recall",
            duration: 30,
            done: false,
          },
          {
            id: uid(),
            date: tomorrow,
            topic: "Data interpretation",
            type: "Practice",
            duration: 45,
            done: false,
          },
        ],
        cards: [
          {
            id: uid(),
            front: "What does a negative slope tell you?",
            back: "As x rises, y falls. The magnitude shows the decrease in y for each one-unit increase in x.",
            topic: "Arithmetic & Algebra",
            due: iso(now),
            reviews: 2,
            ease: 2.5,
            interval: 1,
            repetition: 1,
          },
          {
            id: uid(),
            front: "Before choosing an answer in RC, what must your evidence do?",
            back: "Point to a specific line or inference supported by the passage - not just a plausible-sounding interpretation.",
            topic: "Reading comprehension",
            due: iso(now),
            reviews: 0,
            ease: 2.5,
            interval: 0,
            repetition: 0,
          },
          {
            id: uid(),
            front: "What makes a set solvable using a Venn diagram?",
            back: "The categories overlap and the question concerns counts in individual groups, intersections, or neither.",
            topic: "Logical reasoning",
            due: tomorrow,
            reviews: 1,
            ease: 2.5,
            interval: 1,
            repetition: 1,
          },
        ],
        mistakes: [
          {
            id: uid(),
            topic: "Arithmetic & Algebra",
            question: "Ratio problem: mixed up part-to-whole with part-to-part.",
            correct: "Set the total as the common denominator before comparing parts.",
            why: "Rushed the setup and converted the given ratio incorrectly.",
            created: iso(addDays(now, -2)),
          },
        ],
      },
    ],
  };
}

export function getDueCards(exam) {
  const today = iso();
  return exam.cards
    .filter((card) => card.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.streak || 0) - (b.streak || 0));
}

export function sessionsCompleted(exam) {
  return exam.tasks.filter((t) => t.done).length;
}

export function taskHours(exam, date) {
  return (
    exam.tasks
      .filter((t) => t.date === date && t.done)
      .reduce((n, t) => n + t.duration, 0) / 60
  );
}

export function getOverdueTasks(exam) {
  const today = iso();
  return exam.tasks.filter((t) => t.date < today && !t.done);
}
