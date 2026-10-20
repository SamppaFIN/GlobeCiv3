# GlobeCiv3 — diplomatia

> Samin linjaus 2026-10-20: "Diplomatia määrää. Voi jakaa kartat ja tehdä teknologia- ja
> resurssivaihtoja, sodankin voi julistaa. Diplomatiaruutu kertoo kaiken, mitä vihollisesta
> tai liittolaisesta tiedetään ja mitä sen kanssa voi tehdä." Kilpailijan toimintaa ohjaa
> asenne (Samin valinta). Säännöt ja luvut ovat omia. Civ I:n diplomatiasta ei lainata
> mitään, eikä Freecivin diplomatiakoodia käytetä.

## Malli

- **Tapaaminen.** Kilpailija on tavattu, kun pelaajan kartalla näkyy sen kaupunki.
  Diplomatiaruutu avautuu tavatuille kilpailijoille luettelon Diplomatia-välilehdeltä ja
  kilpailijan kaupungin ruudun kortista.
- **Suhde** on rauha, sota tai liitto. Tavattaessa suhde on rauha.
- **Asenne** on −100…100 ja alussa 0. Ruutu näyttää asenteen sanoin ja kertoo syyt.

| Syy | Vaikutus |
|---|---|
| Rajat lähellä: pelaajan kaupunki enintään 8 ruudun päässä kilpailijan kaupungista | −1 päivässä |
| Pelaaja julistaa sodan | −50 |
| Sota jatkuu | −1 päivässä |
| Liitto | +1 päivässä |
| Hyväksytty vaihto tai jaetut kartat (STORY-078) | +10 |
| Rauhassa ilman rajoja | kohti nollaa 1 joka viides päivä |

Asenteen sanat: vähintään 50 ystävällinen, vähintään 20 myönteinen, yli −20 varautunut,
yli −50 epäluuloinen, muuten vihamielinen.

## Kilpailijan päätökset (päivittäin)

- Rauhassa se julistaa sodan, kun asenne on enintään −50 ja sen sotilaita on enemmän kuin
  pelaajan sotilaita sen lähellä olevissa kaupungeissa.
- Rauhassa se ehdottaa liittoa, kun asenne on vähintään 60.
- Sodassa se ehdottaa rauhaa, kun sota on kestänyt 20 päivää ja se on menettänyt
  kaupungin tai asenne on noussut vähintään −40:een.
- Pelaajan ehdotukset se hyväksyy näin:
  - **rauha:** sota on kestänyt vähintään 10 päivää, ja asenne on vähintään −60 tai se on menettänyt kaupungin
  - **liitto:** asenne on vähintään 50
  - **vaihto (STORY-078):** vaihto on reilu, ja asenne on vähintään −20

## Sota (STORY-077, Sami 2026-10-20: kaupunki siirtyy)

- Kilpailija tutkii puolella kaupastaan ja aloittaa hyökkääjien keksinnöistä
  (Pronssityö, Ratsastus, Aakkoset, Muuraus, Pyörä, Rautatyö …).
- Sodassa kilpailija valitsee kohteeksi pelaajan kaupungin, joka on lähimpänä sen
  pääkaupunkia. Sen kaksi kaupunkia lähimpänä kohdetta rakentavat parasta tuntemaansa
  hyökkääjää, kunnes joukko odotusarvoisesti riittää. Joukko kokoontuu, marssii ja
  hyökkää kuten Kenraalin joukko: Freecivin civ1-taistelu A/(A+D).
- Puolustajat kaatuvat yksi kerrallaan. Valloitettu kaupunki siirtyy voittajalle ja
  menettää asukkaan, ja koon 1 kaupunki tuhoutuu (Freeciv). Menetetyn kaupungin tukemat
  yksiköt lähtevät (oma). Jos pääkaupunki menetetään, suurin jäljellä oleva kaupunki
  tulee pääkaupungiksi.
- Kun pelaajan viimeinen kaupunki menetetään, peli päättyy, ja tallennus poistetaan.
- Sodassa Kenraali voi valita kohteeksi kilpailijan kaupungin. Kilpailijan menettämät
  kaupungit lasketaan rauhan ehtoon.

## Storyt

| Story | Sisältö |
|---|---|
| STORY-076 | Diplomatia: tapaaminen, suhteet, asenne syineen, diplomatiaruutu ja julistukset ja ehdotukset kumpaankin suuntaan |
| STORY-077 | Sota kilpailijoita vastaan: sodassa kilpailijan Kenraali rakentaa joukon ja hyökkää, pelaajan Kenraali voi valita kohteeksi kilpailijan kaupungin, ja valtaukset |
| STORY-078 | Vaihdot: karttojen jakaminen, kilpailijoiden tutkimus ja keksintöjen vaihto sekä resurssilajien vaihto |

## Avoimet kysymykset (kysytään, kun story on vuorossa)

- Jakaako liitto näkyvyyden tai sotaretket (yhteinen vihollinen)?
- Miten vaihdon reiluus arvioidaan: keksinnön hinta tieteenä, resurssilaji ja kulta?
