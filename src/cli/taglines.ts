/**
 * List of curated taglines for the JimCode CLI.
 * These are displayed in the header to give it a premium, dynamic feel.
 */
export const taglines = [
  "High Performance Rockstar Coder",
  "Building the future, one line at a time",
  "Code that sings, solutions that soar",
  "Where deep logic meets clean syntax",
  "Your AI-powered coding companion",
  "Empowering your code with intelligent insights",
  "The ocean invented clean code. You're catching up.",
  "Unlocking the potential of every developer",
  "Mastering the art of algorithmic elegance",
  "Jim - Turning caffeine into high-performance code",
  "We've seen 10,000 repos. Yours has the 'best' spirit.",
  "Evolving at the speed of thought",
  "Synthesizing solutions across the stack",
  "Precision engineering for the modern dev",
  "Where code is poetry and logic is law",
  "Bringing sanity to legacy trenches",
  "The perfect duo: You and Jim",
  "Uncompromising quality in every commit"
];

/**
 * Returns a random tagline from the curated list.
 */
export const getRandomTagline = (): string => {
  return taglines[Math.floor(Math.random() * taglines.length)];
};
