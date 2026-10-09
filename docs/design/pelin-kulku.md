# GlobeCiv3 — pelin kulku: aloitus, heksakartta, fog of war ja tiedustelu

> Hyväksytty suunnitelma 2026-10-09. Grafiikat tekee Claude Design (design-brief.md)
> ennen toteutusta (Samin pyyntö). Pelin nimet ovat omia, luvut Freecivin
> Civ I -sääntösarjasta (CLAUDE.md, sääntö 4).

## Context

Moottori on valmis: saumaton zoom planeetalta tasolle 17, valtiot, läänit ja
kaupunkialueet sisäkkäin, sekä deterministinen maasto. Sami haluaa nyt koko
pelin kulun:

- Peli alkaa ruudusta, jossa näkyy koko pallo. **Uusi peli** zoomaa alimpaan
  kaupunkialuetasoon arvottuun aloituspaikkaan.
- Ulospäin ei voi zoomata ennen kuin seuraava taso on tiedusteltu.
- Alin taso näkyy **heksaruutuina kuten Civilizationissa**, ja ruuduilla on
  Civ-tyyliset maastot ja resurssit.
- Kaikki aloitusalueen ulkopuolella on fog of warin peitossa. Tiedustelijat
  etsivät naapurimaita.
- Ensin suunnitelma, sitten Claude Design tekee grafiikat.

Tavoite on peli, jota on helppo ja kiva pelata puhelimella, ja jonka idea on
uusi eikä Civilizationin kopio.

## Pelikonsepti: "Kartta, joka piirtyy" (Samin valinnat 2026-10-09)

**Ydinidea:** yksiköt toimivat **autonomisesti** (GlobeCiv2:n ja Majestyn
henki), ja pelaaja ohjaa niitä **kerroskohtaisilla toiminnoilla**. Jokainen
zoom-taso aukeaa, kun sen alue on riittävästi kartoitettu, joten pelaaja
piirtää maailman kartaksi taso kerrallaan.

| Kerros | Avautuu kun | Pelaajan toiminnot (ehdotus) | Yksiköt tekevät itse |
|---|---|---|---|
| Kaupunkialue (alin, noin 61 heksaruutua) | heti | yksiköiden moodit (Tutki, Kerää, Puolusta), tutkimuslippu ruudulle, kaupungin paikka | kulkevat kohti sumua ja lippuja, keräävät resursseja ja perustavat kaupungin merkittyyn kohtaan |
| Lääni | 60 % läänin ruuduista kartoitettu | painotus kaupunkialueittain (tutki, asuta, ohita), retkikunta naapurialueelle | jakautuvat painotusten mukaan |
| Valtio | 60 % valtion ruuduista kartoitettu | valtion linja (laajentuminen, tutkimus, puolustus), läänin haltuunotto tavoitteeksi | — |
| Planeetta | oma valtio vallattu | kohdevaltion valinta, myöhemmin diplomatia | — |

60 % on oletus, jota säädetään pelitestauksessa (yksi vakio). Alemman tason
toiminta jatkuu, kun zoomaat ulos. Tämä on sama simulaatio-LOD-idea kuin
EPIC-004:ssä, nyt pelimekaniikkana.

**Aika kulkee reaaliajassa ja tauolla.** Päivä vaihtuu noin 1,5 sekunnin
välein, ja pelaaja voi pysäyttää pelin tai nopeuttaa sitä (1×, 2×, 4×).
Ajoitus seuraa seinäkelloa (CLAUDE.md, sääntö 5).

**Tiedustelijat ovat retkikuntia.** Niitä ei liikuteta ruutu kerrallaan.
Ne etsivät itse lähimmän sumun reunan, ja pelaajan tutkimuslippu (Majesty-
tyylinen palkkio) vetää niitä haluttuun suuntaan. Matkalla ne paljastavat
ruudut 2 ruudun säteellä ja tekevät **löytöjä**, jotka näytetään kortteina,
joista valitaan toinen kahdesta (esim. "Kalaisat vedet: +ruokaa" / "Vanhat
rauniot: +tiedustelija"). Polytopian kokemus tukee tätä: sumu poistuu
liikkumalla, ja yksinkertaisuus on tietoinen valinta.

**Fog of war** on aluksi yksinkertainen kerran paljastus: kerran nähty pysyy
näkyvissä, kuten Polytopiassa. Myöhemmin voi lisätä "nyt näkyvissä" -tilan
vihollisille.

**Talous on Civ I:n perusmekaniikka.** Ruudun ruoka, tuotanto ja kauppa sekä
erikoisresurssit tulevat Freecivin Civ I -sääntösarjasta (lähde alla). Pelissä
käytetään omia nimiä ja grafiikoita (CLAUDE.md, sääntö 4).

## Tekninen ratkaisu

### 1. Globaali heksaruudukko (alin taso)

Koko pallo jaetaan **geodeettiseksi heksaruudukoksi**: ikosaedri jaetaan
taajuudella f, solmut ovat heksoja ja 12 kulmaa ovat viisikulmioita.
Valtiot (STORY-001) ovat jo samaa ruudukkoa taajuudella 6.

- Valtiot, läänit ja kaupunkialueet määritellään **ruutujen joukkoina**:
  ruutu kuuluu sille alueelle, jolle sen keskipiste kuuluu (nykyiset
  `Regions.stateOf/provinceOf/cityOf`, `src/globe/regions.ts`). Rajat
  kulkevat silloin heksojen reunoja pitkin kuten Civissä, ja kaukaa ne
  näyttävät samoilta kuin nyt.
- Noin 61 ruutua kaupunkialuetta kohden (Samin valinta): 17 738 × 61 ≈
  1,08 miljoonaa ruutua, eli f ≈ 330 (10f² + 2 ruutua). Ruutu on noin
  0,0034 rad, ja se näkyy 64 px:n kokoisena noin quadtree-tasolla 7.
  Tasot 8–17 ovat yhden ruudun sisällä (maasto, yksiköt ja myöhemmin
  kaupungin rakennukset).
- Uusi moduuli `src/globe/hexTiles.ts`: piste → ruutu (tahko, ikosaedrin
  barysentriset koordinaatit, pyöristys), kanoninen ruututunnus, naapurit
  ja keskipiste. Testataan Nodessa kuten `cubeSphere.ts`.

### 2. Ruutujen maasto ja resurssit

- `src/game/tileTypes.ts`: ruudun tyyppi ruudun keskipisteen maastosta
  (`terrainAt`, `src/globe/terrain.ts`), leveysasteesta (|y|) ja
  kosteuskohinasta: valtameri, aavikko, metsä, ruohomaa, kukkulat, viidakko,
  vuoret, tasanko, suo, tundra ja arktinen. Erikoisresurssi hashista,
  deterministisesti siemenestä.
- Tuotot ja resurssit (lähde: Freeciv, `data/civ1/terrain.ruleset`):

| Maasto | Ruoka / tuotanto / kauppa | Liikkuminen | Resurssi (lisä) |
|---|---|---|---|
| Valtameri | 1 / 0 / 2 | 1 | Kala (+2 ruokaa) |
| Arktinen | 0 / 0 / 0 | 2 | Hylkeet (+2 ruokaa) |
| Aavikko | 0 / 1 / 0 | 1 | Keidas (+3 ruokaa) |
| Metsä | 1 / 2 / 0 | 2 | Riista (+2 ruokaa) |
| Ruohomaa | 2 / 0 / 0 | 1 | Hedelmällinen maa (+1 tuotanto; lähteessä Resources) |
| Kukkulat | 1 / 0 / 0 | 2 | Hiili (+2 tuotanto) |
| Viidakko | 1 / 0 / 0 | 2 | Jalokivet (+4 kauppa) |
| Vuoret | 0 / 1 / 0 | 3 | Kulta (+6 kauppa) |
| Tasanko | 1 / 1 / 0 | 1 | Hevoset (+2 tuotanto) |
| Suo | 1 / 0 / 0 | 2 | Öljy (+4 tuotanto) |
| Tundra | 1 / 0 / 0 | 1 | Poro (+2 ruokaa; lähteessä Game) |

- Ruutudata lasketaan laiskasti kaupunkialue kerrallaan, kun alue paljastuu
  (noin 40–90 ruutua, millisekunteja).

### 3. Piirto ruutuzoomissa

`src/globe/tiles.ts`:n fragmenttishaderi laajenee:
- pikselin ruutu lasketaan ikosaedrin ruudukosta ruudun paikallisissa
  koordinaateissa (sama tarkkuustemppu kuin kohinalla, `octaveSplit`)
- heksareunat ohuina viivoina, kun ruutu on yli noin 24 px
- ruudun tyyppiväri sekoitetaan jatkuvaan maastoon, jolloin Civ-mainen
  kartta näkyy ruutuzoomissa ja jatkuva maasto syvemmällä
- alueiden rajat kulkevat ruutuzoomissa heksareunoja pitkin (raja, jos
  vierekkäisten ruutujen alueet eroavat) ja kaukana kuten nyt
- fog luetaan **globaalista datatekstuurista** (yksi tekseli ruutua kohden,
  noin 1 Mt): 0 = tuntematon, 1 = kartoitettu. Tuntematon piirretään
  "kartan reunana" (Claude Designin tyyli).
- Resurssi- ja yksikkökuvakkeet ovat instansoituja kuvakkeita (sprite)
  ruutujen keskellä. Grafiikat tekee Claude Design.

### 4. Pelitila ja pelin kulku

Uusi `src/game/` (puhdas TypeScript, ilman Three.js:ää, testattava):
- `GameState`: siemen, päivä, fog (Uint8Array ruutua kohden), yksiköt,
  kaupungit, liput ja avatut tasot
- `newGame(seed)`: arpoo aloituskaupunkialueen (maata, ei napa-aluetta,
  vähintään puolet ruuduista maata), antaa yksiköt (2 tiedustelijaa ja
  uudisasukas) ja paljastaa aloitusalueen
- `clock.ts`: päivätikki seinäkellon mukaan (noin 1,5 s), tauko ja nopeus
  1×, 2× ja 4×. Simulaatio on irti renderöinnistä: tikki etenee
  `requestAnimationFrame`-silmukassa todellisen ajan mukaan.
- `ai.ts`: autonominen päätös per yksikkö ja päivä moodin, lippujen ja
  sumun perusteella (GlobeCiv2:n `CitizenAI`:n idea, kirjoitetaan
  uudelleen ruutugraafille). Liike A*-reitillä (liikkumiskustannukset
  taulukosta), näkösäde 2.
- `orders.ts`: kerroskohtaiset toiminnot (taulukko yllä) tilan muutoksina
- `discoveries.ts`: löydöt ja valintakortit (peli pysähtyy kortin ajaksi),
  deterministisesti siemenestä
- `unlocks.ts`: kartoitusprosentti per alue. Kun se ylittää 60 %, kamera
  (`GlobeCamera.maxDist`, `src/globe/camera.ts`) päästää seuraavalle
  tasolle, ja HUD näyttää ilmoituksen.

### 5. Näkymät ja pelaajan polku

1. **Aloitusnäyttö**: pallo pyörii hitaasti tähtien keskellä. Napit: Uusi
   peli ja Jatka (tallennus myöhemmin). Kartta on tumma, sumuinen siluetti.
2. **Uusi peli**: aloituspaikka arvotaan, ja kamera lentää (`flyTo`)
   planeetalta kaupunkialueeseen noin 3 sekunnissa. Vähennetyllä liikkeellä
   siirtymä on välitön. Zoom ulos on lukittu.
3. **Kaupunkialuenäkymä**: heksaruudut, aloitusalue näkyvissä ja muu sumussa.
   Tiedustelijat ja uudisasukas ovat valmiina.
4. Aika alkaa kulua. Tiedustelijat lähtevät itse, ja pelaaja asettaa moodeja
   ja lippuja, valitsee kaupungin paikan ja vastaa löytökortteihin.
   Tauko ja nopeus ovat aina käytettävissä.
5. Kun 60 % läänistä on kartoitettu, tulee ilmoitus **"Lääni kartoitettu —
   zoomaa ulos"**, ja zoom avautuu läänin tasolle uusine toimintoineen.
6. Sama toistuu valtio- ja planeettatasolla.

### 6. Claude Design -briiffi (grafiikat)

Päivitetään `design-brief.md`:
- Aloitusnäyttö, HUD kerroksittain, löytökortti, avautumisilmoitus,
  yksikkövalikko ja kaupunkikortti
- Kuvakkeet: 11 maastoa, 10 resurssia, yksiköt (tiedustelija, uudisasukas,
  soturi), kaupunki ja sumun reuna (kartta tai pergamentti)
- Rajoitteet: 44 px kosketuskohteet, OKLCH-tokenit, toimii 390 px:n
  leveydellä, vähennetty liike, ei Civilizationin nimiä eikä ulkoasua

## Backlog

Uusi EPIC-006 "Pelin kulku". Storyja on jo 20, joten EPIC-004:n
simulaatio-LOD-storyt (013–015) siirtyvät MVP:n jälkeen, ja STORY-020
sulautuu uuteen epiciin.

| Story | Sisältö | Koko |
|---|---|---|
| A | Aloitusnäyttö, uusi peli, arvottu aloitus, lento ja zoom-lukko | M |
| B | Geodeettinen heksaruudukko ja alueet ruutujen joukkoina | L |
| C | Ruutujen maasto, resurssit ja piirto ruutuzoomissa | L |
| D | Fog of war: tila, tekstuuri ja piirto | M |
| E | Päiväkello, tauko ja nopeus sekä autonomiset tiedustelijat (reitti, näkö ja liput) | L |
| F | Tasojen avautuminen kartoitusprosentilla ja kerroskohtaiset toiminnot | M |
| G | Löydöt ja valintakortit | M |
| H | Kaupungin perustaminen ja Civ I -tuotot (perus) | L |

Järjestys: A → B → C → D → E → F, sen jälkeen G ja H. Claude Design -briiffi
heti A:n jälkeen, jotta grafiikat valmistuvat C–E:n aikana.

## Verification

- Yksikkötestit (Vitest): heksaruudukon piste → ruutu → keskipiste
  edestakaisin kaikilla tahkoilla, naapurit (6 tai 5), ruutujen määrä
  10f² + 2. Alueet ruutujen joukkoina ovat tarkasti sisäkkäisiä. Tuotot
  vastaavat lähdetaulukkoa. `newGame`-determinismi. A*-reitti.
  Avautumisehto.
- E2E (Playwright): Uusi peli → lento → kaupunkialuenäkymä. Zoom ulos
  estetty ennen kartoitusta ja sallittu sen jälkeen. Tiedustelija paljastaa
  sumua. Kuvat aloitus- ja ruutunäkymästä. Ei konsolivirheitä.
- Suorituskyky: Intel UHD vähintään 55 fps ruutuzoomissa (nyt 56–61 fps).
  Puhelintesti Samilta Pagesista.

## Lähteet

- Civ I -tuotot ja resurssit: Freeciv, `data/civ1/terrain.ruleset`
  (https://github.com/freeciv/freeciv/blob/main/data/civ1/terrain.ruleset), GPL.
  Luvut ovat pelimekaniikkaa, ja lähde kirjataan koodiin.
- Polytopia: sumu ja tutkiminen ydinsilmukassa, yksinkertaisuus tietoisena
  valintana (https://mechanicsofmagic.com/2022/05/22/critical-play-is-this-game-balanced-polytopia-tristan-wang/,
  https://www.ancientworldmagazine.com/reviews/battle-polytopia/)
- Pysyvä ja kertaluonteinen sumu 4X-peleissä
  (https://forums.sorcererking.com/450883/page/1/)
- Mobiilin rajoitteet ja vuoropohjaisuus
  (https://gamedeveloper.com/design/galactic-reign-competitive-depth-on-mobile-platforms)

## Päätökset (Sami 2026-10-09) ja jäljellä olevat oletukset

- Autonomiset yksiköt ja kerroskohtaiset toiminnot
- Reaaliaika ja tauko
- Avautuminen kartoitusprosentilla (oletus 60 %, säädetään pelitestauksessa)
- Noin 61 heksaruutua kaupunkialuetta kohden (f ≈ 330)
- Oletukset, joita Sami voi muuttaa: 7 lääniä valtiossa ja 7 kaupunkialuetta
  läänissä (nykyinen moottori), aloitusyksiköt (2 tiedustelijaa ja
  uudisasukas), kertapaljastus-sumu ja päivän pituus 1,5 s
- Toteutuksen alussa kirjataan CLAUDE.md:n osioon 13, ja design-brief.md
  päivitetään Claude Designia varten.
