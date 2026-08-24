import type { ArcadeGame } from '../shell/types';
import { windfarm } from './windfarm';
import { outbreak } from './outbreak';
import { bounce } from './bounce';
import { orbits } from './orbits';

/** Adding a game to the arcade = adding one import here. */
export const games: ArcadeGame[] = [windfarm, outbreak, bounce, orbits];
