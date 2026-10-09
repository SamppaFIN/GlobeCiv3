# Design brief — GlobeCiv3: "Kartta, joka piirtyy"

> Liitä tämä tiedosto kokonaan **Claude Designiin**. Kaikki tarvittava on tässä:
> pelin idea, näkymät tekojärjestyksessä, kuvakelistat nimineen ja design-tokenit.
> Päivitetty 2026-10-09 pelin kulun suunnitelman mukaan (docs/design/pelin-kulku.md).

## 1. Peli lyhyesti

GlobeCiv3 on selaimessa ja puhelimessa toimiva sivilisaatiopeli planeetalla,
jolla zoomataan saumattomasti avaruudesta yksittäiseen maastoruutuun.

- Peli alkaa näkymästä, jossa **koko planeetta** pyörii tähtien keskellä.
  **Uusi peli** lentää kameran arvottuun aloituspaikkaan alimmalle tasolle.
- Alimmalla tasolla kartta on **heksaruutuja** (noin 61 per kaupunkialue),
  joilla on maasto ja resursseja. Kaikki muu on **sumun peitossa**.
- Yksiköt (tiedustelijat ja uudisasukas) toimivat **itsenäisesti**. Pelaaja
  ohjaa niitä moodeilla ja lipuilla eikä liikuta niitä ruutu kerrallaan.
- Aika kulkee itsestään (noin 1,5 s per päivä). Pelin voi pysäyttää tai
  nopeuttaa.
- Kun alueesta on kartoitettu 60 %, seuraava zoom-taso aukeaa:
  **kaupunkialue → lääni → valtio → planeetta**. Jokaisella tasolla on omat
  toimintonsa. Pelaaja siis **piirtää maailman kartaksi** taso kerrallaan.
- Pääalusta on puhelin (Samsung Galaxy S23 Ultra), toinen on työpöytä hiirellä.

**Tärkein visuaalinen tehtävä:** kartoittamattoman ja kartoitetun maailman
ero, sekä se, että sama maailma näyttää hyvältä planeettana, karttana ja
heksaruutuina.

## 2. Visuaalinen suunta

Ehdotus on **"Kartografi"**. Kartoittamaton maailma on vanhan kartan reunaa:
pergamenttia, musteviivoja ja haalistuvia ääriviivoja. Kartoitettu maailma
on värikästä, maalauksellista maastoa. Rajat ovat musteella piirrettyjä
viivoja, ja käyttöliittymä muistuttaa kartanpiirtäjän työkaluja (kompassi,
mustekynä, lippu). Avaruus ja planeetta pysyvät tummina ja rauhallisina.

Tee ensimmäisestä näkymästä (aloitusnäyttö) **kaksi suuntaa**: Kartografi ja
yksi oma ehdotuksesi. Jatketaan valitulla suunnalla.

**Ei saa:** Civilization-pelien nimiä, logoja, ikoneita tai ulkoasun
kopiointia. Pelimekaniikka on lainattu, mutta ilme on oma.

## 3. Näkymät tekojärjestyksessä

Yksi näkymä kerrallaan: näytä, ota palaute, jatka. Mobiili ensin (390 px leveä
kehys), sitten työpöytä (1440 px).

1. **Aloitusnäyttö.** Planeetta tähtitaivaalla, pelin nimi "GlobeCiv" ja
   "Uusi peli" -nappi. Planeetta on tumma, sumuinen siluetti, koska mitään ei
   ole vielä kartoitettu, mutta mantereet aavistuvat.
2. **Lento aloituspaikkaan** (kuvakäsikirjoitus, 3 ruutua): planeetta → valtio
   (heksarajat) → kaupunkialue (heksaruudut). Noin 3 s. Vähennetyllä liikkeellä
   suora leikkaus.
3. **Kaupunkialuenäkymä (pelin päänäkymä)**
   - Heksaruudukko: kartoitetut ruudut värikkäinä, kartoittamattomat sumuna
   - Yksiköt ruuduilla: 2 tiedustelijaa ja uudisasukas
   - HUD: päivä, tauko ja nopeus (1×, 2×, 4×), kartoitusmittari ("Lääni 23 /
     60 %"), yksiköiden moodit (Tutki, Kerää, Puolusta) ja lippu-työkalu
   - Kaupungin paikan valinta (uudisasukkaan kohde)
4. **Löytökortti.** Tiedustelija löysi jotain, ja peli pysähtyy. Kaksi
   vaihtoehtoa, joista valitaan toinen (esim. "Kalaisat vedet: +2 ruokaa" /
   "Vanhat rauniot: uusi tiedustelija").
5. **Avautumisilmoitus.** "Lääni kartoitettu — zoomaa ulos" ja selkeä vihje
   ulos zoomaamisesta (nipistys tai rulla).
6. **Lääninäkymä.** Läänin 7 kaupunkialuetta, ja kunkin painotus: tutki,
   asuta tai ohita. Retkikunnan lähetys naapurialueelle.
7. **Valtionäkymä.** Valtion 7 lääniä, valtion linja (laajentuminen,
   tutkimus, puolustus) ja läänin haltuunotto tavoitteeksi.
8. **Kaupunkikortti** (perus): kaupungin koko, ruoka, tuotanto ja kauppa.

## 4. Kuvakkeet ja grafiikat

SVG, 64 × 64 viewBox, selkeä myös 24 px:n kokoisena. Tiedostonimet alla, jotta
ne voi kytkeä koodiin suoraan.

**Maastot (11)**: väri tai tekstuuri heksaruudulle sekä pieni kuvake selitteeseen.

| Tiedosto | Maasto | Huomio |
|---|---|---|
| terrain-ocean | Valtameri | Syvyysliukuma rannasta syvään |
| terrain-arctic | Arktinen | |
| terrain-desert | Aavikko | |
| terrain-forest | Metsä | |
| terrain-grassland | Ruohomaa | |
| terrain-hills | Kukkulat | |
| terrain-jungle | Viidakko | |
| terrain-mountains | Vuoret | |
| terrain-plains | Tasanko | |
| terrain-swamp | Suo | |
| terrain-tundra | Tundra | |

**Resurssit (11)**: kuvake ruudun keskelle.

| Tiedosto | Resurssi | Maasto | Vaikutus |
|---|---|---|---|
| resource-fish | Kala | Valtameri | +2 ruokaa |
| resource-seals | Hylkeet | Arktinen | +2 ruokaa |
| resource-oasis | Keidas | Aavikko | +3 ruokaa |
| resource-game | Riista | Metsä | +2 ruokaa |
| resource-reindeer | Poro | Tundra | +2 ruokaa |
| resource-fertile | Hedelmällinen maa | Ruohomaa | +1 tuotanto |
| resource-coal | Hiili | Kukkulat | +2 tuotanto |
| resource-gems | Jalokivet | Viidakko | +4 kauppa |
| resource-gold | Kulta | Vuoret | +6 kauppa |
| resource-horses | Hevoset | Tasanko | +2 tuotanto |
| resource-oil | Öljy | Suo | +4 tuotanto |

**Yksiköt ja paikat**: unit-scout (tiedustelija), unit-settler (uudisasukas),
unit-warrior (soturi), city (kaupunki), city-capital (pääkaupunki),
flag-explore (tutkimuslippu).

**Tuotot**: yield-food, yield-production, yield-trade.

**Sumu ja rajat**
- **Sumun reuna**: miltä kartoittamaton näyttää ja miten raja kartoitettuun
  ruutuun piirtyy. Mieluiten pehmeä, käsin piirretyn oloinen reuna.
- **Rajat kolmella tasolla**: valtio (vahvin), lääni ja kaupunkialue (hennoin).
  Näytä viivan paksuus ja väri sekä tummalla merellä että vaalealla maalla.
- **Heksaruudun reuna**: hento viiva, joka näkyy vasta lähellä.

## 5. Design-tokenit

Käytä näitä ja laajenna niitä tarvittaessa. Maastojen värit annetaan myös
tokeneina, koska ne siirretään sellaisinaan pelin shaderiin.

```css
:root {
  /* OKLCH: perceptually uniform, no surprises when you shift lightness */
  --c-bg:       oklch(0.12 0.02 260);
  --c-surface:  oklch(0.17 0.02 260);
  --c-text:     oklch(0.92 0.01 260);
  --c-accent:   oklch(0.62 0.18 240);
  --c-success:  oklch(0.62 0.20 145);
  --c-danger:   oklch(0.52 0.22 25);

  /* Ehdota: --terrain-ocean-deep, --terrain-ocean-shallow, --terrain-grassland, ...
     (11 maastoa + meren syvyysliukuma + lumi), --fog, --fog-edge,
     --border-state, --border-province, --border-city, --hex-edge */

  --touch-target: 44px;        /* WCAG 2.5.5 */
}

/* Responsive type without media queries */
font-size: clamp(0.75rem, 1.5vw, 0.9rem);
```

Pakolliset käytökset:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}
```

## 6. Rajoitteet

- Jokainen kosketuskohde on vähintään 44 × 44 px
- Kontrasti täyttää WCAG AA:n sekä tähtitaivasta, merta että maata vasten
- Tieto ei välity pelkällä värillä: maasto, resurssi ja tila näkyvät myös
  kuvakkeena tai tekstinä
- HUD vie puhelimella enintään noin neljäsosan näkymästä, eikä mikään leikkaudu
  390 px:n leveydellä. Huom: fontin leveys vaihtelee laitteittain, joten jätä
  tilaa (testipuhelimessa nappi leikkautui, vaikka se mahtui emulointiin).
- HUD on läpikuultava kerros elävän 3D-maailman päällä
- Ei Civilization-pelien nimiä, ikoneita eikä ulkoasua

## 7. Mitä tuotetaan

1. Aloitusnäyttö kahtena suuntana (Kartografi ja oma ehdotus). Valinta tehdään
   ennen jatkoa.
2. Näkymät 2–8 valitulla suunnalla, mobiili ja työpöytä
3. Kuvakkeet SVG:nä yllä olevilla tiedostonimillä
4. Täydennetyt tokenit (maastovärit, sumu ja rajat) CSS-muuttujina
