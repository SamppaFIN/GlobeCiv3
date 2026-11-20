# Pelitestit (Inanna 🦁)

Tähän kansioon tulevat Inannan pelitestit `PLAYTEST-NNN.md` ja niiden
kuvakaappaukset WebP-muodossa kansioon `shots/`. Inanna on sokea tekoälypelitestaaja: hän
pelaa julkaistua peliä kuin uusi pelaaja eikä näe koodia, suunnitelmia eikä
hyväksymiskriteerejä. Utu tarkistaa, toimiiko peli niin kuin luvattiin, ja
Inanna tarkistaa, kannattaako sitä pelata.

Tekoäly ei pysty kertomaan, onko peli kivaa, mutta se löytää luotettavasti
sen, mikä tekee pelistä tylsän tai sekavan. Viimeinen sana on Samilla.

## Näin ajat pelitestin

1. Avaa Claude Code repon juuressa. Ensimmäisellä kerralla se kysyy lupaa
   käynnistää `.mcp.json`:n Playwright-palvelimen (`@playwright/mcp` 0.0.86,
   Apache-2.0). Hyväksy. Palvelin avaa Chromen, jossa voit seurata pelaamista.
2. Kirjoita esimerkiksi: **"Inanna, tee PLAYTEST-001 siemenellä 42."**
3. Kerro vain tunniste, siemen, persoonat ja osoite. Älä kerro, mitä peliin
   muutettiin: Inannan arvo on siinä, että hän näkee pelin ensimmäistä kertaa.
4. Raportti tulee tiedostoon `docs/playtests/PLAYTEST-NNN.md`.

Oletuksena Inanna pelaa osoitetta https://samppafin.github.io/GlobeCiv3/?seed=42
eli viimeisintä Pages-julkaisua. Kirjaa testitikettiin commit, jonka julkaisua
pelattiin.

## Raportin sisältö

Raportin rakenne, persoonat ja arvioiden asteikko on määritelty tiedostossa
`.claude/agents/inanna.md`, ja se on niiden ainoa lähde. Lyhyesti:

- **Persoonat:** Uusi pelaaja puhelimella (ikkuna 384 × 824), Rakentaja ja
  Valloittaja (1280 × 800).
- **Arviot 1–5:** selkeys, tahti, valintojen merkitys, palkitsevuus ja halu
  jatkaa.
- **Aikajana:** jokainen toiminto numeroituna (#1, #2, …) pelipäivän kanssa.
- **Hämmennyksen hetket, kuollut aika, mikä toimi ja lopetuskohta**
  persoonittain.
- **Missä peli muuttuu sekavaksi** ja **kolme tärkeintä korjausta**.

## Ajot

| Raportti | Päivä | Build | Missä ajettiin |
|---|---|---|---|
| [PLAYTEST-001](PLAYTEST-001.md) | 2026-11-19 | Pages 37767a6 | Pilvi: erillinen Sonnet-agentti Inannan ohjeilla, sokeus ohjeen varassa (STORY-084) |
| [PLAYTEST-002](PLAYTEST-002.md) | 2026-11-20 | Pages a0d1950 | Pilvi: sama silta kuin PLAYTEST-001 (Inannan projektiagentilla ei ollut Playwright-palvelinta), Sonnet-agentti Inannan ohjeilla; kuvat muunnettiin WebP:ksi ja polut muotoon `shots/…` (STORY-017 ja STORY-088) |

## Rajoitukset

- Puhelinpersoona emuloidaan ikkunan koolla. Nipistyszoomia ei ole.
- Kartta on 3D-canvas, joten Inanna napauttaa kuvakaappauksen koordinaatteihin.
  Käyttöliittymän napit hän löytää myös sivun saavutettavuuspuusta.
- Juurikäyttäjänä (esimerkiksi pilviympäristössä) Chrome tarvitsee
  `--no-sandbox`-asetuksen, ja ilman näytönohjainta WebGL tarvitsee
  SwiftShaderin (`--use-angle=swiftshader --enable-unsafe-swiftshader`).
  Samin koneella kumpaakaan ei tarvita.
