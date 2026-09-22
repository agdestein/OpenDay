// Weather Detective: a real KNMI weather map hides under the fog; place
// thermometers and a Gaussian process fills in the rest, showing how sure it
// is. The game itself (and its ~400 kB of map data) loads on demand.
import type { ArcadeGame, GameHost, GameInstance } from '../../shell/types';

export const detective: ArcadeGame = {
  id: 'detective',
  title: { en: 'Weather Detective', nl: 'Weerdetective', no: 'Værdetektiv' },
  scienceLine: {
    en: 'Together with KNMI we turn thousands of official and home weather stations into one weather map of Europe, and the maths tells us how sure we are.',
    nl: 'Samen met het KNMI maken we van duizenden officiële en thuisweerstations één weerkaart van Europa, en de wiskunde vertelt hoe zeker we zijn.',
    no: 'Sammen med KNMI gjør vi tusenvis av offisielle værstasjoner og hjemmestasjoner om til ett værkart over Europa, og matematikken forteller hvor sikre vi er.',
  },
  tileEmoji: '🌡️',
  create(host: GameHost): GameInstance {
    let game: GameInstance | null = null;
    let destroyed = false;
    let started = false;
    const loading = import('./game').then(({ DetectiveGame }) => {
      if (destroyed) return;
      game = new DetectiveGame(host);
      if (started) game.start();
    });
    loading.catch((error) => console.error(error));
    return {
      start() {
        started = true;
        game?.start();
      },
      frame(dt) {
        game?.frame(dt);
      },
      destroy() {
        destroyed = true;
        game?.destroy();
      },
    };
  },
};
