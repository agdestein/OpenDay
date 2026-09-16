import { pick, type Localized } from '../../lib/i18n';
interface Text {
  calculating: string; calculationFailed: string; incomingWave: string; scenario: string; surgeMode: string; wavesMode: string; fast: string; recovery: string;
  recoveryHint: string; recoveryGateHint: string; pump: string; pumped: string; pumpRate: string;
  gateClosed: string; lowDike: string; waveHint: string;
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
 calculating:'Calculating the waves and drainage…', calculationFailed:'Could not finish the simulation. Try a new landscape.', incomingWave:'Incoming wave',
 scenario:'Challenge', surgeMode:'Storm surge', wavesMode:'Three waves', fast:'Fast ×4', recovery:'Recovery · accelerated time',
 recoveryHint:'The sea has retreated. The pump lifts trapped water out through the canal. Watch the level posts fall.',
 recoveryGateHint:'The emergency gate is closed. The pump can now drain the polder without seawater flowing back in.',
 pump:'Pump', pumped:'Water pumped', pumpRate:'Pump flow', gateClosed:'Emergency gate closed', lowDike:'Low dike: waves can overtop',
 waveHint:'Three long waves are coming. Spend 85 sand to raise the low dike or protect the village behind it.',
 scrub:'Drag to explore the storm',
 subtitle:'BEAT THE STORM', build:'Build', storm:'Send the storm', rewind:'Rewind & fix', undo:'Undo', reset:'New landscape',
 model:'See the model', landscape:'See the landscape', pause:'Pause', resume:'Continue', step:'One step', slow:'Slow motion',
 crest:'Dike height', budget:'Sand left', homes:'Kept dry', sea:'Sea level', draw:'Draw across the opening. Release to build your dike.', running:'Follow the water. Pause to inspect it, or rewind to change your design.',
 ended:'Flood and recovery finished. Rewind to improve your defense.', safe:'Every home stayed dry!', gap:'Watch the opening: water can enter here.', cost:'Sand needed', expensive:'Not enough sand — try a shorter dike.', previous:'Show previous flood',
 school:'School', village:'Polder village', northsea:'NORTH SEA', polder:'LAND BELOW SEA LEVEL', opening:'Close this gap',
 modelHint:'Each cell stores depth and momentum. Arrows show flow. Build here too. Drag the timeline to explore the flood; point at a cell to inspect it.',
 depth:'Water depth', ground:'Ground', speed:'Flow speed', slice:'SECTION THROUGH THE OPENING · HEIGHT EXAGGERATED',
 low:'Low · 1.0 m', high:'High · 2.4 m', stormTime:'Storm', ready:'Build your defense', blocked:'Water reached a home. Follow the stream back to the opening or a low crest.'
 },
 nl: {
 calculating:'Golven en afwatering berekenen…', calculationFailed:'De simulatie kon niet worden voltooid. Probeer een nieuw landschap.', incomingWave:'Inkomende golf',
 scenario:'Uitdaging', surgeMode:'Stormvloed', wavesMode:'Drie golven', fast:'Snel ×4', recovery:'Herstel · versnelde tijd',
 recoveryHint:'De zee is gezakt. Het gemaal voert opgesloten water via de sloot af. Kijk hoe het waterpeil daalt.',
 recoveryGateHint:'De noodkering is gesloten. Het gemaal kan de polder nu leegpompen zonder instromend zeewater.',
 pump:'Gemaal', pumped:'Afgevoerd water', pumpRate:'Pompdebiet', gateClosed:'Noodkering gesloten', lowDike:'Lage dijk: golven slaan erover',
 waveHint:'Er komen drie lange golven. Gebruik 85 zand om de lage dijk te verhogen of het dorp erachter te beschermen.',
 scrub:'Sleep om de storm te bekijken',
 subtitle:'VERSLA DE STORM', build:'Bouwen', storm:'Start de storm', rewind:'Terug & verbeteren', undo:'Ongedaan', reset:'Nieuw landschap',
 model:'Bekijk het model', landscape:'Bekijk het landschap', pause:'Pauze', resume:'Verder', step:'Eén stap', slow:'Vertraagd',
 crest:'Dijkhoogte', budget:'Zand over', homes:'Droog gebleven', sea:'Zeeniveau', draw:'Teken over de opening. Laat los om je dijk te bouwen.', running:'Volg het water. Pauzeer om te kijken of ga terug om je ontwerp te veranderen.',
 ended:'Overstroming en herstel zijn voorbij. Ga terug om je verdediging te verbeteren.', safe:'Alle huizen bleven droog!', gap:'Kijk naar de opening: hier kan water binnenkomen.', cost:'Zand nodig', expensive:'Niet genoeg zand — probeer een kortere dijk.', previous:'Toon vorige overstroming',
 school:'School', village:'Polderdorp', northsea:'NOORDZEE', polder:'LAND ONDER ZEENIVEAU', opening:'Sluit dit gat',
 modelHint:'Elke cel bewaart diepte en impuls. Pijlen tonen de stroming. Bouw ook hier. Sleep de tijdlijn om de overstroming te bekijken; wijs een cel aan voor details.',
 depth:'Waterdiepte', ground:'Bodem', speed:'Stroomsnelheid', slice:'DOORSNEDE DOOR DE OPENING · HOOGTE OVERDREVEN',
 low:'Laag · 1,0 m', high:'Hoog · 2,4 m', stormTime:'Storm', ready:'Bouw je verdediging', blocked:'Water bereikte een huis. Volg de stroom terug naar de opening of een lage dijk.'
 },
 no: {
 calculating:'Beregner bølger og drenering…', calculationFailed:'Simuleringen kunne ikke fullføres. Prøv et nytt landskap.', incomingWave:'Innkommende bølge',
 scenario:'Utfordring', surgeMode:'Stormflo', wavesMode:'Tre bølger', fast:'Raskt ×4', recovery:'Drenering · raskere tid',
 recoveryHint:'Havet har trukket seg tilbake. Pumpen løfter innestengt vann ut gjennom kanalen. Se vannstanden synke.',
 recoveryGateHint:'Nødporten er lukket. Pumpen kan nå tømme polderen uten at sjøvann strømmer inn igjen.',
 pump:'Pumpe', pumped:'Vann pumpet ut', pumpRate:'Pumpeføring', gateClosed:'Nødport lukket', lowDike:'Lavt dike: bølger slår over',
 waveHint:'Tre lange bølger kommer. Bruk 85 sand til å heve det lave diket eller beskytte landsbyen bak det.',
 scrub:'Dra for å utforske stormen',
 subtitle:'SLÅ STORMEN', build:'Bygg', storm:'Start stormen', rewind:'Spol tilbake & fiks', undo:'Angre', reset:'Nytt landskap',
 model:'Se modellen', landscape:'Se landskapet', pause:'Pause', resume:'Fortsett', step:'Ett steg', slow:'Sakte film',
 crest:'Dikehøyde', budget:'Sand igjen', homes:'Holdt tørre', sea:'Havnivå', draw:'Tegn over åpningen. Slipp for å bygge diket.', running:'Følg vannet. Sett på pause for å undersøke, eller spol tilbake for å endre planen.',
 ended:'Flom og drenering er ferdig. Spol tilbake for å forbedre forsvaret.', safe:'Alle husene holdt seg tørre!', gap:'Se på åpningen: her kan vannet komme inn.', cost:'Sand som trengs', expensive:'Ikke nok sand — prøv et kortere dike.', previous:'Vis forrige flom',
 school:'Skole', village:'Polderlandsby', northsea:'NORDSJØEN', polder:'LAND UNDER HAVNIVÅ', opening:'Lukk åpningen',
 modelHint:'Hver celle lagrer dybde og impuls. Pilene viser strømmen. Bygg her også. Dra tidslinjen for å utforske flommen; pek på en celle for detaljer.',
 depth:'Vanndybde', ground:'Bakke', speed:'Strømhastighet', slice:'SNITT GJENNOM ÅPNINGEN · OVERDREVET HØYDE',
 low:'Lavt · 1,0 m', high:'Høyt · 2,4 m', stormTime:'Storm', ready:'Bygg forsvaret', blocked:'Vann nådde et hus. Følg strømmen tilbake til åpningen eller et lavt dike.'
 }
};
export const text = () => pick(T);
