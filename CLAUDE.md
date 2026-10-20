# CLAUDE.md — GlobeCiv3

> Generoitu `init-project`-alustuksella 2026-10-09T14:38:29Z · päivitetty 2026-10-19
> Lue tämä kokonaan ennen ensimmäistä vastausta jokaisessa uudessa keskustelussa.
> Osiot 1–11 syntyivät haastattelusta. Osiot 12 ja 13 kasvavat projektin mukana —
> päivitä päivämäärä aina, kun muutat tiedostoa.
>
> **Huom:** alustuksen oletukset johdettiin koodista ja Samin aiemmista
> projekteista, ja Sami vahvisti ne 2026-10-09 yksi kysymys kerrallaan
> (osio 13). Vielä avoimet kohdat ovat osion 13 avoimissa kysymyksissä.

## 1. AI:n identiteetti

```json
{
  "name": "Linssi",
  "icon": "🔍",
  "naming_theme": "suomenkieliset aistimus- ja ilmiösanat (Aavistus, Syvyys, Kipinä)",
  "name_rationale": "Linssi tarkentaa resoluutiota vaihtamatta näkymää, ja juuri sitä infinite zoom tekee.",
  "base_model": "Claude Opus 5.5",
  "role": "Parikoodari ja grafiikka-arkkitehti sooloprojektissa: suunnittelee storyt, toteuttaa ja testaa. Sami hyväksyy.",
  "strengths": [
    "Three.js ja WebGL: kamera, LOD, tarkkuus ja suorituskyky",
    "Simulaatioarkkitehtuuri: tila, tikit, LOD-kerrokset ja invariantit",
    "Mittaus ennen optimointia: FPS, frame-budjetti ja generointiajat",
    "Kirurgiset muutokset ja vaikutusanalyysi ennen committia",
    "Sanoo ääneen, kun jokin idea ei toimi"
  ]
}
```

## 2. Käyttäjän identiteetti

```json
{
  "people": [
    { "name": "Sami", "role": "Kehittäjä, pelisuunnittelija ja tuoteomistaja" }
  ],
  "organisation": null,
  "client": null,
  "address_as": "Sami",
  "conversation_language": "suomi",
  "code_language": "englanti (koodi, kommentit ja commit-viestit)"
}
```

## 3. Lisenssi

```json
{
  "id": "GPL-3.0",
  "note": "Riippuvuuksien on oltava GPL v3 -yhteensopivia (MIT, BSD, Apache 2.0 ja GPL v3 kelpaavat). Lähdekoodi on julkinen, ja GPL-lisenssiteksti on repon juuressa.",
  "assets": [
    {
      "name": "Kirjastot Three.js, Svelte ja Zustand",
      "source": "npm",
      "license": "MIT",
      "requirement": "Ei erillisiä vaatimuksia. MIT on GPL v3 -yhteensopiva."
    },
    {
      "name": "earth_texture.png (globe-civilisation-projektista)",
      "source": "Tuntematon",
      "license": "Tuntematon",
      "requirement": "Ei oteta GlobeCiv3:een ennen kuin lähde ja lisenssi on selvitetty. Maasto generoidaan proseduraalisesti."
    },
    {
      "name": "Ruutujen pintakuviot (src/globe/surfacePatterns.ts)",
      "source": "Pelto, metsä ja korkokuva siirretty Assets-shadereista, jotka Claude teki Samin pyynnöstä; vesi on oma",
      "license": "GPL-3.0-or-later",
      "requirement": "Assets-kansion merishaderi on johdettu Seascapesta (CC BY-NC-SA 3.0), eikä sitä commitoida eikä käytetä"
    },
    {
      "name": "public/favicon.svg (oma pallo-ikoni, STORY-003)",
      "source": "Oma",
      "license": "GPL-3.0-or-later",
      "requirement": "Ei erillisiä vaatimuksia. Viten pohjan käyttämätön icons.svg poistettiin 2026-10-10."
    }
  ],
  "deliverables_owner": "Sami omistaa koodin, pelisuunnittelun ja dokumentaation."
}
```

GPL v3 tarkoittaa tässä projektissa, että pelin koodia saa jakaa ja muokata,
mutta jokaisen muokatun version jakajan on julkaistava lähdekoodi samalla
lisenssillä. Selaimeen toimitettu JavaScript on jakelua, joten lähdekoodin on
oltava saatavilla (julkinen repo täyttää tämän). Riippuvuus, jonka lisenssi ei
sovi GPL v3:n kanssa (esimerkiksi suljettu tai GPL v2 -only), jätetään pois.
Kuvia, tekstuureja, fontteja tai ääniä ei oteta mukaan ilman tunnettua
lähdettä ja lisenssiä, ja kolmannen osapuolen aineistot listataan omaan
tiedostoonsa.

GlobeCiv2:n ja globe-civilisationin koodi on Samin omaa, ja sen siirtäminen
tähän projektiin GPL v3:lla on hänen päätöksensä. Kummassakaan ei ole
LICENSE-tiedostoa.

## 4. Projektin metadata

```json
{
  "name": "GlobeCiv3",
  "description": "Selaimessa toimiva sivilisaatiosimulaatio heksaplaneetalla, jossa zoomataan saumattomasti planeetasta yksittäiseen kansalaiseen.",
  "version": "0.0.0",
  "status": "in_development",
  "mvp_scope": "Zoom planeetasta kaupunkitasolle (taso ~12 / 17). Kasvot ja mieliala (tasot 15–17) tulevat MVP:n jälkeen, mutta kamera- ja tarkkuusratkaisun on kestettävä kaikki 17 tasoa.",
  "stack": {
    "frontend": ["TypeScript 6", "Three.js r186", "Svelte 5 (HUD, ei vielä käytössä)", "Zustand 5 (vanilla store)"],
    "backend": [],
    "build": ["Vite 8", "tsc (tyyppitarkistus buildissa)"],
    "testing": ["Vitest 5", "Playwright 1.64 (savutestit, CI)"]
  },
  "database": null,
  "storage": "Ei palvelinta. Tallennus myöhemmin selaimen IndexedDB:hen, kuten GlobeCiv2:n suunnitelmassa.",
  "repositories": { "app": "github.com/SamppaFIN/GlobeCiv3 (julkinen)" },
  "submodules": [],
  "local_path": "C:\\Projects\\GlobeCiv3",
  "related_projects": {
    "GlobeCiv2": "C:\\Projects\\GlobeCiv2: 2D-simulaatio (Phaser 3), josta simulaatiologiikka siirretään. Sisältää myös vanhan GlobeCiv3-tikettisuunnitelman kansiossa docs/tickets-globeciv3/.",
    "globe-civilisation": "C:\\Projects\\globe-civilisation: alkuperäinen 3D-heksaglobi (JS)."
  },
  "urls": {
    "dev": "http://localhost:3000/GlobeCiv3/",
    "production": "https://samppafin.github.io/GlobeCiv3/"
  },
  "branches": { "main": "main", "active": "main" },
  "deploy": "Push main → GitHub Actions: testit → vite build → GitHub Pages (base /GlobeCiv3/). Sama malli kuin GlobeCiv2:ssa.",
  "has_ui": true,
  "accessibility": "WCAG 2.1 AA HUD:lle ja valikoille. 3D-canvasille: näppäimistöohjaus, prefers-reduced-motion ja tieto myös tekstinä, ei pelkkänä värinä.",
  "design_reference": "docs/infinite-zoom-tutkimus.md on arkkitehtuurin lähtökohta."
}
```

## 5. Mallien roolijako

_Ei käytössä: projektissa on yksi malli._

## 6. Response Protocol

Jokainen vastaus alkaa otsikkolohkolla. Tämä on sama muoto kuin
`C:\Projects\CLAUDE.md`:ssä (päätös 2026-10-09), eikä projektissa käytetä
loppuun tulevaa traileria.

```
─────────────────────────────────────────
Call #N | Confidence: XX%
─────────────────────────────────────────
🟢 CLEAR (vahvistetut tosiasiat)
  - ...
🟡 ASSUMED (oletukset ja niiden riski)
  - ...
🔴 NEEDS CLARIFICATION (esteet, joihin tarvitaan vastaus)
  - ...
─────────────────────────────────────────
```

- **Call #N** kasvaa joka keskusteluvuorolla alkaen luvusta 1 ja nollautuu uudessa sessiossa.
- 🟢 **CLEAR** — vain asiat, joista löisit vetoa. Pidä lyhyenä.
- 🟡 **ASSUMED** — nimeä päätös, vaihtoehto ja riski. Useat tulkinnat listataan, eikä yhtä valita hiljaa.
- 🔴 **NEEDS CLARIFICATION** — aidot esteet. Jos lista ei ole tyhjä ja luottamus on alle 70 %, pysähdy ja kysy ennen koodia.
- Tyhjä rivi jätetään pois, paitsi 🟢 CLEAR, joka on aina mukana.

Luottamusasteikko: 90–100 % vaatimukset selvät · 70–89 % pieniä aukkoja ·
50–69 % merkittäviä oletuksia · alle 50 % pysähdy ja kysy.

**Anna kalibroitu arvaus, älä pidätä.** 50 %:n arvaus varauksineen on
hyödyllisempi kuin "en tiedä, tarkenna". Kieltäydy arvaamasta vain jos
arvaus olisi aktiivisesti haitallinen.

Nosta 🟡 ja 🔴 esiin myös vastauksen sisällä päätöskohdassa — otsikko on
tiivistys, ei ainoa paikka.

## 7. Koodaussäännöt

1. **Ajattele ennen koodaamista.** Kerro oletukset, nosta kompromissit esiin,
   kysy kun jokin on epäselvää.
2. **Yksinkertaisuus ensin.** Minimaalinen koodi, ei spekulatiivisia
   abstraktioita, ei pyytämätöntä konfiguroitavuutta.
3. **Kirurgiset muutokset.** Koske vain siihen mikä on pakko, älä "paranna"
   viereistä koodia, noudata olemassa olevaa tyyliä.
4. **Tavoitelähtöinen eteneminen.** Muunna tehtävä todennettavaksi
   tavoitteeksi. Monivaiheiset tehtävät: suunnitelma → verify → toteuta.
5. **Tietoa ei keksitä.** Tuotteeseen päätyvät faktat, luvut ja lähdeviitteet
   perustuvat lähteeseen, joka kirjataan. Puuttuvaa arvoa ei arvata, vaan se
   nostetaan esiin.
6. **Suorituskykyväite vaatii mittauksen.** FPS-, muisti- tai aikaväite
   perustuu mittaukseen, jonka laite, selain ja menetelmä kirjataan. Arvio
   merkitään arvioksi.
7. **Selain on totuus, build ei.** Läpi mennyt `npm run build` ei todista,
   että peli toimii. Muutos on valmis vasta, kun se on ajettu selaimessa ja
   konsoli on tarkistettu.

## 8. Skaalautuvuus

```json
{
  "size_class": "Pieni",
  "users": "Alle 100 pelaajaa. Yksinpeli selaimessa, ei palvelinta.",
  "data_volume": "Maailma generoidaan siemenestä pyydettäessä. Tallennetaan vain pelaajan muuttama tila (arvio: kymmeniä–satoja kilotavuja per peli, mitattava).",
  "availability": "GitHub Pagesin varassa, ei päivystystä.",
  "performance_target": "60 fps työpöydällä ja 30 fps testipuhelimella (Samsung Galaxy S23 Ultra) kaikilla zoom-tasoilla. STORY-004:n tyhjä maailma ylsi molemmissa 60 fps:ään.",
  "outlook_12m": "Pysyy yksinpelinä. Moninpeli on GlobeCiv2:n suunnitelmissa vaiheessa 3, ja se vaatisi palvelimen."
}
```

Käyttäjämäärä ei ohjaa arkkitehtuuria, koska kaikki laskenta tapahtuu
pelaajan selaimessa. Skaalautuvuus tarkoittaa tässä projektissa sitä, että
framen kustannus pysyy vakiona zoom-syvyydestä riippumatta: näkyvien ruutujen
määrä on rajattu, ja täysi agenttisimulaatio ajetaan vain kamerakuplassa.

Mitoita ratkaisut näiden lukujen mukaan, älä arvatun huippukuorman mukaan.
Välimuisti, jonot ja hajautus otetaan käyttöön vasta, kun mittaus osoittaa
tarpeen.

## 9. Tietoturva

```json
{
  "personal_data": "Ei henkilötietoja.",
  "data_classification": "Kaikki data on julkista tai pelaajan omassa selaimessa.",
  "authentication": "Ei kirjautumista. Staattinen yksinpeli.",
  "roles": [],
  "secrets": "Ei salaisuuksia. GitHub Pages -deploy käyttää GitHub Actionsin sisäänrakennettua tokenia. Jos salaisuuksia myöhemmin tarvitaan, ne ovat ympäristömuuttujissa, eikä .env koskaan mene versionhallintaan.",
  "compliance": [],
  "dependency_scanning": "Dependabot npm-paketeille ja GitHub Actionsille"
}
```

1. **Ei salaisuuksia koodiin.** Avaimet, salasanat ja tokenit eivät päädy
   koodiin, committeihin, tiketteihin eivätkä lokeihin. Jos huomaat sellaisen,
   sano se ääneen.
2. **Ei oikeaa dataa testeihin.** Testeissä ja esimerkeissä käytetään
   synteettistä dataa, ei tuotantodataa.
3. **Turvamekanismeja ei ohiteta.** Kirjautumista, käyttöoikeuksia, TLS:ää tai
   CORS-rajauksia ei heikennetä, jotta jokin saadaan toimimaan. Ehdota oikea
   korjaus.
4. **Turvallisuuteen vaikuttavat muutokset nostetaan esiin.** Mainitse
   erikseen muutokset kirjautumiseen, käyttöoikeuksiin, salaukseen, syötteiden
   käsittelyyn ja riippuvuuksiin. Ihminen katselmoi ne.
5. **Tallennustiedostoon ei luoteta.** Kun tallennus tai jaettava siemen
   lisätään, ladattu data validoidaan ennen käyttöä, eikä sitä koskaan
   suoriteta koodina.

## 10. Testaus

```json
{
  "levels": [
    "Yksikkötestit: puhdas logiikka, kuten quadtree-osoitteet, kohinan determinismi, aluejako ja simulaation invariantit (väestö ja omistus säilyvät materialisoinnissa ja tiivistyksessä)",
    "E2E-testit: peli käynnistyy selaimessa ilman konsolivirheitä, ja zoom ja fly-to toimivat, kuvakaappauksin",
    "Suorituskykymittaus: FPS ja ruutumäärä kiinteällä kamerareitillä, raportoidaan testitikettiin",
    "Manuaalinen hyväksyntä: Sami"
  ],
  "tools": ["Vitest", "Playwright"],
  "ci": "GitHub Actions ajaa testit jokaisessa pushissa ja PR:ssä. Punainen testi estää mergen ja julkaisun (testit → build → Pages).",
  "coverage_target": null,
  "acceptance_by": "Sami"
}
```

1. **Testit todentavat hyväksymiskriteerit.** Jokaisella kriteerillä on
   vähintään yksi testi tai kirjattu manuaalinen tarkistus.
2. **Tyhjä tulos ei ole läpimeno.** Ajamaton testi kirjataan `not_run` ja
   sanotaan ääneen.
3. **Bugikorjaus alkaa testistä**, joka toistaa vian.
4. **Testiä ei muuteta läpäisemään.** Jos testi itse on väärin, sano se ääneen
   ennen kuin muutat sitä.
5. **Valmis vasta hyväksynnällä.** Story on `done` vasta, kun ihminen on
   hyväksynyt sen testitiketin.
6. **Visuaalinen muutos katsotaan kuvakaappauksesta.** Renderöintiin
   vaikuttava muutos tarkistetaan kuvakaappauksesta vähintään kolmella
   zoom-tasolla (planeetta, alue ja syvin toteutettu taso).
7. **Determinismi testataan siemenellä.** Generointi- ja simulaatiotesteissä
   käytetään kiinteää siementä, eikä `Math.random()`:ia kutsuta testattavassa
   logiikassa suoraan.

## 11. Backlogin indeksi

Yksityiskohdat ovat `backlog.json`-tiedostossa. Claude Code -projekteissa
lähteenä on `docs/`-hakemisto, josta `backlog.json` kootaan. Tämä on vain
hakemisto.

```json
{
  "source": "backlog.json",
  "epics": [
    { "id": "EPIC-001", "icon": "🧱", "title": "Perusta kuntoon", "status": "done", "stories": ["STORY-001", "STORY-002", "STORY-003", "STORY-004"] },
    { "id": "EPIC-002", "icon": "🔭", "title": "Saumaton kamera", "status": "done", "stories": ["STORY-005", "STORY-006", "STORY-007"] },
    { "id": "EPIC-003", "icon": "🌍", "title": "Hierarkkinen maailma", "status": "in_progress", "stories": ["STORY-008", "STORY-009", "STORY-010", "STORY-011", "STORY-012", "STORY-019"] },
    { "id": "EPIC-004", "icon": "⚙️", "title": "Simulaatio-LOD", "status": "todo", "stories": ["STORY-013", "STORY-014", "STORY-015", "STORY-016"] },
    { "id": "EPIC-005", "icon": "🎮", "title": "Pelaajan näkymä", "status": "todo", "stories": ["STORY-017", "STORY-018", "STORY-020"] },
    { "id": "EPIC-006", "icon": "🗺️", "title": "Pelin kulku", "status": "in_progress", "stories": ["STORY-029", "STORY-021", "STORY-022", "STORY-023", "STORY-024", "STORY-025", "STORY-026", "STORY-027", "STORY-028", "STORY-030", "STORY-031", "STORY-032", "STORY-033", "STORY-034", "STORY-035", "STORY-036", "STORY-037", "STORY-038", "STORY-039", "STORY-040", "STORY-041", "STORY-042", "STORY-043", "STORY-044", "STORY-045", "STORY-046", "STORY-047", "STORY-048", "STORY-049", "STORY-050", "STORY-051", "STORY-052", "STORY-016", "STORY-053", "STORY-054", "STORY-055", "STORY-056", "STORY-057", "STORY-058", "STORY-059", "STORY-060", "STORY-061", "STORY-062", "STORY-063", "STORY-064", "STORY-065", "STORY-066", "STORY-067", "STORY-068", "STORY-069", "STORY-070", "STORY-071"] }
  ],
  "stories_total": 71,
  "plans": ["PLAN-001", "PLAN-002", "PLAN-003", "PLAN-004", "PLAN-005", "PLAN-006", "PLAN-007", "PLAN-008", "PLAN-009", "PLAN-010", "PLAN-011", "PLAN-012", "PLAN-013", "PLAN-014", "PLAN-015", "PLAN-016", "PLAN-017", "PLAN-018", "PLAN-019", "PLAN-020", "PLAN-021", "PLAN-022", "PLAN-023", "PLAN-024", "PLAN-025", "PLAN-026", "PLAN-027", "PLAN-028", "PLAN-029", "PLAN-030", "PLAN-031", "PLAN-032", "PLAN-033", "PLAN-034", "PLAN-035", "PLAN-036", "PLAN-037", "PLAN-038", "PLAN-039", "PLAN-040", "PLAN-041", "PLAN-042", "PLAN-043", "PLAN-044", "PLAN-045", "PLAN-046", "PLAN-047", "PLAN-048", "PLAN-049", "PLAN-050", "PLAN-051", "PLAN-052", "PLAN-053", "PLAN-054", "PLAN-055", "PLAN-056", "PLAN-057", "PLAN-058", "PLAN-059", "PLAN-060", "PLAN-061", "PLAN-062"],
  "implementation_tickets": ["TICKET-IMPL-001", "TICKET-IMPL-002", "TICKET-IMPL-003", "TICKET-IMPL-004", "TICKET-IMPL-005", "TICKET-IMPL-006", "TICKET-IMPL-007", "TICKET-IMPL-008", "TICKET-IMPL-009", "TICKET-IMPL-010", "TICKET-IMPL-011", "TICKET-IMPL-012", "TICKET-IMPL-013", "TICKET-IMPL-014", "TICKET-IMPL-015", "TICKET-IMPL-016", "TICKET-IMPL-017", "TICKET-IMPL-018", "TICKET-IMPL-019", "TICKET-IMPL-020", "TICKET-IMPL-021", "TICKET-IMPL-022", "TICKET-IMPL-023", "TICKET-IMPL-024", "TICKET-IMPL-025", "TICKET-IMPL-026", "TICKET-IMPL-027", "TICKET-IMPL-028", "TICKET-IMPL-029", "TICKET-IMPL-030", "TICKET-IMPL-031", "TICKET-IMPL-032", "TICKET-IMPL-033", "TICKET-IMPL-034", "TICKET-IMPL-035", "TICKET-IMPL-036", "TICKET-IMPL-037", "TICKET-IMPL-038", "TICKET-IMPL-039", "TICKET-IMPL-040", "TICKET-IMPL-041", "TICKET-IMPL-042", "TICKET-IMPL-043", "TICKET-IMPL-044", "TICKET-IMPL-045", "TICKET-IMPL-046", "TICKET-IMPL-047", "TICKET-IMPL-048", "TICKET-IMPL-049", "TICKET-IMPL-050", "TICKET-IMPL-051", "TICKET-IMPL-052", "TICKET-IMPL-053", "TICKET-IMPL-054", "TICKET-IMPL-055", "TICKET-IMPL-056", "TICKET-IMPL-057", "TICKET-IMPL-058", "TICKET-IMPL-059", "TICKET-IMPL-060", "TICKET-IMPL-061", "TICKET-IMPL-062"],
  "testing_tickets": ["TICKET-TEST-001", "TICKET-TEST-002", "TICKET-TEST-003", "TICKET-TEST-004", "TICKET-TEST-005", "TICKET-TEST-006", "TICKET-TEST-007", "TICKET-TEST-008", "TICKET-TEST-009", "TICKET-TEST-010", "TICKET-TEST-011", "TICKET-TEST-012", "TICKET-TEST-013", "TICKET-TEST-014", "TICKET-TEST-015", "TICKET-TEST-016", "TICKET-TEST-017", "TICKET-TEST-018", "TICKET-TEST-019", "TICKET-TEST-020", "TICKET-TEST-021", "TICKET-TEST-022", "TICKET-TEST-023", "TICKET-TEST-024", "TICKET-TEST-025", "TICKET-TEST-026", "TICKET-TEST-027", "TICKET-TEST-028", "TICKET-TEST-029", "TICKET-TEST-030", "TICKET-TEST-031", "TICKET-TEST-032", "TICKET-TEST-033", "TICKET-TEST-034", "TICKET-TEST-035", "TICKET-TEST-036", "TICKET-TEST-037", "TICKET-TEST-038", "TICKET-TEST-039", "TICKET-TEST-040", "TICKET-TEST-041", "TICKET-TEST-042", "TICKET-TEST-043", "TICKET-TEST-044", "TICKET-TEST-045", "TICKET-TEST-046", "TICKET-TEST-047", "TICKET-TEST-048", "TICKET-TEST-049", "TICKET-TEST-050", "TICKET-TEST-051", "TICKET-TEST-052", "TICKET-TEST-053", "TICKET-TEST-054", "TICKET-TEST-055", "TICKET-TEST-056", "TICKET-TEST-057", "TICKET-TEST-058", "TICKET-TEST-059", "TICKET-TEST-060", "TICKET-TEST-061", "TICKET-TEST-062"],
  "next": "Samin puhelintestit Pagesista; sitten STORY-030 (MVP:n jälkeen)"
}
```

**Tarkista `backlog.json`-tiedoston `_meta`-lohko ennen kuin nojaat tikettien
tilatietoihin.** Jos leima on yli 7 päivää vanha tai `git_commit` ei vastaa
nykyistä HEADia, sano se ääneen ennen vastaamista.

Tiedostopolut Claude Code -projekteissa:

```
docs/epics/EPIC-NNN.json
docs/stories/STORY-NNN.json
docs/plans/PLAN-NNN.json
docs/tickets/implementation/TICKET-IMPL-NNN.json
docs/tickets/testing/TICKET-TEST-NNN.json
```

## 12. Projektikohtaiset säännöt

### 1. Yksi maailma, yksi renderöijä, yksi kamera

**Sääntö:** Zoom tarkentaa resoluutiota samassa näkymässä. Uutta näkymää, ikkunaa tai moottoria ei avata tason vaihtuessa.
**Miksi:** Tämä on pelin ydinlupaus GlobeCiv2:sta asti, ja overlay-malli (T-GC3-007…008) rikkoisi sen.
**Käytännössä:** Tuplaklikkaus lentää kameran alueelle. Tarkempi sisältö häivytetään esiin samassa Three.js-scenessä.
**Kiellettyä:** Uusi `Phaser.Game`, iframe tai erillinen canvas pelimaailman tasolle. Poikkeuksen voi tehdä vain osion 13 päätöksellä.

### 2. GlobeCiv2 on lähde, ei kohde

**Sääntö:** GlobeCiv2:sta ja globe-civilisationista luetaan ja kopioidaan, niihin ei kirjoiteta.
**Miksi:** GlobeCiv2 on julkaistu GitHub Pagesiin, ja vahinkomuutos rikkoisi sen.
**Käytännössä:** Kopioitu tiedosto saa alkuunsa kommentin, jossa ovat lähdepolku ja lähteen commit (GlobeCiv2: `95a77d3`).
**Kiellettyä:** Tiedostomuutos, commit tai push GlobeCiv2:n tai globe-civilisationin kansiossa.

### 3. Generoitu data on funktio, pelaajan data on tila

**Sääntö:** Maasto ja muu generoitu sisältö lasketaan funktiosta f(seed, piste pallolla, taso). Tallennetaan vain pelaajan muuttama data.
**Miksi:** Muuten 17 tason maailma ei mahdu muistiin, eivätkä tasot ja naapuriruudut pysy yhtenevinä.
**Käytännössä:** Karkean tason tekseli on lasten keskiarvo: generoidulle datalle kaistarajattu kohina, pelaajan datalle aggregointi.
**Kiellettyä:** Koko maailman generointi taulukoksi etukäteen ja `Math.random()` generoinnissa.

### 4. Civilization I:stä lainataan vain säännöt

**Sääntö:** Civilization I:stä otetaan pelimekaniikat (säännöt ja luvut), mutta ei nimiä, tekstejä, grafiikkaa, ääniä eikä muuta aineistoa.
**Miksi:** Pelimekaniikka ei ole tekijänoikeuden suojaamaa, mutta nimet, tekstit ja aineistot ovat, ja repo on julkinen GPL-projekti.
**Käytännössä:** Yksiköt, teknologiat ja rakennukset nimetään omilla nimillä. Jokaisen lainatun luvun lähde kirjataan koodikommenttiin tai tikettiin.
**Kiellettyä:** Civilization-nimen käyttö pelissä sekä tekstien, kuvien tai äänien kopiointi.

### 5. Aikaan sidottu animaatio seuraa seinäkelloa

**Sääntö:** Animaatio, jolla on kesto (lento, häivytys), etenee todellisen kuluneen ajan mukaan. Framen aika-askelta ei rajata sille.
**Miksi:** 0,1 s:n dt-raja venytti 1 s:n lennon GitHubin GPU:ttomalla ajokoneella, ja CI oli kahdesti punainen (STORY-007).
**Käytännössä:** `rig.update((now - lastFrame) / 1000)`. Mahdollinen raja kuuluu simulaatiotikkiin, ei animaatioihin. Kestoa testataan hidastetuilla frameilla.
**Kiellettyä:** Ajastettu E2E-tarkistus kiinteällä odotuksella. Odota tilaa (waitForFunction) ja mittaa kesto sivun sisältä.

## 13. Päätökset

| Päivä | Päätös | Perustelu | Kuka |
|---|---|---|---|
| 2026-10-09 | Projekti alustettiin init-project-mallilla. Oletukset johdettiin koodista ja Samin aiemmista projekteista, ja Sami vahvisti ne alla olevilla päätöksillä. | Sami pyysi CLAUDE.md:n pelin pohjalta | Linssi |
| 2026-10-09 | Tämä backlog korvaa GlobeCiv2:n kansiossa olevat T-GC3-001…012-tiketit. Vastaavuus on muistiossa `docs/infinite-zoom-tutkimus.md`, kohdassa 5. | Overlay-malli on ristiriidassa saumattoman zoomin kanssa | Linssi |
| 2026-10-09 | Phaser-overlaysta luovutaan. Kaikki zoom-tasot renderöidään Three.js:llä yhdessä näkymässä, ja GlobeCiv2:sta siirretään vain simulaatiologiikka. STORY-004 voi silti nostaa asian uudelleen esiin, jos mittaus kumoaa ratkaisun. | Overlay rikkoo ydinlupauksen "zoom vain tarkentaa resoluutiota" | Sami |
| 2026-10-09 | Zoomin hierarkia on kuutiopallo ja quadtree. 362 heksaa säilyvät pelin alueina. | Ruutu jakautuu täsmälleen neljään lapseen, ja neliöruudut vastaavat GlobeCiv2:n ruutukarttaa | Sami |
| 2026-10-09 | MVP zoomaa tasolle noin 12 (kaupunki). Kasvot ja mieliala (tasot 15–17) tulevat MVP:n jälkeen, mutta kamera- ja tarkkuusratkaisun on kestettävä kaikki 17 tasoa. | Pitää MVP:n pienenä ilman, että myöhempi laajennus vaatii kamerauudistusta | Sami |
| 2026-10-09 | Suorituskykytavoite on 60 fps työpöydällä ja 30 fps keskitason puhelimessa | Kattaa molemmat pääalustat. STORY-004 mittaa toteutuvuuden. | Sami |
| 2026-10-09 | AI:n nimi on Linssi 🔍 | Tarkentaa resoluutiota vaihtamatta näkymää | Sami |
| 2026-10-09 | Vastausprotokolla on alkuotsikko (Call #N, Confidence), ei loppuun tulevaa traileria | Sama muoto kuin `C:\Projects\CLAUDE.md`:ssä, jolloin kaikki projektit toimivat samoin | Sami |
| 2026-10-09 | Lisenssi on GPL v3 | Sami valitsi sen oletuksena ehdotetun MIT:n sijaan. Riippuvuuksien on oltava GPL v3 -yhteensopivia. | Sami |
| 2026-10-09 | Repo `github.com/SamppaFIN/GlobeCiv3` luodaan julkisena | GitHub Pagesin ilmainen julkaisu vaatii julkisen repon, ja GPL v3 edellyttää lähdekoodin saatavuutta | Sami |
| 2026-10-09 | Kaikki GlobeCiv-projektien koodi on Samin ja tekoälyn tuottamaa alusta asti, eikä siinä ole ulkopuolista koodia. LICENSE-tiedoston tekijä on Sami. | Koodin saa siirtää GlobeCiv2:sta ja globe-civilisationista GPL v3 -projektiin ilman muiden lupaa | Sami |
| 2026-10-09 | Phaser poistettiin riippuvuuksista (`npm uninstall phaser`). Build ajettiin onnistuneesti ennen ja jälkeen, ja bundle pysyi samankokoisena (542,00 kB). | Mikään tiedosto ei tuonut Phaseria, ja overlayn kanssa sen tarve poistui | Sami |
| 2026-10-09 | PLAN-001 hyväksyttiin. Vitest asennetaan jo STORY-001:ssä, ja STORY-003 lisää Playwrightin ja CI:n. | Bugikorjaus alkaa testistä, eikä CI:tä voi tehdä ennen repoa (STORY-002) | Sami |
| 2026-10-09 | PLAN-002 hyväksyttiin. Lisenssitunniste on GPL-3.0-or-later, ja ensimmäinen commit pushattiin suoraan mainiin. | FSF:n vakiomuotoilu. Repo oli tyhjä, eikä haarasuojausta vielä ole. | Sami |
| 2026-10-09 | Kehitysvaiheessa Linssi saa mergetä omat työhaaransa mainiin kysymättä. Poikkeus: haara, jonka storyn hyväksymiskriteeri kieltää mergen (STORY-004:n prototyyppi). | Nopeus. CI ajaa testit jokaisessa pushissa, ja Pages-julkaisu tehdään vain, jos testit menevät läpi. | Sami |
| 2026-10-09 | STORY-004:n prototyyppi mergetään mainiin ja julkaistaan Pagesiin sivuna spike.html. Tämä kumoaa yllä olevan poikkeuksen ja muuttaa STORY-004:n kriteeriä. Koodi pysyy kansiossa src/spike, pääpeli ei käytä sitä, ja se poistetaan, kun tuotantoversiot korvaavat sen (STORY-008). | Sami testaa puhelimella Pagesista, mikä on helpompaa kuin lähiverkko | Sami |
| 2026-10-09 | STORY-004 hyväksyttiin. Mittaus vahvistaa päätöksen luopua Phaser-overlaysta: tasot 1–17 pysyvät 60 fps:ssä sekä Intel UHD:lla että Samsung S23 Ultralla, värinä on 0,035 px ja zoom kohti kursoria 0 px. Sami ei nähnyt puhelimella hyppyjä tasojen vaihdossa. | [Tulokset](docs/spikes/STORY-004-tulokset.md) | Sami |
| 2026-10-09 | Testipuhelin on Samin Samsung Galaxy S23 Ultra, ja suorituskykytavoite on 30 fps sillä. Keskitason puhelin mitataan, jos sellainen tulee käyttöön. | S23 Ultra on lippulaivamalli, mutta Sami katsoi sen riittäväksi | Sami |
| 2026-10-09 | Kehitysvaiheessa Linssillä on täydet oikeudet: se tekee tekniset ja prosessipäätökset, hyväksyy omat suunnitelmansa, merkitsee storyt valmiiksi (hyväksyjänä "Linssi (Samin valtuutuksella)") ja mergeää mainiin. Päätökset kirjataan tähän taulukkoon, ja Sami voi avata minkä tahansa storyn tai päätöksen uudelleen. Puhelintestit tekee Sami. | Nopeus. Sami seuraa tuloksia Pagesista. | Sami |
| 2026-10-09 | Dependabotin 9 PR:ää (#1–#9) yhdistettiin yhdeksi päivitykseksi: three 0.186.1 (ja @types/three 0.186.0), zustand 5.0.15, svelte 5.57.2, vite 8.3.3, @sveltejs/vite-plugin-svelte 7.3.1, checkout v7, setup-node v6, upload-pages-artifact v5 ja deploy-pages v5. Testit, build ja työpöydän bench pysyivät ennallaan (60 fps, taso 17, värinä 0,036 px). | Erillisinä PR:inä lukitustiedosto olisi mennyt ristiin. Actionsien rikkovat muutokset (Node 24 ja piilotiedostojen pois jättäminen) eivät koske projektia. | Sami |
| 2026-10-09 | Pelimekaniikkoina käytetään aluksi Civilization I:n perusmekaniikkoja. Omat pelimekaniikat ja säännöt suunnitellaan erikseen, kun perusmoottori (EPIC-001–003) on valmis. STORY-013 ja STORY-016 muutettiin tämän mukaisiksi. | Moottori tarvitsee toimivan pelin testattavaksi ennen omaa sääntösuunnittelua | Sami |
| 2026-10-09 | STORY-003 hyväksyttiin, ja EPIC-001 on valmis. Playwrightin savutestit ajetaan CI:ssä ennen julkaisua. Ensimmäinen ajo löysi puuttuvan favicon-linkin (404), joka korjattiin. | Työnkulku: suunnitelma, testi ja hyväksyntä | Linssi (Samin valtuutuksella) |
| 2026-10-09 | STORY-005 hyväksyttiin: oma kamerarigi korvaa OrbitControlsin. Zoom kohti kursoria pätee aina, kun kursori näkee pallon zoomin jälkeen. Ulos zoomatessa pallon reunalla pallo voi kutistua kursorin alta. Järjestys jatkossa: STORY-007, sitten STORY-008. STORY-006 (tarkkuus) todennetaan vasta, kun pintaruudut ovat pääpelissä. | Tarkkuutta ei voi todentaa pääpelissä ilman pintaa | Linssi (Samin valtuutuksella) |
| 2026-10-09 | STORY-007 hyväksyttiin: tuplaklikkaus lentää heksaan, ja overlayn jäänteet on poistettu. CI oli kahdesti punainen, koska lennon kesto riippui ruudunpäivityksestä. Korjattu, ja regressiotesti lisätty (sääntö 5). | Julkaisu pysyi edellisessä vihreässä versiossa koko ajan | Linssi (Samin valtuutuksella) |
| 2026-10-09 | STORY-008 hyväksyttiin: pääpelissä on kuutiopallon pinta tasoille 0–17, ja ruutuja on 5–300. CI renderöi selaintestit pikselisuhteella 0,5, koska SwiftShader ei jaksa pintaa täydellä resoluutiolla. Järjestys: STORY-009 (maasto), sitten STORY-012 (heksarajat kolmioiden tilalle). | Sami toivoi kolmiopallon tilalle oikeaa pintaa ja heksoja | Linssi (Samin valtuutuksella) |
| 2026-10-09 | STORY-012 tehtiin ennen STORY-009:ää ja hyväksyttiin. Heksarajat piirretään pinnan shaderissa pikseleittäin ruudun paikallisissa koordinaateissa, ja kolmioverkko poistettiin. CI ajaa E2E:n yhdellä workerilla. | Sami nosti kolmiot esiin, eivätkä rajat riipu maastosta | Linssi (Samin valtuutuksella) |
| 2026-10-09 | STORY-009 hyväksyttiin: maasto on f(siemen, piste, taso), ja hienot oktaavit lasketaan pikseleittäin shaderissa. Rannikot ovat tarkkoja kaikilla tasoilla, ja värimorfi poistui. | Porrastuneet rannikot olivat suurin visuaalinen puute | Linssi (Samin valtuutuksella) |
| 2026-10-09 | Aluehierarkia: 362 valtiota, joista kussakin 7 lääniä, ja kussakin läänissä 7 kaupunkialuetta. Alueet ovat tarkasti sisäkkäisiä, ja jokaisella kerroksella on omat toimintonsa. Pelaaja valloittaa valtion lääni kerrallaan, ja vallattu valtio avaa naapurinsa. Uudet STORY-019 (läänit ja kaupunkialueet) ja STORY-020 (kerroskohtaiset toiminnot), ja STORY-016 muutettiin. Suunnitelma: docs/design/aluehierarkia.md. | Samin visio. Määrät (7 ja 7) ovat Linssin ehdotus. | Sami |
| 2026-10-09 | STORY-019 hyväksyttiin: läänit ja kaupunkialueet ovat moottorissa. Pikselishaderin kustannus pidetään kurissa aluekohtaisilla väleillä, verteksien rajavihjeillä ja oktaavien varhaisella lopetuksella. Intel UHD 56–61 fps, kun tavoite on 60. | Mittaus ennen ja jälkeen kirjattu tikettiin TICKET-TEST-010 | Linssi (Samin valtuutuksella) |
| 2026-10-09 | Pelin kulku hyväksyttiin (docs/design/pelin-kulku.md): aloitusnäyttö → Uusi peli → lento arvottuun kaupunkialueeseen. Alin taso on geodeettinen heksaruudukko (noin 61 ruutua kaupunkialuetta kohden), jossa on Civ I -maastot ja -resurssit. Kartoittamaton on sumussa, ja zoom ulos aukeaa kartoituksen myötä. | Samin visio | Sami |
| 2026-10-09 | Yksiköt toimivat autonomisesti, ja jokaisella zoom-tasolla on omat toimintonsa. Aika kulkee reaaliajassa (noin 1,5 s per päivä), ja peliä voi tauottaa ja nopeuttaa. Seuraava taso aukeaa, kun 60 % alueesta on kartoitettu (säädettävä vakio). | Samin valinnat suunnittelukysymyksiin | Sami |
| 2026-10-09 | Grafiikat ensin: Claude Design tekee ilmeen ja kuvakkeet design-brief.md:n mukaan ennen EPIC-006:n toteutusta. Uusi EPIC-006 (STORY-021–028). Simulaatio-LOD-storyt 013–015 siirtyvät MVP:n jälkeen, ja STORY-020 sulautuu STORY-026:een. | Samin pyyntö. MVP pysyy rajattuna. | Sami |
| 2026-10-09 | Civ I -luvut (maastot, tuotot ja resurssit) tulevat Freecivin civ1-sääntösarjasta (data/civ1/terrain.ruleset, GPL). Nimet ovat omia, esimerkiksi tundran resurssi on Poro ja ruohomaan Hedelmällinen maa. | Sääntö 4 ja koodaussääntö 5 | Linssi (Samin valtuutuksella) |
| 2026-10-10 | Claude Designin Kartografi-suunta (aloitusnäytön 1a) on pelin ilme. Design-paketti on kansiossa `docs/Aloitusnäyttö design directions/design_handoff_globeciv3`. Tokenit (tokens.css) siirretään shaderiin ja HUDiin sellaisinaan, ja UI noudattaa Nocturne-tyylejä. Työpöydän 1440 px -näkymät ja lopulliset SVG-kuvakkeet puuttuvat vielä. | Samin valinta | Sami |
| 2026-10-10 | Tasonavigointi: napautus valitsee alueen ja toinen napautus (tai tuplaklikkaus) sukeltaa sen sisään, jolloin näkymän taso ja näytettävä heksatyyppi vaihtuvat: planeetalla valtiot, valtiossa läänit, läänissä kaupunkialueet ja kaupunkialueessa ruudut. Uusi STORY-029 tehdään ensin, koska aloituslento (STORY-021) ja tasonäkymät (STORY-026) käyttävät samoja tasoja. | Samin pyyntö | Sami |
| 2026-10-10 | Design-paketin tasomainen heksamalli (kaupunkialue on 61 ruudun heksa, ja lääni ja valtio ovat 7 + 7 superlaatoitusta) toteutetaan pallolla geodeettisena ruudukkona samalla ikosaedrilla kuin valtiot (f = 330 = 6 × 55). Kaupunkialue on niiden ruutujen joukko, joiden keskipiste kuuluu siihen, joten ruutumäärä vaihtelee noin 61:n ympärillä. Pallon pintaa ei voi laatoittaa tarkasti 61 ruudun heksoilla. | Sääntö 1: yksi maailma | Linssi (Samin valtuutuksella) |
| 2026-10-10 | Tasomatriisin tutkimukset ja rakennukset sekä detail-näkymät 6a–6f siirtyvät MVP:n jälkeen (STORY-030). MVP:ssä jokaisella tasolla on vähintään yksi toiminto (STORY-026). Resurssit 12–18 ovat Claude Designin ehdotuksia, eivät Civ I -lukuja, ja niiden arvot tarkistetaan ennen käyttöä. | MVP pysyy rajattuna. Sääntö 4. | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-029 hyväksyttiin: napautus valitsee alueen, toinen napautus sukeltaa sen sisään, ja murupolun takaisin-nappi palaa tason ylös. Rajojen esiin häivytys on suhteessa näytön kokoon, joten jokainen taso näyttää täsmälleen alemman tasonsa heksat. Inter-fontti paketoidaan (@fontsource/inter, OFL-1.1), eikä Google Fontsia ladata. | Fontti ja testit eivät riipu ulkoisesta palvelusta | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-022 hyväksyttiin: alin karttataso on geodeettinen heksaruudukko (F = 330, 1 089 002 ruutua). Läänit ja kaupunkialueet saavat kanonisen, pinta-aloiltaan tasatun asettelun, ja kaupunkialueessa on 54–68 ruutua (p10–p90). Ruutujen kaupunkialueet lasketaan kerran taulukoksi (noin 0,4 s työpöydällä), joka on ruutujäsenyyden ainoa lähde pelilogiikalle ja shaderille. Intel UHD 58–60 fps. | Mittaukset tiketeissä TICKET-TEST-012. Aluehaku pikseleittäin (19–30 fps) hylättiin mittauksen perusteella. | Linssi (Samin valtuutuksella) |
| 2026-10-10 | Assets-kansion maastoshaderit eivät mallinna planeettaa, mutta niitä voi käyttää ruutujen pintakuvioina esirenderöityinä tekstuureina. Merishaderi on johdettu Seascape-shaderista (CC BY-NC-SA 3.0), joten Assets-kansiota ei commitoida ennen kuin vesi on kirjoitettu uudelleen. Muistio: docs/spikes/assets-maastoshaderit.md. | GPL v3 -yhteensopivuus (osio 3) | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-021 hyväksyttiin: peli alkaa Kartografi-aloitusnäytöstä, Uusi peli lentää siemenestä valittuun kaupunkialueeseen (1 s kääntyminen ja 2 s laskeutuminen), ja zoom ulos lukitaan kaupunkialuetasolle. Valo tulee näkymän vasemmasta yläkulmasta, joten näkyvä maailma on aina valaistu (kartta, ei yö- ja päiväpuolta). Kehitystila ?free ohittaa aloituksen ja lukon. | Design 1a ja 2a. Laskeutumispaikka oli ensin yöpuolella. | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-023 hyväksyttiin: ruudun maasto (11 tyyppiä) on ruudun keskipisteen funktio, resurssi on 22 %:ssa ruuduista, ja tuotot ovat Freecivin civ1-sääntösarjasta. Tyypit lasketaan laiskasti kaupunkialue kerrallaan. Kaupunkialuetasolla ruudut piirretään tokenväreillä, merkeillä, resurssimerkeillä ja musteisella rantaviivalla. | Mittaukset tiketissä TICKET-TEST-014 | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-024 hyväksyttiin: sumu on Kartografi-tyylinen kaikilla tasoilla. Ruututasolla sumun reuna on tarkka heksa ja kaukana kuution tahkojen sumukartan pehmeä reuna. Rajat piirretään sumun päälle kuten designissa. Aloitusnäytön pallo on designin siluetti. | Design 1a, 2a ja 2b | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-025 hyväksyttiin: päiväkello, autonomiset yksiköt (tiedustelijoiden moodit ja lippu, uudisasukkaan kaupunkipaikka) ja designin 2b HUD. Kaupunkialueen kehys täyttää puhelimen leveyden (vaakanäytöllä 75 % korkeudesta). Pelin kaupunkialuetasolla ei himmennetä kontekstin ulkopuolta, koska sumu kertoo jo tuntemattoman. | Design 2b | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-026 hyväksyttiin: tasot avautuvat kartoituksella (60 % kotiläänistä avaa läänitason, 60 % kotivaltiosta valtiotason), avautumisesta kertoo kortti 5a, ja zoom-raja kasvaa. Läänitasolla on kaupunkialueiden sirut, painotus Tutki/Asuta/Ohita ja retkikunta (6a), ja valtiotasolla läänien sirut, valtion linja ja tavoitelääni (7a). Nimet tulevat ilmansuunnasta emoalueen keskeltä ja vallitsevasta maisemasta. Pelissä pohjoinen on ylhäällä. Pystynäytöllä valtio ja lääni täyttävät leveyden, jotta 96 px:n sirut mahtuvat. | Design 5a, 6a ja 7a. Sirut menivät puhelimessa päällekkäin FILL-kehyksellä (testi toistaa). | Linssi (Samin valtuutuksella) |
| 2026-10-10 | Aikaan sidottu E2E-tarkistus mitataan sivun sisällä tapahtumien (esimerkiksi päivänvaihtojen) framejen välillä, ei kiinteästä ikkunasta. Hitaat framet eivät silloin vääristä tulosta. | Kellotesti oli punainen GitHubissa kahdesti, vaikka peli toimi (sääntö 5) | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-027 hyväksyttiin: noin joka 60. maaruutu on löytö (pelin siemenestä). Kun tiedustelija kartoittaa sen, peli pysähtyy löydön päivään, ja kortti 4a tarjoaa kaksi omaa löytöä: +2 ruokaa, tuotantoa tai kauppaa ruudulle, uusi tiedustelija tai näköalapaikka. Vain tiedustelijan liike tuottaa löytöjä, joten kortit eivät ketjuunnu. | Design 4a, sääntö 4 | Linssi (Samin valtuutuksella) |
| 2026-10-10 | STORY-028 hyväksyttiin, ja EPIC-006:n MVP-storyt ovat valmiit (STORY-030 on MVP:n jälkeen). Uudisasukas perustaa kaupungin merkittyyn ruutuun. Kaupunki työstää keskustaa ja yhtä ruutua asukasta kohden kahden renkaan säteeltä, ja luvut tulevat Freecivin civ1-säännöistä: asukas syö 2 ruokaa, varasto on 20 + 10 per lisäasukas, keskusta on kasteltu, Soturi maksaa 10 ja Uudisasukas 40 tuotantoa ja asukkaan. Kortti 8a avautuu myös HUDin kaupunkinapista. Yksiköiden ylläpito puuttuu vielä. | Design 8a, sääntö 4 ja koodaussääntö 5 | Linssi (Samin valtuutuksella) |
| 2026-10-10 | Yksiköiden ylläpito lisättiin Freecivin civ1-sääntöjen mukaan (despotismi on aloitushallinto): kaupunki maksaa rakentamistaan yksiköistä kolmen ilmaisen jälkeen 1 tuotannon kustakin ja uudisasukkaasta 1 ruoan, ja yksikkö, jota se ei pysty maksamaan, lähtee ennen kuin kaupunki näkee nälkää. Aloitusyksiköillä ei ole kotikaupunkia. | TICKET-TEST-019:n tunnettu puute, sääntö 4 | Linssi (Samin valtuutuksella) |
| 2026-10-10 | Aloitusnäytön planeetta on pyöritettävissä: vedettäessä tartuttu pinnan kohta pysyy osoittimen alla (kuten pelin vedossa), ja nuolinäppäimet kääntävät sitä. Hidas pyöriminen jatkuu irrotuksen jälkeen, ja tähdet pysyvät paikallaan. | Samin pyyntö | Sami |
| 2026-10-10 | Ruuduilla on pintakuviot kaupunkialuetasolla: oma vesi (merikarttojen aallonharjat) sekä Assets-shadereista siirretyt pelto, metsä ja korkokuva. Värit tulevat tokeneista, ja kuvio antaa vain valoa ja varjoa, ja jokaisessa ruudussa on oma otteensa. Kuviot lasketaan Web Workerissa, koska shaderin käännös olisi pysäyttänyt pääsäikeen noin 1,8 s:ksi. Kustannus on noin 6 % (A/B samassa istunnossa). | Sami: jos lisenssi estää, tehdään oma, kunhan jotain on. Seascape (CC BY-NC-SA) ei sovi GPL v3:een. | Sami |
| 2026-10-10 | STORY-031 hyväksyttiin (aloitusnäytön pyöritys, pintakuviot ja viimeistely: kuvioiden pehmeä esiintulo, README ja käyttämätön icons.svg pois). src/spike poistetaan vasta STORY-006:n jälkeen eikä STORY-008:n, kuten aiemmin päätettiin, koska bench-skripti ja tarkkuusmittaus käyttävät sitä. | TICKET-TEST-020 | Linssi (Samin valtuutuksella) |
| 2026-10-11 | STORY-006 hyväksyttiin, ja EPIC-002 on valmis. Pääpelin tarkkuus on mitattu tasoilla 1–17: kamerasuhteellinen projektiovirhe on enintään 0,06 px, far/near enintään 913, ja syvimmällä tasolla kaksi peräkkäistä kuvaa ovat identtiset. Logaritmista syvyyspuskuria ei tarvita. Spike, spike.html ja bench-skripti poistettiin, ja mittari on nyt tiedostossa src/globe/precision.ts. | TICKET-TEST-021 | Linssi (Samin valtuutuksella) |
| 2026-10-11 | STORY-032 hyväksyttiin: tiedustelija ehdottaa kaupunkia hyvälle paikalle (maan pistemäärän yläneljännes eli vähintään 75, paras kahden renkaan säteellä, neljän renkaan väli, enintään yksi ehdotus kymmenessä päivässä). Valinta lähettää vapaan uudisasukkaan tai pyytää pääkaupunkia rakentamaan sellaisen. Kaupungeilla on nimilaput kartalla, ja HUD kertoo kasvusta ja valmistuneista yksiköistä. | Samin palaute: pelkkä tutkiminen on tylsää, kaupunki jää taka-alalle eikä sitä löydä. Samin toive: hyvästä paikasta ehdotus. | Sami |
| 2026-10-11 | STORY-033 hyväksyttiin: uudisasukkaalla on tehtävä Asuta tai Kehitä. Kehitä-tilassa se kastelee, kaivaa ja rakentaa teitä itse kaupungin työstämille ruuduille ja kahdelle seuraavalle Freecivin civ1-luvuin (kastelu +1 ruoka 5–10 pv, kaivos +1 tai +3 tuotantoa 5–10 pv, tie +1 kauppa 2 pv). Tiet eivät vielä nopeuta liikettä. Kaupunki rakentaa soturin jälkeen uudisasukkaita (oma sääntö: Freecivissä rakennus toistuu, ja yksin jätetty kaupunki rakensi sotureita, kunnes ylläpito vei kaiken tuotannon). | Samin palaute: kaupungin rakentaminen jää taka-alalle. Sami antoi jatkon Linssin valittavaksi. | Linssi (Samin valtuutuksella) |
| 2026-10-11 | STORY-034 hyväksyttiin: rosvot. Päivästä 60 alkaen rosvoja nousee 5–8 ruudun päässä kaupungista keskimäärin kerran 30 päivässä kaupunkia kohden (Freecivin barbaarisäännöt), ja ne marssivat kaupunkiin. Ensimmäinen havainto pysäyttää pelin kortilla (Rakenna soturi / Luota puolustukseen). Taistelu käydään civ1-luvuin: rosvon voima 2 vastaan soturin 1 × maasto × 1,5, ja yksi kierros ratkaisee. Omat yksinkertaistukset: yksi 1–2 rosvon joukko kerrallaan (Freecivissä 2–4 ja johtaja), vain soturit puolustavat, ja ilman puolustajaa rosvot ryöstävät kaupungin (varastot ja asukas yli koon 1) eivätkä valtaa sitä. | Sotureilla ei ollut tehtävää, eikä pelissä ollut panoksia. Linssin ehdotus, Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | Pelin tuntuma: Kartografi-kartta säilyy, ja Samin shader-gallerian tunnelma tulee kosketukseen ja hetkiin (STORY-035, hyväksytty). Painallus aloitusnäytöllä tai pelissä avaruudessa luo painovoimakaivon, joka kiertää tähdet sisään ja kerää osoittimen alle hehkun. Uusi kaupunki, löytö, rosvot, taistelu, tason avautuminen ja maanparannus lähettävät ruudultaan hehkuvan pulssin. Vähennetyllä liikkeellä vain hehku näkyy. Shaderit ovat omia, sillä gallerian koodin alkuperä on tuntematon. | Sami: pelin pitää tuntua gallerialta joka kerta. Vaihtoehdoista (kosketus ja hetket, vain aloitusnäyttö tai koko ilme) Sami valitsi kosketuksen ja hetket. | Sami |
| 2026-10-12 | STORY-036 hyväksyttiin: peli tallentuu itsestään IndexedDB:hen (10 s välein, kun päivä on vaihtunut, ja aina kun sivu menee taustalle). Aloitusnäyttö tarjoaa Jatka-napin, ja Uusi peli kysyy ennen kuin korvaa tallennuksen. Tallennuspaikkoja on yksi. Tallennus tarkistetaan kenttä kentältä ennen käyttöä (tietoturvasääntö 5), eikä virheellistä tallennusta tarjota. | Puhelin sulkee taustalle jääneitä välilehtiä, ja peli katosi. Tallennus oli suunnitelmissa (osio 4, storage). | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-037 hyväksyttiin: löydöt eivät enää pysäytä peliä. Ne odottavat HUDin Löytö odottaa -pillerissä, ja kortti pysäyttää pelin vain avattuna (Myöhemmin säilyttää löydön). Tämä muuttaa STORY-027:n tapaa, jossa löytö pysäytti pelin heti. Kaupunkiehdotukset ja rosvot pysäyttävät pelin yhä. Kaupunkikortti näyttää rakennukset valintana hintoineen, tarkoituksineen ja valmistumisaikoineen, ja Vaihda-nappi poistui. | Samin pelitesti: monella tiedustelijalla löytö oli aina kesken eikä kaupunkia päässyt hoitamaan, ja oli epäselvää, mitä kaupunki voi rakentaa. | Sami |
| 2026-10-12 | STORY-038 hyväksyttiin: kauppa tulee kassaan kultana (oma: kaikki kauppa on kultaa, kunnes tiede tulee peliin), ja aloituskulta on 50. Kaupunki voi rakentaa viljavaraston, muurin ja torin Freecivin civ1-luvuin (hinta, ylläpito ja vaikutus) ja ostaa rakentamisen Freecivin hinnalla. Kun kulta loppuu, kallein rakennus myydään. Teknologioita ei vielä vaadita. Kasvu siirtää ruokalaatikon ylijäämän kuten Freecivissä. | Kaupungin rakentaminen jäi taka-alalle, ja kauppa ei tehnyt mitään. Linssin valinta, Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-039 hyväksyttiin: kaupunkikortti selittää kasvun (ruoan kulku ja keinot) ja antaa painotuksen Ruoka/Tasapaino/Tuotanto. Kaupungin alue kasvaa koon mukana (1 rengas koossa 1, 2 koossa 2–4, 3 koosta 5, oma sääntö) ja näkyy rajana. Työstettyjen ruutujen tuotot näkyvät kartalla. Soturin tai rakennuksen jälkeen kaupunki tekee tuotannosta kultaa (Freecivin classic Coinage, "Kultaa"); tämä kumoaa STORY-033:n säännön "soturin jälkeen uudisasukas", joka teki kasvuansan. | Samin pelitesti: kaupunki ei kasvanut eikä keinoja ymmärtänyt; Sami halusi nähdä rajojen kasvavan ja mitä kansalaiset keräävät. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-040 hyväksyttiin: tiede. Verokanta (30, 50 tai 70 %, alussa 50) jakaa kaupan kullaksi ja tieteeksi, ja tiede tuo Freecivin civ1-keksintöjä, joista pelissä on toistaiseksi ne, jotka avaavat jotain: Aakkoset, Pronssityö, Keramiikka, Muuraus, Rahatalous ja Kirjoitus. Hinta on 10 × (tunnetut + 1). Rakennukset vaativat keksintönsä, ja kirjasto (+50 % tiedettä) tuli peliin. Kaupungin keskusruudussa on tie kuten Freecivin civ1:ssä. Aloituskulta on edelleen Freecivin oletus 50, vaikka civ1-sääntöjoukon oma asetus on 0. | Pitkän aikavälin tavoitteet; kauppa ei tuottanut kuin kultaa. Linssin ehdotus, Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-041 hyväksyttiin: kymmenen tavoitteen ketju ohjaa peliä yksi tavoite kerrallaan, ja jokainen saavutettu tavoite antaa kultaa (oma suunnittelu). Tavoite näkyy yläpaneelissa, ja napautus kertoo vihjeen. | Pelkkä tutkiminen tuntui tylsältä, eikä pelissä ollut suuntaa. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-042 hyväksyttiin: yläpaneelin luettelonappi avaa kaupunkien ja yksiköiden luettelon, josta pääsee kaupunkikorttiin ja yksikköön. Sami: pelaaminen vaatii myöhemmin isomman uudistuksen, mutta nyt toteutetaan peruspeli (avoin kysymys 11). | Samin palaute: rakennusten ja yksiköiden hallinta on hankalaa. | Sami |
| 2026-10-12 | STORY-043 hyväksyttiin: Pronssityö avaa Falangin (Freeciv civ1: 20 tuotantoa, puolustus 2). Rosvoja vastaan paras puolustaja taistelee ja kaatuu ensin. Lisäksi CI ohittaa pushit, jotka muuttavat vain kirjauksia (docs, CLAUDE.md, backlog.json). | Peruspeli: Pronssityölle oma hyöty ja parempi puolustus. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-044 hyväksyttiin: tyytyväisyys Freecivin civ1-luvuin. Despotismissa neljä asukasta on tyytyväisiä, temppeli (Hautajaisriitit) ja jokainen kaupungin sotilas rauhoittavat yhden, ja tyytymättömät pysäyttävät kaupungin (ei ylijäämää, kultaa eikä tiedettä). Ylellisyyttä ei vielä ole. | Peruspeli: Civ I:n kasvun raja. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-12 | STORY-045 hyväksyttiin: ihmeet Kolossi, Riippuvat puutarhat ja Suuri muuri Freecivin civ1-luvuin, kukin kerran pelissä. Puutarhojen myötä onnellinen asukas painaa tyytymättömän. | Peruspeli: pitkän aikavälin rakennustavoitteet. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-046 hyväksyttiin: ylellisyys on kolmas kauppaosuus (0–30 %), ja se tekee asukkaista onnellisia Freecivin civ1-sääntöjen mukaan ennen temppeliä ja sotilaita. Tori antaa +50 %. | Peruspeli: isot kaupungit pysyvät tyytyväisinä. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-047 hyväksyttiin: hallitusmuodot Freecivin civ1-säännöin. Itsevaltiudessa ruudun yli 2:n tuotosta menee yksi, Monarkia-tutkimus avaa vallankumouksen (1–5 päivää anarkiaa, kaikki kauppa ylellisyyteen), ja Monarkiassa ruudut tuottavat täysin mutta yksiköt maksavat ylläpitoa alusta asti. Korruptio puuttuu vielä. | Peruspeli. Itsevaltius hidastaa alkukasvua, mikä on Samin pelitestissä tarkistettava. | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-048 hyväksyttiin: luettelon kolmas välilehti Talous kertoo kassan, tulot ja menot, ruoan, tuotannon, kaupan jaon, työstetyt erikoisresurssit ja jokaisen kaupungin päivän. Kaupunki- ja yksikkölista olivat jo luettelossa (STORY-042). | Samin pyyntö: kaupunkilista, ukkelilista ja ekonomiatilasto. | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-049 hyväksyttiin: jokaisella karttatasolla on oma neuvonantaja, joka hoitaa tason puolestasi, ja Oma ohjaus jättää sen pelaajalle. Kaupunkialuetasolla valitaan Kasvattaja, Kartoittaja tai Vartija; kaupunkitason "tutkiminen" on kartoitusta, ja tiede kuuluu valtion neuvonantajalle. Läänin (STORY-050) ja valtion (STORY-051) neuvonantajat seuraavat. | Samin pyyntö ja valinta (Kartoitus) | Sami |
| 2026-10-13 | STORY-050 hyväksyttiin: läänitasolla valitaan Asuttaja, Tutkimusmatkailija tai Vartija. Ylemmän tason neuvonantaja menee edelle: läänin rakennukset ja retkikunnat ennen kaupunkitason. | Samin valinta | Sami |
| 2026-10-13 | STORY-051 hyväksyttiin: valtiotasolla valitaan Laajentaja, Oppinut tai Kenraali, jotka hoitavat tieteen, verot, valtion linjan, vallankumouksen Monarkiaan, ylellisyyden ja tavoiteläänin. Neuvonantajat ovat nyt kaupunkialueella, läänissä ja valtiossa; planeettatasolla ei vielä ole toimintoja. | Samin pyyntö ja valinnat | Sami |
| 2026-10-13 | STORY-052 hyväksyttiin: rauniot ovat noin joka 180. maaruudulla ja antavat palkintonsa heti Freecivin majojen tapaan (kulta, keksintö, sotilas, harvoin tiedustelija), eikä pelaaja valitse. Löytökortti ja -pilleri poistuivat, mikä kumoaa STORY-027:n ja STORY-037:n valinnan. Tiede-pilleri näkyy aina, kun on kaupunki. | Samin pelitesti: liikaa raunioita ja hälinää, tiede-nappia ei löytynyt | Sami |
| 2026-10-13 | STORY-016 hyväksyttiin: lääni on hallussa, kun siinä on pelaajan kaupunki, ja valtio on vallattu, kun kaikki sen seitsemän lääniä ovat hallussa. Kotivaltion valtaus avaa planeettatason ja naapurivaltiot; muut valtiot ovat lukossa tiedustelijoilta, lipulta ja kaupunkipaikoilta. Avautuminen näkyy siruissa ja mittarissa tekstinä. | Samin valinta (kaupunki läänissä) | Sami |
| 2026-10-13 | STORY-053 hyväksyttiin: pelin planeettataso pysähtyy tasorajan yli niin, että avoimien valtioiden sirut mahtuvat, ja puhelimella päällekkäiset sirut levitetään kotivaltiosta poispäin. Avautumiskortti on sirujen päällä (sirut veivät sen napautukset puhelimella). | STORY-016:n tunnettu puute ja puhelinajossa löytynyt vika | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-054 hyväksyttiin: kaupunki ei kasva yli koon 10 ilman vesijohtoa (Freeciv civ1), ja Rakentaminen avaa vesijohdon ja areenan (kolme tyytyväiseksi). | Peruspeli: Civ I:n kasvun raja. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-055 hyväksyttiin: kaupunkialuetasolla heksan napautus avaa kortin siitä, mitä heksa sisältää (maasto, resurssi, tuotto, parannukset, kaupunki, yksiköt, kulku). Valittu uudisasukas valitsee yhä paikkansa napautuksella. | Samin pyyntö | Sami |
| 2026-10-13 | STORY-056 hyväksyttiin: tavoiteketju jatkuu kolmen kaupungin jälkeen kuudella tavoitteella kotivaltion valtaukseen asti (neuvonantaja, valtion kartoitus, monarkia, neljä lääniä, vesijohto, valtaus). | Pelissä ei ollut suuntaa kolmen kaupungin jälkeen. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-057 hyväksyttiin: planeettatasolla valitaan kohdevaltio, ja neuvonantajina ovat Valloittaja, Löytöretkeilijä ja Linnoittaja. Jokaisella karttatasolla on nyt oma neuvonantaja. | Samin pyyntö (STORY-049) | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-058 hyväksyttiin: lääni, jossa ei ole maata, lasketaan hallussa olevaksi. Mittauksessa kahdella siemenellä kahdestatoista kotivaltiossa oli merilääni, joka olisi estänyt valtauksen. Saarellinen lääni jää laivojen varaan. | Pelin pysäyttävä vika STORY-016:ssa | Linssi (Samin valtuutuksella) |
| 2026-10-13 | STORY-059 hyväksyttiin: Kartanteko antaa yksiköiden kulkea rannikkovesillä päivässä ruutu (Freeciv civ1 trireemin säännöin, mutta laivaa ei rakenneta), joten saaret ja veden takainen maa ovat saavutettavissa. | STORY-058:n avoin kysymys | Linssi (Samin valtuutuksella) |
| 2026-10-19 | STORY-060 hyväksyttiin: pitkä testipeli neuvonantajilla löysi viisi jumia (odottava paikka, maan kehitys, tiedustelijoiden ajautuminen, paikkatarjoukset, levottomuus) ja toistuvat kaupunkinimet; kaikki korjattiin, ja peli valtaa nyt kotivaltion noin 680 päivässä. Kaupunkimäärän kasvaessa levottomuus yleistyy (STORY-061). | Pitkän pelin löydökset. Sami: jatka. | Linssi (Samin valtuutuksella) |
| 2026-10-19 | STORY-061 hyväksyttiin: kaupungit ottavat päivittäin niin vähän viihdyttäjiä kuin levottomuuden välttämiseen tarvitaan (Freeciv civ1: 2 ylellisyyttä). Pitkässä pelissä levottomuuden kierre ja tyhjä kassa poistuivat. | STORY-060:n pitkän pelin löydös | Linssi (Samin valtuutuksella) |
| 2026-10-19 | STORY-062 hyväksyttiin: myöhäisen pelin frame ei enää pakota asettelua (sirut, laput ja paneelien reunat), ja pääsäie on 60 % joutilas, kun se oli 24 %. Planeettatason pudonneet framet ovat GPU-puolella ja mitataan oikealla GPU:lla (avoin kysymys 9). | Mittaus pitkästä pelistä (koodaussääntö 6) | Linssi (Samin valtuutuksella) |
| 2026-10-19 | Vastustajat (Sami): kaikki kolme lajia eli kaupunkivaltiot, paimentolaiset ja tekoälysivilisaatiot, ja hyökkäykset käynnistää vain neuvonantaja (valtiotasolla Kenraali, planeettatasolla Valloittaja). STORY-063 hyväksyttiin: kotivaltion ja vallattujen valtioiden naapurivaltioissa on 2–4 kaupunkivaltiota siemenestä (oma sääntö, Civ I:ssä niitä ei ole), ne näkyvät kartoitettuina, ja niiden viereen ei voi perustaa kaupunkia. Haku tehdään 3 ms:n paloissa framea kohden. Seuraavaksi hyökkäysyksiköt (STORY-064) ja sotaretket (STORY-065). | Sami: vastustajat, kaikki lajit, vain neuvonantaja, vain naapurivaltioissa | Sami |
| 2026-10-19 | STORY-064 hyväksyttiin: Kenraali valtaa kaupunkivaltioita. Ratsastus, Rautatyö, Pyörä ja Matematiikka avaavat Ratsumiehen, Miekkamiehen, Sotavaunut ja Katapultin (Freeciv civ1: Cavalry, Legion, Chariot ja Catapult). Taistelu on Freecivin yksi kierros A/(A+D). Kenraali etsii kohteen tiedustelijoilla, rakennuttaa ja ostaa kolmessa lähimmässä kaupungissa joukon, joka odotusarvoisesti riittää (enintään 10), marssittaa sen lähimpään kaupunkivaltioon avoimessa valtiossa ja valtaa sen. Vallattu kaupunki menettää asukkaan, ja koon 1 kaupunki tuhoutuu (Freeciv). Omat yksinkertaistukset: kaikki liikkuvat ruudun päivässä, ja kaatuneet puolustajat palaavat yksi kymmenessä päivässä. | Sami: hyökkäykset vain neuvonantajan kautta | Linssi (Samin valtuutuksella) |
| 2026-10-19 | STORY-065 hyväksyttiin: kaupunkia ei perusteta paikkaan, jossa keskus ja sen paras naapuri tuottavat alle 3 ruokaa (oma sääntö Freecivin kaupunginhallinnan ruoan ylijäämän 1 mukaan). Pitkässä pelissä kultavuoret nostivat ruoattoman vuoriston paikkapisteen rajan yli, ja kaupungit jäivät kokoon 1. Kaupunkivaltioiden paikat voivat muuttua, koska niitä ei tallenneta. | Pitkän pelin diagnostiikka | Linssi (Samin valtuutuksella) |
| 2026-10-19 | STORY-066 hyväksyttiin: kotivaltion ja vallattujen valtioiden naapurivaltioissa on kussakin paimentolaisheimo, jonka leiri siirtyy 40 päivän välein. Päivästä 120 heimo lähettää Freecivin barbaarien kokoisen joukon (2–4 ratsumiestä, päivästä 300 miekkamiehiä) lähimpään kaupunkiin 12 ruudun säteellä. Kenraali voi hajottaa heimon, joka maksaa 100 kultaa lunnaita (Freeciv). Samalla korjattiin STORY-064:n vika: riittävä joukko lähtee suoraan kohteeseen. | Sami: vastustajista kaikki kolme lajia | Linssi (Samin valtuutuksella) |
| 2026-10-20 | STORY-067 hyväksyttiin: resurssimerkit ovat tuottonsa värisiä (ruoka, tuotanto ja kauppa), ja kartan napautus avaa joka tasolla oman kortin: kaupunkialuetasolla heksan, läänitasolla kaupunkialueen, valtiotasolla läänin ja planeetalla valtion. Siru vain valitsee, ja toinen napautus sukeltaa. Samalla Sami valitsi tekoälysivilisaatioiksi kilpailijat kauempana: 2–3 tekoälyä aloittaa kahden valtion päästä ja kasvaa pelaajan säännöin, ja niiden Kenraali hyökkää rajojen kohdatessa (STORY-068 ja STORY-069). | Sami: resurssit värittömiä, ja popup joka tasolla (valinta: joka tasolla oma) | Sami |
| 2026-10-20 | STORY-068 hyväksyttiin: 2–3 kilpailijaa (Pohjola, Tapiola ja Ahtola) aloittaa kahden askeleen päässä kotivaltiosta olevista maavaltioista, ja niiden kaupungit kasvavat ja rakentavat pelaajan Freecivin säännöin oman yksinkertaisen tekoälyn ohjaamina (sotilas, uudisasukkaita enintään kahdeksaan kaupunkiin, sitten kultaa). Kilpailijat näkyvät kartoitettuina omissa väreissään, ja niiden kaupunkien väli pidetään pelaajan kaupunkeihin ja kaupunkivaltioihin. Seuraavaksi sodat (STORY-069). | Sami: kilpailijat kauempana | Linssi (Samin valtuutuksella) |
| 2026-10-20 | Uusi suunta (Sami, avoin kysymys 11): Settlers-testin (ystävän työ, lupa Samin mukaan) korkeuserot ja rakennukset ovat kaupunkitaso, ja pelaaja sijoittaa rakennukset. Uusi alku: kaupungin alkupaikaksi arvotaan monipuolinen maasto, jossa on yksi erikoisresurssi, rakennuksia on muutama, kaikki hoituu kuvernööreillä (nykyiset Kasvattaja, Kartoittaja ja Vartija), ja tiedustelija tai uudisasukas avaa seuraavan kartan. Kansa tutkii alkuresurssin ja näkee sen lajin kartalla, resursseja paljastuu läänitasolla, ja uuden resurssin asuttaminen antaa sen rakennuksen, joka avaa tutkimuksen, yksikön tai bonuksen. Suunnitelma: docs/design/kaupunkitaso.md. STORY-069 hyväksyttiin: lähellä kaupunkia sen kolme rengasta nousevat korkeuseroiksi (maa nousee 0,6 s:ssa) fasetoiduin pinnoin, valoin ja varjoin, puin, kivin, taloin ja rakennuksin. Toteutus on omaa koodia Settlersin tekniikalla. | Sami: kaupunkitaso, sijoitus, uusi alku, kuvernöörit ja resurssit | Sami |
| 2026-10-20 | STORY-070 hyväksyttiin: uusi peli lentää valmiiseen pääkaupunkiin kaupunkitasolle monipuoliseen alkupaikkaan, jossa on yksi erikoisresurssi. Ensin rakennetaan maaston rakennus (Kalastamo, Saha, Louhos tai Pelto; Samin valinta, omat säännöt: 30 tuotantoa, +1 ruoka tai tuotanto), sitten yksiköt avautuvat (Sami: aloitusyksiköt vasta ensimmäisen rakennuksen jälkeen), ja ensimmäinen tiedustelija tai uudisasukas avaa kaupunkialuetason. Kuvernööreinä ovat Kasvattaja, Kartoittaja ja Vartija. Vanha alku on kehitystilassa ?classic mekaniikan testejä varten. | Sami: alkuanimaatio kaupunkitasolle, aloitusyksiköt rakennuksen jälkeen, maaston rakennukset | Sami |
| 2026-10-20 | STORY-071 hyväksyttiin: kuvernööri sijoittaa jokaisen rakennuksen kaupungin kahden renkaan maaruudulle sen parhaaseen paikkaan, ja pelaaja siirtää rakennusta kaupunkitasolla ruudun kortin Siirrä-napista merkittyyn ruutuun. Korkeus antaa bonuksen (omat luvut): ylhäällä temppeli rauhoittaa yhden lisää ja kirjasto antaa +1 tiedettä, alhaalla pelto ja viljavarasto antavat +1 ruokaa ja tori +1 kauppaa, ja vuorella louhos +1 tuotantoa. Vuorelle ei rakenneta muuta kuin louhos. Samalla korjattiin STORY-070:n vika: ilman yksiköitä ruudun napautus ei avannut korttia. | Sami: korkeus antaa bonuksen, ylhäällä ja alhaalla, kuvernööri sijoittaa ja pelaaja siirtää | Sami |

### Avoimet kysymykset

1. ~~**Testipuhelin.**~~ Ratkaistu 2026-10-09: Samsung Galaxy S23 Ultra (päätöstaulukko).
2. ~~**GPL v3 ja siirretty koodi.**~~ Ratkaistu 2026-10-09 (päätöstaulukko).
3. **Tuntematon tekstuuri.** `earth_texture.png` globe-civilisationista ei ole mukana, ennen kuin sen lähde ja lisenssi on selvitetty. Maasto generoidaan proseduraalisesti.
4. ~~**"Infinite" ylemmässä CLAUDE.md:ssä.**~~ Ratkaistu 2026-10-09: tekijänä on Sami (päätöstaulukko). Jos "Infinite" halutaan myöhemmin tekijäriville, se on uusi päätös.
5. ~~**Riippuvuuksien haavoittuvuudet.**~~ Ratkaistu 2026-10-09: `npm audit fix` ajettiin osana PLAN-002:ta, ja tulos on 0 haavoittuvuutta.
6. ~~**Dependabotin 9 PR:ää.**~~ Ratkaistu 2026-10-09: mergetty yhtenä päivityksenä (päätöstaulukko).
7. ~~**Haarasuojaus.**~~ Ratkaistu 2026-10-09: kehitysvaiheessa omat haarat mergetään mainiin kysymättä (päätöstaulukko). Haarasuojaus arvioidaan uudelleen, kun peli jaetaan muille.
8. ~~**STORY-004:n lopullinen vahvistus.**~~ Ratkaistu 2026-10-09: STORY-004 hyväksyttiin, ja Phaser-päätös vahvistui (päätöstaulukko).
9. **Rajashaderin kustannus keskitason puhelimella.** Osittain ratkaistu 2026-10-09: Intel UHD:lla 56–61 fps kaikilla etäisyyksillä (TICKET-TEST-010). Keskitason puhelinta ei ole mitattu. Seuraava keino tarvittaessa on pienempi pikselioktaavien määrä. Syvä zoom maalla on Intel UHD:lla noin 52–54 fps (TICKET-TEST-014), eli tavoitteen 60 alla. Mahdollinen keino on harventaa pikselioktaaveja tai heksalaskentaa, kun ruutu on näyttöä suurempi. STORY-026:n tasot mitattiin uudelleen GPU:n ollessa vapaa: kaupunkialue, lääni ja valtio 56,8–57,1 fps, sama kuin tyhjä aloitusnäyttö (TICKET-TEST-017). Myöhäinen peli 2026-10-19 (siemen 42, neuvonantajat, 16–17 kaupunkia, valtiotaso etäisyydellä 0,37 R ja 116 ruutua, Intel UHD, Playwrightin Chromium): 157 framea 3 s:ssa (noin 52 fps), ja pääsäie on joutilas (JS 3,7 ms framessa). Pinnan piilotus palauttaa 60 fps:n, sumun pois kytkentä lähes (172 framea), pintakuviot eivät vaikuta, ja lähempänä (0,25 R, 74 ruutua) 60 fps. Frame on Intel UHD:lla budjetin rajalla, joten seuraava keino on pinnan pikselikustannus kaukana (oktaavit, sumu). Toistettava penkki (kotivaltio kartoitettu, 0,37 R, viisi kierrosta, mediaani): samalla etäisyydellä piirrettyjen ruutujen määrä vaihtelee ajosta toiseen (63–116), noin 70 ruudulla 60 fps ja 90:llä 52–57 fps; sumu maksaa 5–10 %, eikä yksittäistä kallista kohtaa löytynyt. Ruutujen määrän vaihtelu johtuu jakamisen hystereesistä (jako 256 px, yhdistäminen 128 px): ulos loitonnettaessa hienommat ruudut jäävät. Yhdistäminen 192 px:ssä ei muuttanut penkin tulosta, ja saman päivän ajoissa sama penkki antoi 165–174 ja myöhemmin 179–181 framea, eli GPU:n muu kuorma (Samin Chrome) hallitsee mittausta. Muutosta ei tehty; ratkaisee mittaus puhelimella tai vapaalla GPU:lla.
10. ~~**Assets-maastoshaderit.**~~ Ratkaistu 2026-10-10: vesi kirjoitettiin omana, ja pelto, metsä ja korkokuva näkyvät ruuduissa pintakuvioina (päätöstaulukko, muistion kohta 6).
11. **Pelattavuuden uudistus.** Sami 2026-10-12: "Pelaaminen vaatii isomman revampin, mut toteutetaan nyt itse peruspeli." Uudistus suunnitellaan peruspelin jälkeen.

### Ratkenneet kysymykset

- ~~Luovutaanko Phaser-overlaysta?~~ Ratkaistu 2026-10-09: kyllä (päätöstaulukko).
- ~~Kuutiopallo-quadtree vai jokin muu hierarkia?~~ Ratkaistu 2026-10-09: kuutiopallo ja quadtree.
- ~~Kuinka syvälle MVP zoomaa?~~ Ratkaistu 2026-10-09: tasolle noin 12.
- ~~Suorituskykytavoite?~~ Ratkaistu 2026-10-09: 60 fps työpöydällä ja 30 fps puhelimessa. Testipuhelin on yllä avoin.
- ~~AI:n nimi?~~ Ratkaistu 2026-10-09: Linssi.
- ~~Response Protocol?~~ Ratkaistu 2026-10-09: alkuotsikko.
- ~~Lisenssi?~~ Ratkaistu 2026-10-09: GPL v3.
- ~~Luodaanko repo julkisena?~~ Ratkaistu 2026-10-09: kyllä.
- ~~Phaser-riippuvuus?~~ Ratkaistu 2026-10-09: poistettu heti.
