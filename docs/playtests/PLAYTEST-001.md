# PLAYTEST-001 — 2026-11-19

- Osoite: https://samppafin.github.io/GlobeCiv3/?seed=42
- Siemen: 42
- Testaaja: Inanna 🦁 (Claude Sonnet 5.5, pilviajo)
- Persoonat: Uusi pelaaja puhelimella (384 × 824), Rakentaja (1280 × 800), Valloittaja (1280 × 800)

## Yhteenveto

Peli näyttää hyvältä ja ensiminuutit ovat lupaavat: kaupunki 3D-näkymässä, neuvonantajan valinta ja kaupunkikortti, joka kertoo suoraan, miten kaupunki kasvaa. Ongelma on se, mitä tapahtuu seuraavaksi. Peli pysäyttää itsensä korteilla (kaupunkipaikkaehdotus, rosvot) noin 10–14 pelipäivän välein, ja nämä kortit toistuvat lähes samanlaisina. Samaan aikaan tasot aukeavat nopeasti (kaupunkialue päivänä ~23–31, lääni/valtio päivänä ~95) ja uusia järjestelmiä tulee yksi toisensa perään. Tavoitepalkki ei pysy mukana: se väittää "Kasvata kaupunki kokoon 2" vielä, kun asiat ovat edenneet pitkälle. Kuollutta aikaa ei ollut, ongelma on toisinpäin: pelaaja on enimmäkseen korttien kuittaaja, ei päättäjä. Valloittajalle ei ollut yhtään vastustajaa 100 päivässä.

## Arviot

| | Uusi pelaaja puhelimella | Rakentaja | Valloittaja |
|---|---|---|---|
| Selkeys | 3 — Alku selkeä (neuvonantaja, kaupunkikortti), mutta tavoitepalkki ja kortit ehtivät ristiin ja karttanäkymä vaihtuu itsestään | 3 — Kaupunkikortti selittää kasvun hyvin, mutta Ruoka-valinta ei näkynyt luvuissa | 2 — Ei näkynyt, mitä pitäisi tehdä: ei vastustajia, ei hyökkäystä, tavoite "Kehitä maata" on abstrakti |
| Tahti | 2 — Tasot ja kortit tulevat tiheästi, ~12 uutta asiaa 20 toiminnossa | 3 — Rauhallinen alku, sitten jatkuvia keskeytyksiä | 2 — Pelin pysäytyskortit syövät nopeutuksen hyödyn (20 s oikeaa aikaa = 3 pelipäivää) | 
| Valintojen merkitys | 3 — Neuvonantajan valinnalla ja soturilla oli seuraus, paikkaehdotuksella ei pelaajan kannalta | 2 — Ruoka/Tasapaino/Tuotanto ei muuttanut lukuja; kassa 724–840 kultaa kertyi ilman käyttöä | 2 — Ainoa valinta on "rakenna soturi" tai luota; rosvojen todennäköisyys pysyi 53 %, vaikka soturit lisääntyivät | 
| Palkitsevuus | 3 — Kaupunkikasvu ja uudet kaupungit näkyvät kartalla, tason avautuminen on näkyvä palkinto | 3 — Kaupungin kasvu ja renkaat näkyvät; pääkaupunki kutistui koosta 2 kokoon 1 selittämättä | 2 — Mikään ei vaikuttanut valloitukselta | 
| Halu jatkaa | 2 — Lopettaisin kortti- ja tasotulvaan | 3 — Haluaisin ymmärtää talouden, mutta kulta ja kuvernöörit tekevät kaiken | 2 — Ei kohdetta, ei halua jatkaa | 

## Missä peli muuttuu sekavaksi

Puhelimella, persoona 1, toimintojen #8–#20 aikana (päivät 18–95). Pelkästään ensimmäisten 20 toiminnon aikana vastaan tuli noin 12 uutta asiaa: neuvonantajakortti, HUD ja nopeusnapit, tavoitepalkki + taso-mittari, kaupunkipaikkaehdotus, kaupunkikortti (ruoka, kansalaiset, rakennusluettelo), "Kansa tutkii" -ilmoitukset, "Tutkittu: kukkuloiden resurssi on Hiili · Rautatyö avautui", kaupunkialue-avautumiskortti, uusi kaupunki Kivisalmi (kortti vaihtui kesken lukemisen), rosvokortti, Lääni → Valtio -avautuminen ja lääni-sirut (Tutki/Asuta/Ohita, retkikunta). Pahin hetki oli toiminto #19 (päivä 95): "Lääni kartoitettu, zoomaa ulos" -kortti ilmestyi kaupunkikortin päälle, samalla HUD vaihtoi tason "Valtio" ja ilmoitus "Tuulikallio rakensi: Uudisasukas" näkyi. Kaikki kolme tapahtui samalla sekunnilla. Tässä hallinta karkasi.

Työpöydällä (persoona 2) sama näkyi päivänä 31: avautumiskortti ja kaupunkipaikkaehdotus tulivat päällekkäin.

## Persoona 1: Uusi pelaaja puhelimella

### Aikajana

| # | Päivä | Mitä tein | Mitä odotin | Mitä tapahtui | Kuva |
|---|---|---|---|---|---|
| 1 | 0 | Napautin Uusi peli | Peli alkaa | Aloitusnäyttö → lento kaupunkiin | shots/PLAYTEST-001-p1-01.webp |
| 2 | 1 | Näin neuvonantajakortin | Selkeä alku | Kortti heti päivänä 1 ja HUD, tavoite "Valitse tutkimus", palkki "Rakenna ensimmäinen rakennus" — ei selvää, mitä tutkimus on | shots/PLAYTEST-001-p1-02.webp |
| 3 | 2 | Valitsin Kasvattaja | Kortti sulkeutuu, näen kaupungin | Peli oli jo mennyt päivään 2 ja pysähtynyt kaupunkipaikkaehdotukseen; kamera hyppäsi pois kaupungista | shots/PLAYTEST-001-p1-03.webp |
| 4 | 3 | Valitsin Rakenna kaupunki tänne | Kaupunki ilmestyy | Neuvonantajakortti tuli uudelleen eteen (valinta ei ollut tallentunut, vaikka klikkasin) | shots/PLAYTEST-001-p1-04.webp |
| 5 | 7 | Valitsin Kasvattaja uudelleen | Kortti sulkeutuu | Valinta korostui, kortti jäi auki, päivä 7 | shots/PLAYTEST-001-p1-05.webp |
| 6 | 11 | Suljin kortin | Näen kaupungin | Kamera kaukana kaupungista, HUD leikkautuu ("Päivä 11" katkeaa reunasta), mitään ei tapahdu | shots/PLAYTEST-001-p1-06.webp |
| 7 | 14 | Avasin luettelon | Löytää kaupungin | Luettelo (Kaupungit, Yksiköt, Talous, Diplomatia) — neljä välilehteä kerralla | shots/PLAYTEST-001-p1-07.webp |
| 8 | 18 | Avasin Aamurannan | Ymmärrän kaupungin | Kaupunkikortti: koko, ruoka, työstävät, kasvuvihje — selkeä ja hyödyllinen | shots/PLAYTEST-001-p1-08.webp |
| 9 | 23 | Vierittelin korttia | Näen Rakenna-listan | Rakennusluettelo, päälle "Kaupunkialue avautui" -kortti | shots/PLAYTEST-001-p1-09.webp |
| 10 | 27 | Zoomaa ulos -nappi | Kartta pienenee | Kamera lensi ulos, mutta kaupunkikortti jäi auki kartan päälle | shots/PLAYTEST-001-p1-10.webp |
| 11 | 31 | Vieritin korttia ylös | Sulkeutuuko? | Kortti vaihtui toiseksi kaupungiksi (Kivisalmi); ilmoitus "Tutkittu: kukkuloiden resurssi on Hiili · Rautatyö avautui" | shots/PLAYTEST-001-p1-11.webp |
| 12 | 32 | Suljin kortin | Näen kartan | Peli pysähtyi uuteen kaupunkipaikkaehdotukseen | shots/PLAYTEST-001-p1-12.webp |
| 13 | 33 | Rakenna kaupunki tänne | Kaupunki | Kaksi kaupunkia kartalla, selkeä ja palkitseva kuva | shots/PLAYTEST-001-p1-13.webp |
| 14 | 53 | 4× ja odotus 10 s | Kaupunki kasvaa | Päivä 53, uusi paikkaehdotus pysäytti pelin | shots/PLAYTEST-001-p1-14.webp |
| 15 | 64 | Ehdotus hyväksytty, odotus | Jotain muuta | Taas ehdotus (päivä 64) | shots/PLAYTEST-001-p1-15.webp |
| 16 | 68 | Painoin "Myöhemmin" | Ehdotus pois | Rosvokortti pysäytti pelin | shots/PLAYTEST-001-p1-16.webp |
| 17 | 84 | Rakenna soturi | Turva | Seuraava rosvokortti toiselle kaupungille | shots/PLAYTEST-001-p1-17.webp |
| 18 | 90 | Rakenna soturi | Turva | "Aamuranta kasvoi kokoon 2" + uusi paikkaehdotus | shots/PLAYTEST-001-p1-18.webp |
| 19 | 95 | Myöhemmin | Jatkuu | "Lääni kartoitettu, zoomaa ulos" ja tavoite muuttui Valtio-tasolle, kolme asiaa yhtä aikaa | shots/PLAYTEST-001-p1-19.webp |
| 20 | 101 | Zoomaa ulos | Kartta | Zoomaus onnistui, heti uusi ehdotus | shots/PLAYTEST-001-p1-20.webp |
| 21 | 105 | Myöhemmin | Ehdotus pois | Rosvokortti, nyt 2 rosvoa | shots/PLAYTEST-001-p1-21.webp |
| 22 | 112 | Rakenna soturi | Turva | Taas paikkaehdotus | shots/PLAYTEST-001-p1-22.webp |
| 23 | 12x | Hylkäsin ehdotuksen | Rauha | Lääni-näkymä: sirut Tutki/Asuta/Ohita, retkikunta; sirujen nimilaput peittävät HUDia; tavoite "Tee ensimmäinen keksintö" | shots/PLAYTEST-001-p1-23.webp |

### Hämmennyksen hetket
- #3–#5: neuvonantajavalinta tuntui epäonnistuvan, kortti palasi kahdesti. Vasta kolmannella kerralla valinta korostui.
- #6: kamera jätti kaupungin ruudun ulkopuolelle ja HUDin päiväteksti leikkautui oikeasta reunasta.
- #9–#11: kortit pinoutuvat päällekkäin (rakennusluettelo, avautumiskortti, uusi kaupunki), ja kaupunkikortti vaihtui itsestään toiseen kaupunkiin.
- Tavoitepalkki "Kasvata kaupunki kokoon 2" näkyi vielä päivinä 33–90, vaikka pelaaja oli tehnyt jo paljon muuta. Peli ei kertonut, miksi tavoite ei edennyt.
- Sanasto: "Tutkittu: kukkuloiden resurssi on Hiili · Rautatyö avautui tutkittavaksi" ei kerro uudelle pelaajalle mitään.
- Ohjetta (README) en avannut.

### Kuollut aika
Ei kuollutta aikaa. Päinvastoin: yli 12 pysäytyskorttia 120 päivässä.

### Mikä toimi
- Kaupunkikortin kasvuselitys ("Kasvaa hitaasti: valitse Ruoka, kastele peltoja, rakenna viljavarasto") on loistava: kertoo mitä tehdä.
- Kartta, jossa kaupungit ja rajat kasvavat, ja taso-avautuminen näkyvät palkitsevina.
- Kaupunkitason 3D (matalapolygoni-puut ja rakennukset) on kaunis.
- Aloitusnäytön pallo ja Jatka/Uusi peli -vahvistus (tallennus korvataan) on selkeä.

### Lopetuskohta
Toiminto #19–#20 (päivä 95–101). Pelaaja olisi lopettanut ensimmäisen kahden minuutin jälkeen, koska kolme korttia ja kaksi tasonvaihtoa tulivat yhtä aikaa eikä hän tiennyt, mitä tavoite "Kehitä maata" tarkoittaa. Ei kuollut aika, vaan hukkuminen.

## Persoona 2: Rakentaja

### Aikajana

| # | Päivä | Mitä tein | Mitä odotin | Mitä tapahtui | Kuva |
|---|---|---|---|---|---|
| 1–2 | 0 | Uusi peli ja vahvistus ("Aloita alusta, tallennus korvataan") | Uusi peli | Alkuvideo ja neuvonantajakortti, Oma ohjaus oletuksena | shots/PLAYTEST-001-p2-03.webp |
| 3–4 | 2 | Suljin kortin, painoin taukoa | Näen kaupungin | Kamera hyppäsi pois, kaupunkipaikkaehdotus päivänä 2 | shots/PLAYTEST-001-p2-04.webp |
| 5 | 3 | Myöhemmin | Palaan kaupunkiin | Kamera jäi aluekarttaan, kaupunki piilossa HUDin alla | shots/PLAYTEST-001-p2-05.webp |
| 6 | 9 | Luettelo | Kaupunki | Aamuranta: "Saha · 7 pv" | shots/PLAYTEST-001-p2-06.webp |
| 7 | 14 | Avasin kaupungin | Ymmärrän kasvun | Selkeä kortti, vihje "valitse Ruoka" | shots/PLAYTEST-001-p2-07.webp |
| 8 | 22 | Valitsin Ruoka | Ruoka nousee | Kaupunki kasvoi koon 2 päivänä 22 (rengasanimaatio); tavoite "Kehitä maata" | shots/PLAYTEST-001-p2-08.webp |
| 9 | 27 | Valitsin Tiedustelijan | Rakennus alkaa | Lupaus: valmis 3 pv, toimi | shots/PLAYTEST-001-p2-09.webp |
| 10 | 31 | 4× | Nopeutus | Avautumiskortti ja paikkaehdotus päällekkäin | shots/PLAYTEST-001-p2-10.webp |
| 11 | 31 | Zoomaa ulos | Alue näkyviin | Selkeä aluekartta | shots/PLAYTEST-001-p2-11.webp |
| 12 | 46 | Hyväksyin ehdotuksen, napautin ruutua | Ruudun tiedot | Ruutukortti hyvin informatiivinen (tuotto, kaupungin tuotto, korkeus) | shots/PLAYTEST-001-p2-12.webp |
| 13 | 48 | Napautin kaupunkia | Kaupunkikortti | Peli pysähtyi uuteen ehdotukseen, klikkaus meni ohi | shots/PLAYTEST-001-p2-13.webp |
| 14–15 | 62–68 | Hyväksyin, hylkäsin | Rauha | Ehdotus, sitten rosvokortti | shots/PLAYTEST-001-p2-14.webp, p2-15.webp |
| 16 | 80 | Rakenna soturi | Turva | "Soturi torjui rosvon · Aamuranta" — hyvä palaute; heti uusi ehdotus | shots/PLAYTEST-001-p2-16.webp |
| 17–18 | 84–101 | Luota puolustukseen | Rosvo hyökkää | Lopputulos jäi näkemättä, peli eteni; "Hopealahti rakensi: Soturi" | shots/PLAYTEST-001-p2-17.webp, p2-18.webp |
| 19 | 106 | Tauko, luettelo | Yleiskuva | Aamuranta "Koko 1" (oli 2): uudisasukas vei asukkaan, ei selitetty; Kivisalmi koko 3 | shots/PLAYTEST-001-p2-19.webp |
| 20–22 | 106 | Avasin Kivisalmen, valitsin Ruoka | Ruoka nousee | Luvut samat (+1 ruoka, +8 tuotanto) ennen ja jälkeen, vihjeteksti vaihtui | shots/PLAYTEST-001-p2-20.webp, p2-21.webp, p2-22.webp |
| 23 | 112 | Jatkoin 1×, odotin | Kasvu | Kasvuaika 30 → 24 pv, ruoka sama; Kassa 724 → 840 kultaa, eikä käyttöä | shots/PLAYTEST-001-p2-23.webp |
| 24 | 117 | Tauko | Rauha | Rosvokortti, "Soturi voittaa 53 %" vaikka kaupungissa oli kaksi sotilasta | shots/PLAYTEST-001-p2-24.webp |

### Hämmennyksen hetket
- #20–#23: Ruoka-painotus ei muuttanut mitään luvuissa. Rakentaja ei tiedä, onko valinta merkityksetön vai vain tiedossa jostain muusta syystä.
- Kassa kasvaa nopeasti (840 kultaa päivänä 112, +8 pv), mutta en löytänyt, mihin sen voisi käyttää. Kaupungit tekevät "Kultaa" rakennettuaan soturin.
- Pääkaupunki kutistui 2 → 1 ilman selitystä (uudisasukkaan hinta).
- Soturin voittotodennäköisyys 53 % ei muuttunut, kun kaupungissa oli 2 soturia.
- Kamera hyppää pois kaupungista aina ehdotuksen jälkeen, joten rakentamisen vaikutusta ei näe.

### Kuollut aika
Ei. Mutta Rakentaja ei saa hetkeäkään katsoa kaupunkiaan rauhassa: aina on ehdotus tai uhka.

### Mikä toimi
Kasvuvihje, rakennusluettelo (hinta, valmistumisaika, vaatimukset), "Soturi torjui rosvon" -palaute ja kaupungin rengasanimaatio kasvaessa.

### Lopetuskohta
Toiminto #24 (päivä 117): kassa kasvaa ilman käyttöä, painotuksen valinta ei vaikuta luvuissa ja kaupunkia ei näe rakentuvan. Rakentaja siirtyisi toiseen peliin.

## Persoona 3: Valloittaja

### Aikajana

| # | Päivä | Mitä tein | Mitä odotin | Mitä tapahtui | Kuva |
|---|---|---|---|---|---|
| 1–2 | 0 | Uusi peli, vahvistus | Toimintaa | Neuvonantajakortti | shots/PLAYTEST-001-p3-03.webp |
| 3–5 | 1–26 | Kartoittaja, suljin, 4× | Nopea laajentuminen | Päivä 26: avautumiskortti + tiedepilli + uudisasukaskortti (Asuta/Kehitä) + ilmoitus samaan aikaan | shots/PLAYTEST-001-p3-06.webp |
| 6–7 | 32 | Zoomaa ulos | Kartta | Heti paikkaehdotus | shots/PLAYTEST-001-p3-07.webp |
| 8–9 | 54 | Hyväksyin, luettelo | Valtiot | Näin Tuulikallion kortin, 4× jatkui | shots/PLAYTEST-001-p3-09.webp |
| 10–12 | 62–66 | Luettelo → Diplomatia | Vastustajat | "Ei vielä tavattuja kilpailijoita. Kilpailija tavataan, kun sen kaupunki näkyy kartalla." | shots/PLAYTEST-001-p3-13.webp |
| 13–16 | 67–90 | 4×, rosvokortit | Hyökkäys | Kolme rosvokorttia 25 päivässä, ei vihollisia | shots/PLAYTEST-001-p3-14.webp, p3-15.webp, p3-16.webp |
| 17–19 | 93–104 | Soturi, hyväksy, 4× 20 s | Sota | 20 s oikeaa aikaa = 3 pelipäivää (pysäytyksiä); neljäs rosvokortti | shots/PLAYTEST-001-p3-17.webp, p3-18.webp |

### Hämmennyksen hetket
- Toiminto #5 (päivä 26): neljä asiaa yhtä aikaa.
- Nopeutus 4× ei tuntunut nopeutukselta, koska pysäytyskortit söivät sen.
- Ei mitään, minkä kimppuun voisi käydä: tavoite "Kehitä maata", ei vihollista, ei hyökkäysyksiköitä kartalla.
- Sama paikkaehdotus ("Kotialue", ruokaa 29) tuli useasti.

### Kuollut aika
Ei ollut kuollutta aikaa mutta ei myöskään mitään tekemistä. 100 päivää ja yksikään kortti ei liittynyt valloitukseen. Päivä 62–66 Diplomatia-välilehti kertoi vain, ettei kilpailijoita ole.

### Mikä toimi
Diplomatia-välilehden selkeä viesti ("kilpailija tavataan, kun sen kaupunki näkyy kartalla") kertoo, mitä pitäisi tehdä. Se oli ainoa viesti, joka antoi Valloittajalle suunnan.

### Lopetuskohta
Toiminto #19 (päivä 104): viidennen rosvokortin jälkeen Valloittaja olisi sulkenut pelin, koska 100 päivää ei ole tuonut yhtään vastustajaa tai hyökkäysmahdollisuutta.

## Kolme tärkeintä korjausta

1. **Pelin pysäyttävät kortit tulevat liian usein ja ovat liian samanlaisia.** Kaupunkipaikkaehdotus ja rosvokortti pysäyttivät pelin noin 12 kertaa ~120 päivässä kaikilla persoonilla, ja usein kortti oli sama kuin edellinen. Pelaajan pitäisi kokea, että peli etenee rauhassa ja pysähtyy vain kerran silloin, kun jokin on oikeasti uutta (esimerkiksi ensimmäinen kaupunkipaikka ja ensimmäinen rosvo). Myöhemmät ehdotukset voisivat olla pieni ilmoitus ilman pysäytystä (kuvat shots/PLAYTEST-001-p1-14.webp, p1-15.webp, p1-17.webp, p3-14.webp, p3-16.webp, p3-18.webp).
2. **Tasot, tavoitteet ja kortit ehtivät päällekkäin, eikä tavoitepalkki pysy mukana.** Tason avautumiskortti ilmestyy kaupunkikortin, uudisasukaskortin ja ilmoituksen päälle (shots/PLAYTEST-001-p1-19.webp, p3-06.webp, p2-10.webp), ja tavoite "Kasvata kaupunki kokoon 2" jää näkyviin vaikka pelaaja on jo edennyt. Pelaajan pitäisi nähdä aina yksi tavoite, jonka edistymisen hän näkee, ja kun jokin uusi taso aukeaa, muut kortit odottavat vuoroaan.
3. **Valinnoilla ja kassalla ei näytä olevan seurausta, eikä Valloittajalla ole mitään tekemistä.** Ruoka/Tuotanto-painotus ei muuttanut lukuja (shots/PLAYTEST-001-p2-22.webp, p2-23.webp), kassa kasvoi yli 800 kultaan ilman käyttöä, rosvokortin 53 % ei muuttunut soturimäärän mukaan ja vastustajia ei näkynyt 100 päivään (shots/PLAYTEST-001-p3-13.webp). Pelaajan pitäisi nähdä heti valintansa jälkeen luvun muuttuvan (esimerkiksi ruoka +1 → +2), saada kullalle selkeä käyttö ja nähdä vastustaja kartalla ennen ensimmäistä sataa päivää.

## Rajoitukset

- Puhelin emuloitiin pelkällä ikkunan koolla (384 × 824), ilman kosketustapahtumia ja nipistystä. Korttien vieritys ja kartan zoomaus tehtiin hiiren rullalla, ei sormella. Napautukset tehtiin hiirellä koordinaatteihin.
- Selain pyörii ilman näytönohjainta, joten piirto oli hidasta, ja peli eteni ohitseni toimintojen välillä (usein 3–10 pelipäivää). Pelipäivät on kirjattu HUD:sta sillä hetkellä, kun ruutukuva otettiin.
- Tekoälyn reaktioaika on ihmistä hitaampi, joten rosvojen ja ehdotusten määrä aikayksikköä kohti voi olla ihmiselle hieman pienempi. Pelipäivissä mitattuna ne ovat silti samat.
- Ensimmäisessä persoonassa jotkin napautukset osuivat kortteihin, jotka olivat jo vaihtuneet, joten toimintojen lukumäärä (#) ei vastaa tarkasti pelaajan aikaa.
- README:tä ei avattu kertaakaan.
- Rakentajalla ja Valloittajalla ei tapahtunut täyttä 35 toimintoa (Rakentaja ~24, Valloittaja ~19): lopetuskohta saavutettiin ennen sitä.
- Planeettataso ja valtiotason toiminnot jäivät pelaamatta: valtiotasolle ei ehditty päivän ~125 jälkeen.
- Taistelua rosvoja vastaan ei nähty loppuun asti, koska peli eteni ennen tulosta.
