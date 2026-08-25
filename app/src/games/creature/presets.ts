// Starter body plans for the build screen. Node 0 is the head (gets the eye).
// Units: meters, y up, ground at y = 0. All face +x (the running direction).
import type { BodyPlan, Genome } from './physics';

export interface Preset {
  name: string;
  emoji: string;
  plan: BodyPlan;
}

const bone = (a: number, b: number) => ({ a, b, muscle: false });
const flex = (a: number, b: number) => ({ a, b, muscle: true });

/** Four-legged friend: rigid body box, swinging legs, bobbing head, wagging tail. */
const doggo: BodyPlan = {
  nodes: [
    { x: 1.15, y: 1.2 }, // 0 head
    { x: 0.0, y: 0.6 }, // 1 rear hip
    { x: 0.9, y: 0.6 }, // 2 front hip
    { x: 0.9, y: 1.0 }, // 3 front shoulder
    { x: 0.0, y: 1.0 }, // 4 rear shoulder
    { x: 0.05, y: 0.07 }, // 5 rear foot
    { x: 0.95, y: 0.07 }, // 6 front foot
    { x: -0.3, y: 1.15 }, // 7 tail tip
  ],
  sticks: [
    bone(1, 2),
    bone(2, 3),
    bone(3, 4),
    bone(4, 1),
    bone(1, 3), // body brace
    bone(3, 0), // neck
    bone(1, 5), // rear leg
    bone(2, 6), // front leg
    flex(4, 0), // head bob
    flex(2, 5), // rear leg swing
    flex(1, 6), // front leg swing
    flex(4, 7), // tail wag
  ],
};

/** Inchworm: a zigzag chain that is all muscle. */
const wiggler: BodyPlan = {
  nodes: [
    { x: 1.4, y: 0.12 }, // 0 head
    { x: 1.05, y: 0.5 },
    { x: 0.7, y: 0.12 },
    { x: 0.35, y: 0.5 },
    { x: 0.0, y: 0.12 },
  ],
  sticks: [flex(0, 1), flex(1, 2), flex(2, 3), flex(3, 4), flex(0, 2), flex(2, 4), bone(1, 3)],
};

/** Frog: triangle body, one folding back leg, one little arm. */
const hopper: BodyPlan = {
  nodes: [
    { x: 0.5, y: 0.9 }, // 0 head
    { x: 0.0, y: 0.55 }, // 1 hip
    { x: 0.7, y: 0.45 }, // 2 chest
    { x: -0.4, y: 0.3 }, // 3 knee
    { x: -0.05, y: 0.07 }, // 4 back foot
    { x: 0.8, y: 0.07 }, // 5 front foot
  ],
  sticks: [
    bone(0, 1),
    bone(0, 2),
    bone(1, 2),
    bone(1, 3), // thigh
    bone(3, 4), // shin
    bone(2, 5), // arm
    flex(1, 4), // leg fold / kick
    flex(3, 2), // leg swing
    flex(1, 5), // arm swing
  ],
};

/** Two-legged walker: hardest to train, funniest to watch. */
const walker: BodyPlan = {
  nodes: [
    { x: 0.08, y: 1.75 }, // 0 head
    { x: 0.0, y: 1.45 }, // 1 shoulder
    { x: 0.0, y: 0.95 }, // 2 hip
    { x: 0.12, y: 0.5 }, // 3 knee
    { x: -0.12, y: 0.5 }, // 4 knee
    { x: 0.2, y: 0.07 }, // 5 foot
    { x: -0.2, y: 0.07 }, // 6 foot
  ],
  sticks: [
    bone(0, 1),
    bone(1, 2), // torso
    bone(2, 3),
    bone(2, 4), // thighs
    bone(3, 5),
    bone(4, 6), // shins
    flex(1, 3), // hip swing
    flex(1, 4),
    flex(2, 5), // knee fold
    flex(2, 6),
  ],
};

export const PRESETS: Preset[] = [
  { name: 'Doggo', emoji: '🐕', plan: doggo },
  { name: 'Wiggler', emoji: '🐛', plan: wiggler },
  { name: 'Hopper', emoji: '🐸', plan: hopper },
  { name: 'Walker', emoji: '🧍', plan: walker },
];

export function clonePlan(plan: BodyPlan): BodyPlan {
  return {
    nodes: plan.nodes.map((n) => ({ ...n })),
    sticks: plan.sticks.map((s) => ({ ...s })),
  };
}

/**
 * Showcase brains for the delve layer's zoo: one evolved genome per preset,
 * trained offline with the exact solver above and picked for gaits that keep
 * ground contact (so they read as walking, not glitch-bouncing).
 */
export const TRAINED: Record<string, Genome> = {
  // NOTE: gaits are chaotic — these exact decimals were what was measured;
  // "tidier" rounding can turn a trot into a faceplant.
  Doggo: {
    freq: 2.78,
    muscles: [
      { amp: 0.063, phase: 1.537 },
      { amp: 0.22, phase: 2.317 },
      { amp: 0.146, phase: 2.122 },
      { amp: 0.122, phase: 5.828 },
    ],
  },
  Wiggler: {
    freq: 2.8,
    muscles: [
      { amp: 0.214, phase: 3.408 },
      { amp: 0, phase: 0.23 },
      { amp: 0.016, phase: 0.341 },
      { amp: 0.235, phase: 0.93 },
      { amp: 0.275, phase: 5.881 },
      { amp: 0.3, phase: 1.75 },
    ],
  },
  Hopper: {
    freq: 2.8,
    muscles: [
      { amp: 0.3, phase: 3.427 },
      { amp: 0.3, phase: 0.487 },
      { amp: 0, phase: 3.032 },
    ],
  },
  Walker: {
    freq: 1.03,
    muscles: [
      { amp: 0.3, phase: 0.96 },
      { amp: 0.259, phase: 3.829 },
      { amp: 0.209, phase: 3.356 },
      { amp: 0.227, phase: 1.376 },
    ],
  },
};

/**
 * Built-in reigning champion for the very first race of the day, before any kid
 * has claimed the throne: a pre-trained Doggo (genome from an offline evolution
 * run with the exact solver above).
 */
export const FALLBACK_CHAMP: { name: string; plan: BodyPlan; genome: Genome; score: number } = {
  name: 'ROBO-PUP',
  plan: doggo,
  score: 17.0,
  genome: {
    freq: 2.36,
    muscles: [
      { amp: 0.272, phase: 6.036 },
      { amp: 0.194, phase: 0.822 },
      { amp: 0.148, phase: 1.359 },
      { amp: 0, phase: -1.079 },
    ],
  },
};
