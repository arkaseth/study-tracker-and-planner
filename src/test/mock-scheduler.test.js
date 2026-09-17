import { describe, it, expect } from "vitest";
import { getMockCadence, generate14DaySchedule, createDefaultAvailability } from "../core/planner.js";
import { iso, addDays } from "../utils/dates.js";

describe("Mock Exam Scheduler", () => {
  const baseDate = new Date("2026-10-01T10:00:00Z");

  describe("getMockCadence", () => {
    it("returns TAPER phase when <= 3 days to exam", () => {
      const examDate = iso(addDays(baseDate, 2));
      const cadence = getMockCadence(examDate, baseDate);
      expect(cadence.key).toBe("TAPER");
      expect(cadence.fullMocks).toBe(0);
      expect(cadence.sectionalMocks).toBe(0);
    });

    it("returns PEAK phase when 4 to 14 days to exam", () => {
      const examDate = iso(addDays(baseDate, 10));
      const cadence = getMockCadence(examDate, baseDate);
      expect(cadence.key).toBe("PEAK");
      expect(cadence.fullMocks).toBe(3);
      expect(cadence.sectionalMocks).toBe(1);
    });

    it("returns INTENSIVE phase when 15 to 30 days to exam", () => {
      const examDate = iso(addDays(baseDate, 25));
      const cadence = getMockCadence(examDate, baseDate);
      expect(cadence.key).toBe("INTENSIVE");
      expect(cadence.fullMocks).toBe(2);
      expect(cadence.sectionalMocks).toBe(1);
    });

    it("returns TRANSITION phase when 31 to 60 days to exam", () => {
      const examDate = iso(addDays(baseDate, 45));
      const cadence = getMockCadence(examDate, baseDate);
      expect(cadence.key).toBe("TRANSITION");
      expect(cadence.fullMocks).toBe(1);
      expect(cadence.sectionalMocks).toBe(2);
    });

    it("returns FOUNDATION phase when > 60 days to exam", () => {
      const examDate = iso(addDays(baseDate, 90));
      const cadence = getMockCadence(examDate, baseDate);
      expect(cadence.key).toBe("FOUNDATION");
      expect(cadence.fullMocks).toBe(0);
      expect(cadence.sectionalMocks).toBe(1);
    });
  });

  describe("generate14DaySchedule with mock scheduling", () => {
    const createTestExam = (daysOut) => {
      const examDate = iso(addDays(baseDate, daysOut));
      // Give Monday-Sunday 2 hours each (120 min each active day)
      const availability = {
        0: { hours: 3, active: true }, // Sunday: 180 min
        1: { hours: 2, active: true }, // Monday: 120 min
        2: { hours: 2, active: true }, // Tuesday: 120 min
        3: { hours: 2, active: true }, // Wednesday: 120 min
        4: { hours: 2, active: true }, // Thursday: 120 min
        5: { hours: 2, active: true }, // Friday: 120 min
        6: { hours: 3, active: true }, // Saturday: 180 min
      };

      return {
        id: "test-exam",
        name: "CAT 2026",
        examDate,
        weeklyHours: 16,
        availability,
        topics: [
          { id: "t1", name: "Algebra", confidence: 1, completed: 0 },
          { id: "t2", name: "Geometry", confidence: 2, completed: 0 },
          { id: "t3", name: "Reading", confidence: 3, completed: 0 },
          { id: "t4", name: "Logic", confidence: 4, completed: 0 },
        ],
        tasks: [],
      };
    };

    it("schedules 1 full mock and 2 sectional mocks when in TRANSITION phase (45 days out)", () => {
      const exam = createTestExam(45);
      const tasks = generate14DaySchedule(exam, { startDate: baseDate, includeMocks: true });

      const fullMocks = tasks.filter((t) => t.type === "Full Mock");
      const sectionalMocks = tasks.filter((t) => t.type === "Sectional Mock");

      expect(fullMocks.length).toBe(1);
      expect(sectionalMocks.length).toBe(2);
      expect(fullMocks[0].topic).toBe("CAT 2026 Simulation");

      // Sectional mocks should target low-confidence topics (Algebra confidence 1, Geometry confidence 2)
      const sectionalTopics = sectionalMocks.map((t) => t.topic);
      expect(sectionalTopics).toContain("Algebra");
    });

    it("schedules no mocks in TAPER freeze phase (2 days out)", () => {
      const exam = createTestExam(2);
      const tasks = generate14DaySchedule(exam, { startDate: baseDate, includeMocks: true });

      const fullMocks = tasks.filter((t) => t.type === "Full Mock");
      const sectionalMocks = tasks.filter((t) => t.type === "Sectional Mock");

      expect(fullMocks.length).toBe(0);
      expect(sectionalMocks.length).toBe(0);
      expect(tasks.length).toBeGreaterThan(0); // Regular tasks still generate
    });

    it("does not schedule mocks when includeMocks is false", () => {
      const exam = createTestExam(25);
      const tasks = generate14DaySchedule(exam, { startDate: baseDate, includeMocks: false });

      const mocks = tasks.filter((t) => t.type.includes("Mock"));
      expect(mocks.length).toBe(0);
    });

    it("separates multiple full mocks by at least 3 days in PEAK phase", () => {
      const exam = createTestExam(12);
      const tasks = generate14DaySchedule(exam, { startDate: baseDate, includeMocks: true });

      const fullMocks = tasks.filter((t) => t.type === "Full Mock");
      expect(fullMocks.length).toBeGreaterThanOrEqual(2);

      for (let i = 0; i < fullMocks.length - 1; i++) {
        const d1 = new Date(fullMocks[i].date);
        const d2 = new Date(fullMocks[i + 1].date);
        const diffDays = Math.abs((d2 - d1) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBeGreaterThanOrEqual(3);
      }
    });
  });
});
