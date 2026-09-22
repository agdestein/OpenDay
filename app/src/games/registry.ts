import type { ArcadeGame } from '../shell/types';
import { windfarm } from './windfarm';
import { outbreak } from './outbreak';
import { floodland } from './floodland';
import { creature } from './creature';
import { bounce } from './bounce';
import { orbits } from './orbits';
import { detective } from './detective';

/** Adding a game to the arcade = adding one import here. */
export const games: ArcadeGame[] = [windfarm, outbreak, floodland, detective, creature, bounce, orbits];
