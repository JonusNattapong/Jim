/** 
 * A comprehensive list of professional and fun verbs for the thinking spinner. 
 * Inspired by Claude Code's dynamic personality.
 */
export const SPINNER_VERBS = [
  'Accomplishing', 'Actioning', 'Architecting', 'Baking', 'Beaming',
  'Bootstrapping', 'Brewing', 'Calculating', 'Cascading', 'Cerebrating',
  'Coalescing', 'Cogitating', 'Combobulating', 'Composing', 'Computing',
  'Concocting', 'Considering', 'Contemplating', 'Cooking', 'Crafting',
  'Creating', 'Crunching', 'Crystallizing', 'Cultivating', 'Deciphering',
  'Deliberating', 'Determining', 'Doing', 'Effecting', 'Elucidating',
  'Enchanting', 'Envisioning', 'Fermenting', 'Flowing', 'Forging',
  'Forming', 'Generating', 'Germinating', 'Gitifying', 'Grooving',
  'Harmonizing', 'Hashing', 'Hatching', 'Hyperspacing', 'Ideating',
  'Imagining', 'Improvising', 'Incubating', 'Inferring', 'Infusing',
  'Manifesting', 'Metamorphosing', 'Mulling', 'Mustering', 'Musing',
  'Nebulizing', 'Nesting', 'Noodling', 'Nucleating', 'Orbiting',
  'Orchestrating', 'Osmosing', 'Percolating', 'Perusing', 'Pondering',
  'Pontificating', 'Processing', 'Propagating', 'Quantumizing', 'Reticulating',
  'Ruminating', 'Scampering', 'Simmering', 'Spinning', 'Sprouting',
  'Synthesizing', 'Tempering', 'Thinking', 'Thundering', 'Tinkering',
  'Transfiguring', 'Transmuting', 'Undulating', 'Unfurling', 'Unravelling',
  'Vibing', 'Warping', 'Whirring', 'Whisking', 'Working', 'Wrangling',
  'Zesting', 'Zigzagging'
];

export const getRandomVerb = (): string => {
  return SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)];
};
