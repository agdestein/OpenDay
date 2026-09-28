# Dutch text to check

Thank you for skimming this! All Dutch text is in the blocks marked `nl:`, which sit next to the English (`en:`) and Norwegian (`no:`) versions. You only need to read the `nl:` lines, and the English one next to each is what it should say.

Things worth flagging:
- wrong or stiff Dutch;
- words too hard for kids aged 8–14;
- mistakes in the science.

Two ways to note what you find:
- edit the text directly;
- leave a note with the file name and the first few words of the line.

Most visitors read the menu, the buttons and the in-game hints, so go through those first. The "Hoe werkt dit?" explainers are long and can wait.

## 1. Menu and buttons used by every game (`app/src/shell/`)
- [menu.ts](../app/src/shell/menu.ts): the start menu, game names and taglines
- [hud.ts](../app/src/shell/hud.ts): shared buttons (⌂, sound, title card)
- [scoreflow.ts](../app/src/shell/scoreflow.ts): entering initials, the scoreboard
- [idle.ts](../app/src/shell/idle.ts): the "Speel je nog?" countdown
- [shell.ts](../app/src/shell/shell.ts), [delve.ts](../app/src/shell/delve.ts), [about.ts](../app/src/shell/about.ts)

## 2. Text inside each game
Start with `index.ts` in each folder, which holds the title card, the buttons and the hints; then check the `round*.ts` files, which hold the challenge rounds.

| Game | Files |
|---|---|
| 🌀 Wervel-lab | [windfarm/index.ts](../app/src/games/windfarm/index.ts), [game.ts](../app/src/games/windfarm/game.ts) |
| 🦠 Uitbraak! | [outbreak/index.ts](../app/src/games/outbreak/index.ts), [render.ts](../app/src/games/outbreak/render.ts) |
| 🌊 Red Nederland | [floodland/index.ts](../app/src/games/floodland/index.ts), [text.ts](../app/src/games/floodland/text.ts) |
| 🌡️ Weerdetective | [detective/index.ts](../app/src/games/detective/index.ts) |
| 🦿 Beestenlab | [creature/index.ts](../app/src/games/creature/index.ts), [text.ts](../app/src/games/creature/text.ts), `design.ts`, `presets.ts`, `round*.ts` |
| 🏀 Ballenbak | [bounce/index.ts](../app/src/games/bounce/index.ts), `roundPlinko.ts`, `roundSilo.ts`, `roundSteam.ts` |
| 🪐 Zwaartekracht-doodle | [orbits/index.ts](../app/src/games/orbits/index.ts), `roundDefense.ts`, `roundSling.ts`, `roundZone.ts` |

## 3. "Hoe werkt dit?" explainers (long, lower priority)
These are the `delve.ts` files in each game folder. Two of them also have text in a second file:
- Wervel-lab: `delvestage.ts`
- Beestenlab and Zwaartekracht-doodle: `demos.ts`

## 4. Printed material (`tools/print/`)
- [stand-sheet.html](../tools/print/stand-sheet.html): the staff sheet; the Dutch is the `nl:` block
- [stamp-card.html](../tools/print/stamp-card.html): the kids' stamp card
- [qr-poster.html](../tools/print/qr-poster.html): the "Speel thuis verder!" poster
