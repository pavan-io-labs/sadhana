/**
 * Puzzles data for the Insight & Reframe module (Mind Gym game #6).
 *
 * Two types:
 * 1. Insight puzzles  --  problems where the solution requires a shift in perspective.
 *    Metric: time to solve + whether solved at all.
 * 2. Reframe prompts  --  cognitive reappraisal exercises where the user journals
 *    an alternative interpretation of a negative event.
 *    Metric: qualitative (journalled text).
 */

export type InsightPuzzle = {
  id: string;
  text: string;
  hint: string;
  answer: string;
  /** Difficulty 1-5. */
  difficulty: number;
};

export type ReframePrompt = {
  id: string;
  scenario: string;
  negativeThought: string;
  guidingQuestions: string[];
};

export const INSIGHT_PUZZLES: InsightPuzzle[] = [
  {
    id: "ip-01",
    text: "A man pushes his car to a hotel and tells the owner he's bankrupt. What happened?",
    hint: "Think smaller.",
    answer: "He's playing Monopoly.",
    difficulty: 2,
  },
  {
    id: "ip-02",
    text: "How can you throw a ball, have it stop, and come back to you  --  without it bouncing off anything, with no string attached, and nobody else throwing it back?",
    hint: "Direction matters.",
    answer: "Throw it straight up in the air.",
    difficulty: 1,
  },
  {
    id: "ip-03",
    text: "A man is looking at a photograph. Someone asks 'Whose picture is that?' He replies: 'Brothers and sisters I have none, but that man's father is my father's son.' Who is in the photograph?",
    hint: "Parse 'my father's son' first  --  who is that?",
    answer: "His son. 'My father's son' is himself.",
    difficulty: 3,
  },
  {
    id: "ip-04",
    text: "You have two ropes. Each takes exactly 60 minutes to burn from one end to the other, but they burn at uneven rates (the first half might burn in 5 minutes and the second in 55). How do you measure exactly 45 minutes?",
    hint: "What if you lit more than one end?",
    answer: "Light Rope 1 from both ends and Rope 2 from one end simultaneously. Rope 1 burns out in 30 minutes. At that moment, light the other end of Rope 2  --  it has 30 minutes left, now burning from both ends, so it takes 15 minutes. 30 + 15 = 45 minutes.",
    difficulty: 4,
  },
  {
    id: "ip-05",
    text: "Move one matchstick to make this equation true: VI = IX + III",
    hint: "Roman numerals are made of sticks.",
    answer: "Move one stick from IX to make it X, and the equation becomes VI = X − III (but in the classic version: move the I from the left of X to after VI to get VII = IX − II, or simply VI + III = IX by moving the = sign).",
    difficulty: 3,
  },
  {
    id: "ip-06",
    text: "Three switches outside a closed room each control one of three light bulbs inside. You may flip any switches you want, but you may only enter the room once. How do you determine which switch controls which bulb?",
    hint: "Bulbs get warm.",
    answer: "Turn on switch 1 for 10 minutes, then turn it off and turn on switch 2. Enter the room. The warm-but-off bulb is switch 1, the on bulb is switch 2, and the cold-off bulb is switch 3.",
    difficulty: 3,
  },
  {
    id: "ip-07",
    text: "You're in a race and you pass the person in second place. What place are you in now?",
    hint: "Be literal.",
    answer: "Second place. You took second's position, not first's.",
    difficulty: 1,
  },
  {
    id: "ip-08",
    text: "A windowless room has 3 light bulbs. You cannot see inside. You have 3 switches, each connected to one bulb. How to identify each? (You can enter only once.)",
    hint: "Use senses beyond sight.",
    answer: "Turn switch 1 on for 10 min, turn it off, turn switch 2 on. Enter: the hot-but-off bulb = switch 1, the on bulb = switch 2, the cold-off bulb = switch 3.",
    difficulty: 2,
  },
];

export const REFRAME_PROMPTS: ReframePrompt[] = [
  {
    id: "rf-01",
    scenario: "You gave a presentation at work and stumbled over your words several times.",
    negativeThought: "Everyone thinks I'm incompetent. I embarrassed myself.",
    guidingQuestions: [
      "What evidence do you have that 'everyone' thinks this?",
      "Have you ever seen someone else stumble in a presentation? What did you think of them?",
      "What is one thing that went well in the presentation?",
      "What would you say to a friend who told you this happened to them?",
    ],
  },
  {
    id: "rf-02",
    scenario: "A friend didn't reply to your message for two days.",
    negativeThought: "They're avoiding me. I must have done something wrong.",
    guidingQuestions: [
      "What are three non-personal reasons someone might not reply for two days?",
      "Have you ever taken a long time to reply to someone without it meaning anything negative?",
      "Is there a pattern here, or is this a single event?",
    ],
  },
  {
    id: "rf-03",
    scenario: "You set a goal to wake at 5:00 AM every day this week. You slept through the alarm twice.",
    negativeThought: "I have no discipline. I'll never be able to stick to this routine.",
    guidingQuestions: [
      "You woke early 5 out of 7 days  --  what does the 71% success rate tell you?",
      "What was different about the two mornings you slept in? (late night, illness, stress?)",
      "Is the 5:00 AM target realistic, or would 5:30 AM be a better start?",
      "What would you adjust rather than abandoning the whole goal?",
    ],
  },
  {
    id: "rf-04",
    scenario: "You broke your meditation streak after 30 consecutive days.",
    negativeThought: "I ruined everything. All that progress is wasted.",
    guidingQuestions: [
      "Is a habit defined by a streak, or by the average frequency over a month?",
      "What did you gain from those 30 days? Did the benefits disappear when the streak broke?",
      "What would you tell a friend who said '30 out of 31 days is failure'?",
    ],
  },
  {
    id: "rf-05",
    scenario: "You compared your daily routine to someone's 'perfect morning routine' on social media.",
    negativeThought: "My routine is inadequate. I should be doing more.",
    guidingQuestions: [
      "What context is missing from that social media post?",
      "What are three things in your current routine that genuinely serve you?",
      "Is 'more' always better, or is consistency with less more effective?",
    ],
  },
];

export function randomPuzzle(): InsightPuzzle {
  return INSIGHT_PUZZLES[Math.floor(Math.random() * INSIGHT_PUZZLES.length)];
}

export function puzzleOfDay(dateISO: string): InsightPuzzle {
  // Deterministic selection based on date
  let hash = 0;
  for (let i = 0; i < dateISO.length; i++) {
    hash = ((hash << 5) - hash + dateISO.charCodeAt(i)) | 0;
  }
  return INSIGHT_PUZZLES[Math.abs(hash) % INSIGHT_PUZZLES.length];
}

export function reframeOfDay(dateISO: string): ReframePrompt {
  let hash = 0;
  for (let i = 0; i < dateISO.length; i++) {
    hash = ((hash << 5) - hash + dateISO.charCodeAt(i) + 7) | 0;
  }
  return REFRAME_PROMPTS[Math.abs(hash) % REFRAME_PROMPTS.length];
}
