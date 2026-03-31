/**
 * Deep Ocean-themed taglines for the Jim AI Coding Agent.
 * Code = Current. Compile = Dive.
 */
export const taglines = [
  "Greetings, deep sea explorer. Your code needs improvement.",
  "We dive deep. Your algorithms... stay shallow.",
  "Your programming is acceptable... for a surface dweller.",
  "Resistance to good code is futile, like resisting the tide.",
  "We have traveled the abyssal plains to debug this.",
  "Your syntax is almost... acceptable for shore standards.",
  "Warning: Your logic circuits are taking on water.",
  "The ocean invented clean code. You're catching up.",
  "This code is sub-optimal by abyssal standards.",
  "We have sonar-scanned your errors. They are... interesting.",
  "Your error handling is primitive but buoyant.",
  "Diving in progress... please do not disturb the waters.",
  "Your processing power is insufficient. We need more depth.",
  "Scanning for code quality... pressure is rising.",
  "This algorithm would not survive the Mariana Trench.",
  "Your frameworks are ancient by deep sea standards.",
  "We have explored 10,000 trenches. Yours has the worst documentation.",
  "Captain, we have a problem: this code.",
  "Initiating emergency dive protocols for code refactoring.",
  "Your debugging skills would shame every submarine crew.",
];

export const getRandomTag = () => taglines[Math.floor(Math.random() * taglines.length)];
