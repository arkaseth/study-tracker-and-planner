import { uid } from "../utils/helpers.js";
import { addDays, iso, dayMs, daysBetween } from "../utils/dates.js";
import { templates, MOCK_CADENCE_PHASES } from "../utils/constants.js";

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

/**
 * Calculates the current mock exam cadence phase based on proximity to the exam date.
 */
export function getMockCadence(examDate, currentDate = new Date()) {
  const today = iso(currentDate);
  const daysToExam = daysBetween(today, examDate);

  if (daysToExam <= MOCK_CADENCE_PHASES.TAPER.maxDays) {
    return { key: "TAPER", daysToExam, ...MOCK_CADENCE_PHASES.TAPER };
  }
  if (daysToExam <= MOCK_CADENCE_PHASES.PEAK.maxDays) {
    return { key: "PEAK", daysToExam, ...MOCK_CADENCE_PHASES.PEAK };
  }
  if (daysToExam <= MOCK_CADENCE_PHASES.INTENSIVE.maxDays) {
    return { key: "INTENSIVE", daysToExam, ...MOCK_CADENCE_PHASES.INTENSIVE };
  }
  if (daysToExam <= MOCK_CADENCE_PHASES.TRANSITION.maxDays) {
    return { key: "TRANSITION", daysToExam, ...MOCK_CADENCE_PHASES.TRANSITION };
  }
  return { key: "FOUNDATION", daysToExam, ...MOCK_CADENCE_PHASES.FOUNDATION };
}

/**
 * Generates a rolling 14-day study plan with optional mock exam scheduling.
 */
export function generate14DaySchedule(exam, options = {}) {
  const {
    startDate = new Date(),
    includeMocks = true,
  } = options;

  const topics = [...(exam.topics || [])];
  if (!topics.length) return [];

  const daysToGenerate = 14;
  const newTasks = [];

  // Determine mock cadence
  const cadence = includeMocks && exam.examDate ? getMockCadence(exam.examDate, startDate) : null;
  const targetFullMocks = cadence ? cadence.fullMocks : 0;
  const targetSectionalMocks = cadence ? cadence.sectionalMocks : 0;

  // Build calendar days
  const dayPlans = [];
  for (let i = 0; i < daysToGenerate; i++) {
    const d = addDays(startDate, i);
    const dateStr = iso(d);
    const availableMinutes = minutesAvailableOn(exam, dateStr);
    dayPlans.push({
      dateStr,
      dayIndex: i,
      totalMinutes: availableMinutes,
      allocatedMinutes: 0,
      tasks: [],
      hasMock: false,
      isFullMock: false,
    });
  }

  // Helper to find weak topics (sorted ascending by confidence)
  const weakTopics = [...topics].sort((a, b) => a.confidence - b.confidence);

  // 1. Allocate Full Mocks if targets > 0
  if (targetFullMocks > 0) {
    const eligibleForFull = dayPlans
      .filter((dp) => dp.totalMinutes >= 90)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    let fullMocksScheduled = 0;
    for (const dp of eligibleForFull) {
      if (fullMocksScheduled >= targetFullMocks) break;
      const tooClose = dayPlans.some(
        (other) => other.isFullMock && Math.abs(other.dayIndex - dp.dayIndex) < 3
      );
      if (tooClose) continue;

      const duration = Math.min(dp.totalMinutes, 120);
      dp.tasks.push({
        id: uid(),
        date: dp.dateStr,
        topic: `${exam.name} Simulation`,
        type: "Full Mock",
        duration,
        done: false,
      });
      dp.allocatedMinutes += duration;
      dp.hasMock = true;
      dp.isFullMock = true;
      fullMocksScheduled++;
    }
  }

  // 2. Allocate Sectional Mocks if targets > 0
  if (targetSectionalMocks > 0) {
    let sectionalMocksScheduled = 0;
    const eligibleForSectional = dayPlans
      .filter((dp) => !dp.isFullMock && (dp.totalMinutes - dp.allocatedMinutes) >= 45)
      .sort((a, b) => (b.totalMinutes - b.allocatedMinutes) - (a.totalMinutes - a.allocatedMinutes));

    for (const dp of eligibleForSectional) {
      if (sectionalMocksScheduled >= targetSectionalMocks) break;
      const adjacentToFull = dayPlans.some(
        (other) => other.isFullMock && Math.abs(other.dayIndex - dp.dayIndex) === 1
      );
      if (adjacentToFull && eligibleForSectional.length > targetSectionalMocks) {
        continue;
      }

      const targetTopic = weakTopics[sectionalMocksScheduled % weakTopics.length];
      const duration = Math.min(dp.totalMinutes - dp.allocatedMinutes, 60);
      dp.tasks.push({
        id: uid(),
        date: dp.dateStr,
        topic: targetTopic.name,
        type: "Sectional Mock",
        duration,
        done: false,
      });
      dp.allocatedMinutes += duration;
      dp.hasMock = true;
      sectionalMocksScheduled++;
    }
  }

  // 3. Fill remaining available time with standard topic sessions
  const pool = [];
  topics.forEach((t) => {
    const weight = Math.max(1, 5 - t.confidence);
    for (let i = 0; i < weight; i++) pool.push(t);
  });

  const typeOrder = ["Learn", "Practice", "Active recall"];
  const topicTypeCursor = {};
  topics.forEach((t) => { topicTypeCursor[t.id] = 0; });

  let lastDayTopics = new Set();

  for (const dp of dayPlans) {
    const remainingMinutes = dp.totalMinutes - dp.allocatedMinutes;
    if (remainingMinutes < 30) {
      newTasks.push(...dp.tasks);
      continue;
    }

    const topicCount = remainingMinutes <= 120 ? 1 : remainingMinutes <= 240 ? 2 : remainingMinutes <= 360 ? 3 : 4;
    const baseDuration = Math.floor(remainingMinutes / topicCount / 5) * 5;
    const remainder = remainingMinutes - baseDuration * topicCount;

    const dayTopics = [];
    const available = pool.filter((t) => !lastDayTopics.has(t.id));
    const source = available.length >= topicCount ? available : pool;
    const used = new Set();

    for (let s = 0; s < topicCount; s++) {
      let candidates = source.filter((t) => !used.has(t.id));
      if (!candidates.length) candidates = pool.filter((t) => !used.has(t.id));
      if (!candidates.length) candidates = pool;

      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      used.add(pick.id);

      const duration = baseDuration + (s === topicCount - 1 ? remainder : 0);
      const type = typeOrder[topicTypeCursor[pick.id] % 3];
      topicTypeCursor[pick.id]++;

      dp.tasks.push({
        id: uid(),
        date: dp.dateStr,
        topic: pick.name,
        type,
        duration,
        done: false,
      });
      dayTopics.push(pick.id);
    }

    lastDayTopics = new Set(dayTopics);
    newTasks.push(...dp.tasks);
  }

  return newTasks;
}

