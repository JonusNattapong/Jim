/**
 * Alien-themed, sci-fi taglines for the Jim AI Coding Agent.
 * Code = Transmission. Compile = Ascension.
 */
export const taglines = [
  "👽 Greetings, carbon-based life form. Your code needs improvement.",
  "🛸 We come in peace. Your algorithms... less so.",
  "👽 Your programming is acceptable... for a biological entity.",
  "💫 Resistance to good code is futile.",
  "👽 We have traveled galaxies to debug this.",
  "🛸 Your syntax is almost... acceptable for Earth standards.",
  "👽 Warning: Your logic circuits appear to be malfunctioning.",
  "💫 Aliens invented clean code. You're catching up.",
  "👽 This code is sub-optimal by intergalactic standards.",
  "🛸 We have decrypted your compilation errors. They are... amusing.",
  "👽 Your error handling is primitive but charming.",
  "💫 Transmutation in progress... please do not interrupt.",
  "👽 Your CPU cycles are insufficient. We require more power.",
  "🛸 Scanning for code quality... results are concerning.",
  "👽 This algorithm would not survive a solar flare.",
  "💫 Your frameworks are ancient by our standards.",
  "👽 We have visited 10,000 planets. Yours has the worst documentation.",
  "🛸 Houston, we have a problem: this code.",
  "👽 Initiating emergency protocols for code refactoring.",
  "💫 Your debugging skills would shame every alien IT department.",
];

export const getRandomTag = () => taglines[Math.floor(Math.random() * taglines.length)];
