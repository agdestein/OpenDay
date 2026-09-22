import { pick, type Localized } from '../../lib/i18n';
const en = {
  subtitle:'BEAT THE STORM', storm:'Send the storm', rewind:'Build again', undo:'Undo', reset:'Start fresh',
  more:'More', scenario:'Challenge', surgeMode:'Storm surge', wavesMode:'Three waves',
  systemHint:'Dikes keep the sea out. A canal collects water in the pond, where an automatic pump maintains the water level. A flood can arrive faster than the pump can remove it. Hold to add sand; a slower stroke builds higher. The posts show local water depth.',
  pause:'Pause', resume:'Continue', step:'One frame', slow:'Slow motion', fast:'Fast ×4', model:'From above', landscape:'3D view', previous:'Previous flood',
  scrub:'Explore the flood and drainage', calculating:'Calculating the flood…', calculationFailed:'Could not finish the simulation. Try a fresh landscape.',
  homes:'Kept dry', budget:'Sand', draw:'Hold to raise sand. Drag slowly to build a dike.',
  ended:'Try a different defense, or explore the timeline.', safe:'Every home stayed dry.',
  recoveryHint:'The sea is retreating. The pond and pump continue draining the polder.',
  running:'Watch the water, or drag the timeline to explore.', recovery:'Drainage', stormTime:'Storm', ready:'Shape your defense',
  ground:'Ground', depth:'Water depth', speed:'Flow speed', pumpRate:'Pump flow', slice:'SECTION THROUGH THE LOW DIKE · HEIGHT EXAGGERATED',
};
const T: Localized<typeof en> = {
  en,
  nl: {
    subtitle:'VERSLA DE STORM', storm:'Start de storm', rewind:'Verder bouwen', undo:'Ongedaan', reset:'Begin opnieuw',
    more:'Meer', scenario:'Uitdaging', surgeMode:'Stormvloed', wavesMode:'Drie golven',
    systemHint:'Dijken houden de zee tegen. Een sloot verzamelt water in de vijver, waar een automatisch gemaal het peil regelt. Bij een overstroming kan water sneller binnenkomen dan de pomp het afvoert. Houd ingedrukt om zand toe te voegen; langzaam slepen bouwt hoger. De palen tonen de lokale waterdiepte.',
    pause:'Pauze', resume:'Verder', step:'Eén beeld', slow:'Vertraagd', fast:'Snel ×4', model:'Van boven', landscape:'3D-weergave', previous:'Vorige overstroming',
    scrub:'Bekijk de overstroming en afwatering', calculating:'Overstroming berekenen…', calculationFailed:'De simulatie kon niet worden voltooid. Probeer een nieuw landschap.',
    homes:'Droog gebleven', budget:'Zand', draw:'Houd ingedrukt om zand toe te voegen. Sleep langzaam voor een hogere dijk.',
    ended:'Probeer een andere verdediging of bekijk de tijdlijn.', safe:'Alle huizen bleven droog.',
    recoveryHint:'De zee zakt. De vijver en het gemaal blijven de polder ontwateren.',
    running:'Volg het water of sleep de tijdlijn.', recovery:'Afwatering', stormTime:'Storm', ready:'Bouw je verdediging',
    ground:'Bodem', depth:'Waterdiepte', speed:'Stroomsnelheid', pumpRate:'Pompdebiet', slice:'DOORSNEDE DOOR DE LAGE DIJK · HOOGTE OVERDREVEN',
  },
  no: {
    subtitle:'SLÅ STORMEN', storm:'Start stormen', rewind:'Bygg videre', undo:'Angre', reset:'Begynn på nytt',
    more:'Mer', scenario:'Utfordring', surgeMode:'Stormflo', wavesMode:'Tre bølger',
    systemHint:'Diker holder havet ute. En kanal samler vann i dammen, der en automatisk pumpe regulerer vannstanden. En flom kan komme raskere enn pumpen klarer å fjerne vannet. Hold inne for å legge sand; langsomme strøk bygger høyere. Stolpene viser lokal vanndybde.',
    pause:'Pause', resume:'Fortsett', step:'Ett bilde', slow:'Sakte film', fast:'Raskt ×4', model:'Ovenfra', landscape:'3D-visning', previous:'Forrige flom',
    scrub:'Utforsk flommen og dreneringen', calculating:'Beregner flommen…', calculationFailed:'Simuleringen kunne ikke fullføres. Prøv et nytt landskap.',
    homes:'Holdt tørre', budget:'Sand', draw:'Hold inne for å legge sand. Dra langsomt for å bygge høyere.',
    ended:'Prøv et annet forsvar, eller utforsk tidslinjen.', safe:'Alle husene holdt seg tørre.',
    recoveryHint:'Havet trekker seg tilbake. Dammen og pumpen fortsetter å drenere polderen.',
    running:'Følg vannet, eller dra i tidslinjen.', recovery:'Drenering', stormTime:'Storm', ready:'Bygg forsvaret',
    ground:'Bakke', depth:'Vanndybde', speed:'Strømhastighet', pumpRate:'Pumpeføring', slice:'SNITT GJENNOM DET LAVE DIKET · OVERDREVET HØYDE',
  },
};
export const text = () => pick(T);
