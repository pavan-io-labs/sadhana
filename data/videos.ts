/**
 * Curated video library.
 *
 * YouTube-nocookie embeds, loaded only on click. Each video is tagged by evidence
 * tier and linked to evidence cards and practices.
 */

import type { EvidenceTier } from "./science-cards";

export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  channel: string;
  durationMinutes: number;
  tier: EvidenceTier;
  tags: readonly string[];
  linkedCards: readonly string[];
  description: string;
};

export const VIDEOS: readonly Video[] = [
  {
    id: "huberman-morning-sunlight",
    youtubeId: "UF0nqolsNZc",
    title: "Using Light to Optimize Health",
    channel: "Andrew Huberman",
    durationMinutes: 120,
    tier: "strong",
    tags: ["light", "circadian", "sleep"],
    linkedCards: ["morning-light", "sleep-performance"],
    description: "Comprehensive deep-dive on morning light exposure, melanopsin, and circadian phase setting.",
  },
  {
    id: "huberman-sleep",
    youtubeId: "gbQFSMayJxk",
    title: "Master Your Sleep & Be More Alert When Awake",
    channel: "Andrew Huberman",
    durationMinutes: 100,
    tier: "strong",
    tags: ["sleep", "circadian", "caffeine"],
    linkedCards: ["sleep-performance", "caffeine-sleep"],
    description: "Sleep toolkit: temperature, light, timing, caffeine, and supplements based on peer-reviewed research.",
  },
  {
    id: "huberman-nsdr",
    youtubeId: "pL02HRFk2vo",
    title: "Non-Sleep Deep Rest (NSDR) Protocol",
    channel: "Andrew Huberman",
    durationMinutes: 10,
    tier: "moderate",
    tags: ["rest", "recovery", "nidra"],
    linkedCards: ["yoga-nidra"],
    description: "A short, guided NSDR/Yoga Nidra protocol for daytime recovery.",
  },
  {
    id: "attia-strength",
    youtubeId: "jA3gKhJBfjw",
    title: "The Science of Strength Training for Longevity",
    channel: "Peter Attia",
    durationMinutes: 90,
    tier: "strong",
    tags: ["strength", "longevity", "exercise"],
    linkedCards: ["strength-training", "progressive-overload"],
    description: "Why 2–3 sessions per week of compound movements is the evidence-based minimum for healthspan.",
  },
  {
    id: "walker-sleep",
    youtubeId: "5MuIMqhT8DM",
    title: "Why We Sleep  --  Matthew Walker",
    channel: "Google Talks",
    durationMinutes: 55,
    tier: "strong",
    tags: ["sleep", "cognition", "pvt"],
    linkedCards: ["sleep-performance"],
    description: "Walker presents the dose-response curve of sleep loss on cognitive performance, including PVT data.",
  },
  {
    id: "breathing-pranayama",
    youtubeId: "x4m_PdFbu-s",
    title: "The Science of Breathing",
    channel: "Andrew Huberman",
    durationMinutes: 95,
    tier: "moderate",
    tags: ["breathing", "pranayama", "autonomic"],
    linkedCards: ["pranayama-autonomic", "kapalabhati-cautions"],
    description: "How different breathing patterns shift the autonomic balance  --  and which techniques carry real risk.",
  },
  {
    id: "meditation-neuroscience",
    youtubeId: "wTBSGgbIvsY",
    title: "The Neuroscience of Meditation",
    channel: "Andrew Huberman",
    durationMinutes: 95,
    tier: "strong",
    tags: ["meditation", "attention", "mindfulness"],
    linkedCards: ["meditation-attention"],
    description: "What actually changes in the brain with meditation practice  --  from attention to default mode network.",
  },
  {
    id: "oppezzo-walking",
    youtubeId: "Qvk1FNE5WG8",
    title: "Want to be more creative? Go for a walk",
    channel: "TED",
    durationMinutes: 6,
    tier: "strong",
    tags: ["walking", "creativity", "cognition"],
    linkedCards: ["walking-cognition"],
    description: "Stanford study: walking improves creative output by 60%  --  outdoor walking without earbuds is best.",
  },
  {
    id: "hiit-explained",
    youtubeId: "pPYmqZfS__4",
    title: "HIIT vs Steady State Cardio",
    channel: "Jeff Nippard",
    durationMinutes: 12,
    tier: "strong",
    tags: ["cardio", "intervals", "vo2max"],
    linkedCards: ["hiit-vo2max", "zone-two"],
    description: "Evidence comparison of interval vs continuous training for VO2max and body composition.",
  },
  {
    id: "chronotype-roenneberg",
    youtubeId: "17ZnSgfu7A4",
    title: "Internal Time  --  Till Roenneberg",
    channel: "Google Talks",
    durationMinutes: 50,
    tier: "strong",
    tags: ["chronotype", "circadian", "sleep"],
    linkedCards: ["chronotype"],
    description: "The researcher behind the Munich Chronotype Questionnaire explains social jetlag and its metabolic consequences.",
  },
];

/* ---------------------------------------------------------------- lookups */

export function findVideo(id: string): Video | undefined {
  return VIDEOS.find((v) => v.id === id);
}

export function videosForTag(tag: string): Video[] {
  return VIDEOS.filter((v) => v.tags.includes(tag));
}

export function videosForCard(cardId: string): Video[] {
  return VIDEOS.filter((v) => v.linkedCards.includes(cardId));
}
