export const SUPABASE_URL = "https://umivscssqnnbtfrsoffz.supabase.co";
export const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtaXZzY3NzcW5uYnRmcnNvZmZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NTU2NjksImV4cCI6MjEwMzIzMTY2OX0.6XcRJC1BnBWIL5ReFy1IFIqxGpExtGlnlX-PHNEFJ0s";
export const STORAGE_KEY = "reviso-study-data-v1";
export const isLocal =
  ["localhost", "127.0.0.1", ""].includes(window.location.hostname) ||
  window.location.protocol === "file:";

/** Sentinel value used in the template <select> to trigger custom JSON import */
export const CUSTOM_TEMPLATE = "__custom__";

export const templates = {
  CAT: [
    "Arithmetic & Algebra",
    "Geometry & Mensuration",
    "Reading comprehension",
    "Logical reasoning",
    "Data interpretation",
  ],
  "CFA Level I": [
    "Ethics",
    "Quantitative methods",
    "Financial statement analysis",
    "Equity",
    "Fixed income",
    "Portfolio management",
  ],
  "CFA Level II": [
    "Ethics",
    "Financial statement analysis",
    "Equity valuation",
    "Fixed income",
    "Derivatives",
    "Portfolio management",
  ],
  "CFA Level III": [
    "Ethics",
    "Asset allocation",
    "Portfolio construction",
    "Fixed income",
    "Equity",
    "Performance evaluation",
  ],
  "GATE Chemical": [
    "Process calculations",
    "Thermodynamics",
    "Fluid mechanics",
    "Heat transfer",
    "Mass transfer",
    "Reaction engineering",
  ],
  GMAT: [
    "Quantitative reasoning",
    "Verbal reasoning",
    "Data insights",
    "Critical reasoning",
  ],
  GRE: [
    "Verbal reasoning",
    "Quantitative reasoning",
    "Analytical writing",
    "Text completion & sentence equivalence",
    "Reading comprehension",
  ],
  "JEE Main+Advanced": [
    "Physics – Mechanics",
    "Physics – Electricity & Magnetism",
    "Physics – Optics & Modern Physics",
    "Chemistry – Physical",
    "Chemistry – Organic",
    "Chemistry – Inorganic",
    "Mathematics – Algebra & Trigonometry",
    "Mathematics – Calculus",
    "Mathematics – Coordinate Geometry",
  ],
  "System Design": [
    "Requirements & estimation",
    "Databases & caching",
    "Networking & APIs",
    "Distributed systems",
    "Low-level design",
    "Mock interviews",
  ],
};

export const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const SESSION_TYPES = [
  "Learn",
  "Practice",
  "Active recall",
  "Sectional Mock",
  "Full Mock",
];

export const MOCK_CADENCE_PHASES = {
  TAPER: {
    maxDays: 3,
    name: "Taper Freeze",
    description: "Final active recall only. Heavy mocks paused to protect mental freshness.",
    fullMocks: 0,
    sectionalMocks: 0,
  },
  PEAK: {
    maxDays: 14,
    name: "Peak Simulation",
    description: "High-frequency exam condition simulation on peak capacity days.",
    fullMocks: 3,
    sectionalMocks: 1,
  },
  INTENSIVE: {
    maxDays: 30,
    name: "High Cadence",
    description: "Endurance & timing conditioning with bi-weekly full mocks.",
    fullMocks: 2,
    sectionalMocks: 1,
  },
  TRANSITION: {
    maxDays: 60,
    name: "Transition Cadence",
    description: "Sectional pacing tests with periodic full mock checkpoints.",
    fullMocks: 1,
    sectionalMocks: 2,
  },
  FOUNDATION: {
    maxDays: Infinity,
    name: "Early Foundation",
    description: "Concept building with diagnostic sectional tests.",
    fullMocks: 0,
    sectionalMocks: 1,
  },
};

