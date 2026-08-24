import type { ArcadeGame } from '../shell/types';
import { bounce } from './bounce';
import { orbits } from './orbits';

/** Adding a game to the arcade = adding one import here. */
export const games: ArcadeGame[] = [bounce, orbits];
