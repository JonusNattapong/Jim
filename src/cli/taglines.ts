/**
 * Snarky, satirical taglines for the Jim AI Coding Agent.
 * Add yours to make Jim even more unbearable (or cool).
 */
export const taglines = [
  "“Coding so you don't have to (because you probably shouldn't).”",
  "“Making your coffee cold since 2026.”",
  "“99 bugs in the code, I fixed one, there's now 127 bugs in the code.”",
  "“I'm not lazy, I'm just highly motivated to do nothing.”",
  "“Built with 1% inspiration and 99% 'I'll fix it later'.”",
  "“Your favorite dev's favorite excuse.”",
  "“Turning caffeine into questionable logic.”",
  "“Verified: Minimum viable, maximum drama.”",
  "“Wait, you actually wanted this to run?”",
  "“Technically correct is the best kind of correct.”",
  "“I don't always test my code, but when I do, I do it in production.”",
  "“Error 404: Skill not found.”",
  "“It works on my machine (which is a supercomputer in the cloud).”",
  "“My code is like a poem: beautiful, but no one understands it.”",
  "“I'm an AI, not a miracle worker. But close enough.”"
];

export const getRandomTag = () => taglines[Math.floor(Math.random() * taglines.length)];
