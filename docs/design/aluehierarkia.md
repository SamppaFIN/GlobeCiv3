# Aluehierarkia: valtio → lääni → kaupunkialue

> Kirjattu 2026-10-09 Samin kuvauksen pohjalta. Luvut ovat Linssin ehdotuksia,
> ja Sami voi muuttaa niitä. Pelimekaniikat ovat aluksi Civilization I:n
> perusmekaniikat (CLAUDE.md, osio 13), ja omat säännöt suunnitellaan erikseen.

## Samin visio

- Suuret heksat ovat **valtion kokoisia**.
- Valtioon zoomatessa näkyvät sen **läänit**, ja läänin alla **kaupungit**.
- Pelaaja **tutkii ja valloittaa alueen Civilization-tyyliin**. Kun alue on
  vallattu, hän voi valloittaa **naapurialueita**, ja niin edelleen.
- **Jokaisella kerroksella on omat toimintonsa.**

## Rakenne

| Kerros | Määrä | Koko (kulma) | Näkyy zoom-tasoilla | Muodostus |
|---|---|---|---|---|
| Valtio | 362 | säde noin 0,12 rad | planeetta (L0–3) | STORY-001:n heksaruudukko |
| Lääni | 7 / valtio → noin 2 500 | säde noin 0,045 rad | L2–6 | keskus + 6 kehällä valtion sisällä |
| Kaupunkialue | 7 / lääni → noin 17 700 | säde noin 0,017 rad | L4–9 | keskus + 6 kehällä läänin sisällä |
| Kaupungin sisus | — | — | L8–17 | maasto, rakennukset ja myöhemmin kansalaiset |

**Sisäkkäisyys on tarkka.** Piste kuuluu ensin lähimpään valtioon, sitten
lähimpään sen valtion lääniin ja sitten lähimpään sen läänin kaupunkialueeseen.
Lääni ei siis koskaan ylitä valtion rajaa, eikä kaupunkialue läänin rajaa.
Alempien keskusten kehä on 0,85 × ylemmän alueen sisäsäde, joten jokainen
keskus on oman yläalueensa sisällä. Sijoittelu on deterministinen siemenestä.

**Rajat piirretään samalla tekniikalla kuin valtiorajat (STORY-012):**
pikseleittäin ruudun paikallisissa koordinaateissa. Valtioraja on kirkkain ja
paksuin, läänin raja ohuempi ja kaupunkialueen raja himmein. Alemmat rajat
häivytetään esiin, kun alue on ruudulla tarpeeksi suuri.

## Kerrosten toiminnot (ehdotus, tarkennetaan pelisuunnittelussa)

| Kerros | Pelaajan toiminnot (Civ I -pohja) |
|---|---|
| Planeetta / valtiot | Yleiskuva, valtioiden tila, kohdevaltion valinta, myöhemmin diplomatia |
| Valtio | Läänien tutkiminen, yksiköiden liikkuminen ja taistelu läänien välillä |
| Lääni | Kaupungin perustaminen (uudisasukas), tiet ja maaston parannukset |
| Kaupunki | Tuotanto, kasvu ja rakennukset (Civ I:n kaupunkinäkymä) |

**Eteneminen:** pelaaja aloittaa yhdestä valtiosta. Valtio on vallattu, kun
kaikki sen läänit ovat pelaajan hallussa. Silloin sen naapurivaltiot
avautuvat (STORY-016).

## Avoimet kysymykset Samille

1. Ovatko 7 lääniä valtiossa ja 7 kaupunkialuetta läänissä hyvät määrät?
2. Onko kaupunki alue (kaupunkialue), vai piste läänin sisällä?
3. Mistä valtiosta peli alkaa: satunnaisesta, valitusta vai siemenen määräämästä?
