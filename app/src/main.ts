import './style.css';
import { Shell } from './shell/shell';
import { games } from './games/registry';

// `?games=windfarm,outbreak` limits which games a machine shows, so each computer
// at the stand can showcase a different subset.
const filter = new URLSearchParams(location.search).get('games');
const wanted = filter ? filter.split(',').map((s) => s.trim()) : null;
const selected = wanted ? games.filter((g) => wanted.includes(g.id)) : games;

const shell = new Shell(document.getElementById('app')!, selected.length > 0 ? selected : games);
shell.showMenu();
