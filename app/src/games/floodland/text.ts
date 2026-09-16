import { pick, type Localized } from '../../lib/i18n';
interface Text {
  scrub: string; subtitle: string; build: string; storm: string; rewind: string; undo: string; reset: string;
  model: string; landscape: string; pause: string; resume: string; step: string; slow: string;
  crest: string; budget: string; homes: string; sea: string; draw: string; running: string;
  ended: string; safe: string; gap: string; cost: string; expensive: string; previous: string;
  school: string; village: string; northsea: string; polder: string; opening: string;
  modelHint: string; depth: string; ground: string; speed: string; slice: string;
  low: string; high: string; stormTime: string; ready: string; blocked: string;
}
const T: Localized<Text> = {
 en: {
 scrub:'Drag to explore the storm',
 subtitle:'BEAT THE STORM', build:'Build', storm:'Send the storm', rewind:'Rewind & fix', undo:'Undo', reset:'New landscape',
 model:'See the model', landscape:'See the landscape', pause:'Pause', resume:'Continue', step:'One step', slow:'Slow motion',
 crest:'Dike height', budget:'Sand left', homes:'Homes dry', sea:'Sea level', draw:'Draw across the opening. Release to build your dike.', running:'Follow the water. Pause to inspect it, or rewind to change your design.',
 ended:'Storm passed. Rewind, improve, and try the same storm again.', safe:'Every home stayed dry!', gap:'Watch the opening: water can enter here.', cost:'Sand needed', expensive:'Not enough sand — try a shorter dike.', previous:'Show previous flood',
 school:'School', village:'Polder village', northsea:'NORTH SEA', polder:'LAND BELOW SEA LEVEL', opening:'Close this gap',
 modelHint:'Each cell stores depth and momentum. Arrows show flow. Build here too. Drag the timeline to explore the flood; point at a cell to inspect it.',
 depth:'Water depth', ground:'Ground', speed:'Flow speed', slice:'SECTION THROUGH THE OPENING · HEIGHT EXAGGERATED',
 low:'Low · 1.0 m', high:'High · 2.4 m', stormTime:'Storm', ready:'Build your defense', blocked:'Water reached a home. Follow the stream back to the opening or a low crest.'
 },
 nl: {
 scrub:'Sleep om de storm te bekijken',
 subtitle:'VERSLA DE STORM', build:'Bouwen', storm:'Start de storm', rewind:'Terug & verbeteren', undo:'Ongedaan', reset:'Nieuw landschap',
 model:'Bekijk het model', landscape:'Bekijk het landschap', pause:'Pauze', resume:'Verder', step:'Eén stap', slow:'Vertraagd',
 crest:'Dijkhoogte', budget:'Zand over', homes:'Huizen droog', sea:'Zeeniveau', draw:'Teken over de opening. Laat los om je dijk te bouwen.', running:'Volg het water. Pauzeer om te kijken of ga terug om je ontwerp te veranderen.',
 ended:'De storm is voorbij. Ga terug, verbeter en probeer dezelfde storm opnieuw.', safe:'Alle huizen bleven droog!', gap:'Kijk naar de opening: hier kan water binnenkomen.', cost:'Zand nodig', expensive:'Niet genoeg zand — probeer een kortere dijk.', previous:'Toon vorige overstroming',
 school:'School', village:'Polderdorp', northsea:'NOORDZEE', polder:'LAND ONDER ZEENIVEAU', opening:'Sluit dit gat',
 modelHint:'Elke cel bewaart diepte en impuls. Pijlen tonen de stroming. Bouw ook hier. Sleep de tijdlijn om de overstroming te bekijken; wijs een cel aan voor details.',
 depth:'Waterdiepte', ground:'Bodem', speed:'Stroomsnelheid', slice:'DOORSNEDE DOOR DE OPENING · HOOGTE OVERDREVEN',
 low:'Laag · 1,0 m', high:'Hoog · 2,4 m', stormTime:'Storm', ready:'Bouw je verdediging', blocked:'Water bereikte een huis. Volg de stroom terug naar de opening of een lage dijk.'
 },
 no: {
 scrub:'Dra for å utforske stormen',
 subtitle:'SLÅ STORMEN', build:'Bygg', storm:'Start stormen', rewind:'Spol tilbake & fiks', undo:'Angre', reset:'Nytt landskap',
 model:'Se modellen', landscape:'Se landskapet', pause:'Pause', resume:'Fortsett', step:'Ett steg', slow:'Sakte film',
 crest:'Dikehøyde', budget:'Sand igjen', homes:'Tørre hus', sea:'Havnivå', draw:'Tegn over åpningen. Slipp for å bygge diket.', running:'Følg vannet. Sett på pause for å undersøke, eller spol tilbake for å endre planen.',
 ended:'Stormen er over. Spol tilbake, forbedre og prøv samme storm igjen.', safe:'Alle husene holdt seg tørre!', gap:'Se på åpningen: her kan vannet komme inn.', cost:'Sand som trengs', expensive:'Ikke nok sand — prøv et kortere dike.', previous:'Vis forrige flom',
 school:'Skole', village:'Polderlandsby', northsea:'NORDSJØEN', polder:'LAND UNDER HAVNIVÅ', opening:'Lukk åpningen',
 modelHint:'Hver celle lagrer dybde og impuls. Pilene viser strømmen. Bygg her også. Dra tidslinjen for å utforske flommen; pek på en celle for detaljer.',
 depth:'Vanndybde', ground:'Bakke', speed:'Strømhastighet', slice:'SNITT GJENNOM ÅPNINGEN · OVERDREVET HØYDE',
 low:'Lavt · 1,0 m', high:'Høyt · 2,4 m', stormTime:'Storm', ready:'Bygg forsvaret', blocked:'Vann nådde et hus. Følg strømmen tilbake til åpningen eller et lavt dike.'
 }
};
export const text = () => pick(T);
