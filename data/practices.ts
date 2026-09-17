/**
 * Practices catalog  --  structured data for the Practice view.
 *
 * Each practice has its slug, kind, name, default duration, description,
 * and contraindication information.
 */

export type PracticeKind =
  | "meditation"
  | "pranayama"
  | "nidra"
  | "abhyanga"
  | "walk"
  | "journal"
  | "mantra";

export type PracticeDef = {
  slug: string;
  kind: PracticeKind;
  name: string;
  defaultSeconds: number;
  description: string;
  contraindications: string[];
  requiresEmptyStomach: boolean;
  linkedCards: string[];
};

export const PRACTICES: PracticeDef[] = [
  {
    slug: "meditation",
    kind: "meditation",
    name: "Seated Meditation",
    defaultSeconds: 900,
    description: "Focused attention or open monitoring. Sit with the spine erect, eyes closed, observing the breath.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["meditation"],
  },
  {
    slug: "nadi-shodhana",
    kind: "pranayama",
    name: "Nadi Shodhana",
    defaultSeconds: 600,
    description: "Alternate nostril breathing. Balances the autonomic nervous system. 4:2:4:2 ratio.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["pranayama"],
  },
  {
    slug: "bhramari",
    kind: "pranayama",
    name: "Bhramari",
    defaultSeconds: 300,
    description: "Humming bee breath. Inhale deeply, exhale with a sustained humming sound. Parasympathetic activator.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["pranayama"],
  },
  {
    slug: "kapalabhati",
    kind: "pranayama",
    name: "Kapalabhati",
    defaultSeconds: 300,
    description: "Skull-shining breath. Forceful exhalation, passive inhalation. Activating and clearing.",
    contraindications: [
      "Uncontrolled hypertension",
      "Pregnancy",
      "Epilepsy",
      "Hernia",
      "Recent abdominal surgery",
    ],
    requiresEmptyStomach: true,
    linkedCards: ["pranayama", "kapalabhati"],
  },
  {
    slug: "bhastrika",
    kind: "pranayama",
    name: "Bhastrika",
    defaultSeconds: 300,
    description: "Bellows breath. Equal forceful inhale and exhale through the nose. Sympathetically activating.",
    contraindications: [
      "Uncontrolled hypertension",
      "Pregnancy",
      "Epilepsy",
      "Heart disease",
    ],
    requiresEmptyStomach: true,
    linkedCards: ["pranayama"],
  },
  {
    slug: "box-breathing",
    kind: "pranayama",
    name: "Box Breathing",
    defaultSeconds: 300,
    description: "4:4:4:4 equal-ratio breathing. Used by Navy SEALs for stress management. Calming and centering.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["pranayama"],
  },
  {
    slug: "4-7-8",
    kind: "pranayama",
    name: "4-7-8 Breathing",
    defaultSeconds: 300,
    description: "Inhale 4, hold 7, exhale 8. Extended exhale activates the parasympathetic nervous system. Ideal before sleep.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["pranayama"],
  },
  {
    slug: "yoga-nidra",
    kind: "nidra",
    name: "Yoga Nidra / NSDR",
    defaultSeconds: 1200,
    description: "Non-Sleep Deep Rest. A guided body scan and rotation of consciousness between waking and sleeping states.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["yoga-nidra"],
  },
  {
    slug: "abhyanga",
    kind: "abhyanga",
    name: "Abhyanga",
    defaultSeconds: 900,
    description: "Warm oil self-massage. 10–15 minutes before bathing. Traditionally done with sesame or coconut oil.",
    contraindications: [
      "Fever or acute illness",
      "Skin inflammation, rash, or open wounds",
      "Indigestion or just eaten",
      "Heavy menstruation (use judgement)",
      "Pregnancy (lighter pressure; consult provider)",
    ],
    requiresEmptyStomach: false,
    linkedCards: ["abhyanga"],
  },
  {
    slug: "surya-namaskar",
    kind: "walk",
    name: "Surya Namaskar",
    defaultSeconds: 720,
    description: "Sun salutation  --  12 poses per round. Target 12 rounds for a complete cardiovascular and stretching session.",
    contraindications: [],
    requiresEmptyStomach: true,
    linkedCards: ["surya-namaskar"],
  },
  {
    slug: "morning-walk",
    kind: "walk",
    name: "Morning Walk",
    defaultSeconds: 600,
    description: "10-minute walk in morning light within 60 minutes of waking. The single highest-ROI health intervention.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: ["morning-light"],
  },
  {
    slug: "journaling",
    kind: "journal",
    name: "Evening Journal",
    defaultSeconds: 600,
    description: "Write freely for 10 minutes. Gratitude, reflection, or tomorrow's most important task.",
    contraindications: [],
    requiresEmptyStomach: false,
    linkedCards: [],
  },
];

export function findPractice(slug: string): PracticeDef | undefined {
  return PRACTICES.find((p) => p.slug === slug);
}

export function practicesByKind(kind: PracticeKind): PracticeDef[] {
  return PRACTICES.filter((p) => p.kind === kind);
}
