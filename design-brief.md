# Design brief — GlobeCiv3: Tasotikkaat

> Liitä tämä tiedosto kokonaan **Claude Designiin**. Kaikki tarvittava on tässä:
> uusi pelisuunta, näkymät tekojärjestyksessä, kuvakelistat nimineen ja
> design-tokenit. Päivitetty 2026-11-19 uusintahaastattelun mukaan. Edellinen
> briiffi (2026-10-09, "Kartta, joka piirtyy") tuotti Kartografi-ilmeen, joka on
> jo pelissä käytössä ja pysyy pohjana.

## 1. Peli lyhyesti

**Projekti:** GlobeCiv3, selaimessa ja puhelimessa toimiva sivilisaatiopeli
heksaplaneetalla. Zoom kulkee saumattomasti planeetasta kaupungin rakennuksiin
samassa näkymässä.

**Uusi suunta:** jokainen zoom-taso on oma pelinsä.

| Taso | Pelin henki | Mitä pelaaja tekee |
|---|---|---|
| Kaupunki | rakennus- ja talouspeli | sijoittaa rakennuksia ja rakentaa tuotantoketjuja |
| Kaupunkialue | varhainen sivilisaatiopeli | tiedustelee ja asuttaa valmiita kaupunkeja |
| Lääni | kulttuuri ja resurssit | kasvattaa rajoja ja yhdistää resursseja |
| Valtio | diplomatia ja sota | kohtaa kaupunkivaltiot, paimentolaiset ja kilpailijat |
| Planeetta | maailmanpolitiikka | MVP:n jälkeen, näkyy lukittuna |

Pelaaja aloittaa kaupungista ja **näkee nousunsa**: kun tason tavoite täyttyy,
seuraava taso aukeaa, ja alempi taso jatkaa neuvonantajan varassa. Nykyinen
ongelma on, että peli muuttuu heti liian sekavaksi, koska kaikki järjestelmät
tulevat vastaan alusta asti. Designin tärkein tehtävä on **tehdä nousu
tunnettavaksi ja pitää kukin taso selkeänä**.

**Kohdekäyttäjä:** uusi pelaaja puhelimella (pääalusta Samsung Galaxy S23
Ultra), toisena työpöytä hiirellä. Myöhemmin kaverit moninpelissä.

**Saavutettavuus:** WCAG 2.1 AA HUD:lle ja valikoille.

## 2. Visuaalinen suunta

**Kartografi pysyy.** Kartoittamaton maailma on vanhan kartan reunaa, ja
kartoitettu maailma on värikästä, maalauksellista maastoa. Ehdota jokaiselle
tasolle oma **sävy samassa ilmeessä**, jotta pelaaja tuntee, millä tasolla on,
esimerkiksi lämmin ja kädenläheinen kaupunki ja viileä, karttahuonemainen
valtio. Sävy näkyy tason tunnuksessa, tavoitteessa ja nousuhetkessä, ei koko
maailmassa.

**Ei saa:** esikuvapelien (Civilization, Settlers, Nuclear War) nimiä, logoja,
ikoneita tai ulkoasun kopiointia. Mekaniikat on lainattu, mutta ilme on oma.

## 3. Näkymät tekojärjestyksessä

Yksi näkymä kerrallaan: näytä, ota palaute, jatka. Mobiili ensin (390 px leveä
kehys), sitten työpöytä (1440 px).

1. **Tason tavoite HUD:ssa.** Tason tunnus ja nimi, tavoite yhdellä lauseella
   ("Kaupunki valmis: 6 rakennusta ja 8 asukasta") ja edistymispalkki. Sama
   komponentti kaikilla tasoilla, eri sävyllä. Vie puhelimella mahdollisimman
   vähän tilaa.
2. **Nousuhetki.** Peli pysähtyy, kamera loitontaa ylemmälle tasolle, ja kortti
   kertoo, mitä valmistui ja mitä aukesi ("Kaupunki valmis — kaupunkialue
   aukeaa: tiedustelijat, uudet kaupungit"). Yksi selkeä jatka-nappi.
   Vähennetyllä liikkeellä suora leikkaus. Tämä on pelin tärkein palkinto, joten
   panosta siihen.
3. **Neuvonantaja ohjaimissa.** Miten alempi taso näyttää, kun neuvonantaja
   pelaa sitä: merkki kaupungissa tai alueella, neuvonantajan nimi (Kasvattaja,
   Kartoittaja, Vartija) ja "Ota ohjat" -nappi, kun pelaaja sukeltaa takaisin.
4. **Kaupunkitason tuotantoketju.** Kaupunkikortin varasto ja ketju
   (esimerkiksi puu → lankut → rakennukset ja vilja → leipä → asukkaat).
   Pullonkaula näkyy ilman, että pelaajan tarvitsee laskea.
5. **Valmis settlementti kaupunkialueella.** Miten valmis kaupunki erottuu
   kasvavasta, kun sitä katsotaan ylemmältä tasolta yhtenä kokonaisuutena.
6. **Läänin kulttuurirajat.** Raja, joka kasvaa kulttuurista, ja yhdistetty ja
   yhdistämätön resurssi.
7. **Ensimmäinen kohtaaminen valtiotasolla.** Kilpailijat, kaupunkivaltiot ja
   paimentolaiset tulevat vastaan vasta täällä. Näytä esittelyhetki, joka ei
   hukuta pelaajaa.
8. **Lukittu planeettataso.** Planeetta näkyy, mutta taso on lukittu
   merkinnällä "MVP:n jälkeen" tai pelin sisäisellä vastineella.

## 4. Kuvakkeet ja grafiikat

SVG, 64 × 64 viewBox, selkeä myös 24 px:n kokoisena. Tiedostonimet alla, jotta
ne voi kytkeä koodiin suoraan.

**Tasot (5):** level-city, level-region, level-province, level-state,
level-planet.

**Nousu ja neuvonantaja:** ascent (nousu), advisor-auto (neuvonantaja
ohjaimissa), take-control (ota ohjat), level-locked (lukittu taso).

**Tavarat (ehdotus, täydennetään STORY-088:n suunnitelmassa):** goods-wood,
goods-planks, goods-grain, goods-bread, goods-stone.

**Valmis kaupunki:** settlement-complete (erottuu kuvakkeesta city).

## 5. Design-tokenit

Käytä nykyisiä tokeneita ja laajenna niitä tarvittaessa.

```css
:root {
  /* OKLCH: perceptually uniform, no surprises when you shift lightness */
  --c-bg:       oklch(0.12 0.02 260);
  --c-surface:  oklch(0.17 0.02 260);
  --c-text:     oklch(0.92 0.01 260);
  --c-accent:   oklch(0.62 0.18 240);
  --c-success:  oklch(0.62 0.20 145);
  --c-danger:   oklch(0.52 0.22 25);

  /* Ehdota tasojen sävyt samalla vaaleudella, jotta kontrasti pysyy:
     --level-city, --level-region, --level-province, --level-state, --level-planet */

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
- Tieto ei välity pelkällä värillä: taso, tila ja edistyminen näkyvät myös
  kuvakkeena tai tekstinä
- HUD vie puhelimella enintään noin neljäsosan näkymästä, eikä mikään leikkaudu
  390 px:n leveydellä. Jätä tilaa, koska fontin leveys vaihtelee laitteittain.
- HUD on läpikuultava kerros elävän 3D-maailman päällä
- Yksi maailma ja yksi kamera: nousuhetki on kameran liike ja kortti, ei uusi
  näkymä tai sivu
- Ei esikuvapelien nimiä, ikoneita eikä ulkoasua

## 7. Mitä tuotetaan

1. Näkymät 1–2 (tavoite ja nousuhetki) kahtena suuntana, mobiili ja työpöytä.
   Valinta tehdään ennen jatkoa.
2. Näkymät 3–8 valitulla suunnalla
3. Kuvakkeet SVG:nä yllä olevilla tiedostonimillä
4. Tasojen sävyt CSS-muuttujina
