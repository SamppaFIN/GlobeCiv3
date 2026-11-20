# PLAYTEST-002 — 2026-11-20

- Osoite: https://samppafin.github.io/GlobeCiv3/?seed=42
- Siemen: 42
- Testaaja: Inanna 🦁 (Claude Sonnet 5.5)
- Persoonat: Uusi pelaaja puhelimella, Rakentaja, Valloittaja

## Yhteenveto

Alku on nyt selvästi parempi kuin ennen: tervetulokortti, kolmen neuvonantajan valinta ja kolmen kortin kierros kertovat nopeasti, mitä pelissä tehdään, ja ensimmäinen taso (työmaat, varasto, ensimmäinen tiedustelija) etenee päivässä 12–54 selkeästi. Rakentajalle ketju "lankut ja kivi -> rakennus -> varasto muuttuu" on näkyvä ja palkitseva. Peli kuitenkin hajoaa heti kaupunkialueen avautumisen jälkeen: kolmatta kaupunkia ei saa perustettua, koska kaupunkipaikan vihje nimeää paikan mutta ei näytä sitä, uudisasukas jää jumiin ehtoon "vaatii koon 2" kaupungissa, joka ei kasva (ruoka +0), ja rosvot ryöstävät pääkaupungin päivän 71 ja 280 välillä riippumatta siitä, mitä pelaaja tekee. Yksikään persoona ei päässyt tasolta 2 ylöspäin, eikä vastustajia nähty lainkaan, joten Valloittajalla ei ollut mitään tekemistä.

## Arviot

| | Uusi pelaaja puhelimella | Rakentaja | Valloittaja |
|---|---|---|---|
| Selkeys | 3 — alku selkeä (päivään 14), sitten en löytänyt kaupunkipaikkaa enkä tiennyt, miksi 3. kaupunki ei synny | 4 — kortit kertovat kustannukset ja vaikutukset; jumi uudisasukkaassa selittämätön | 3 — alku selkeä, mutta tavoite "perusta kolme kaupunkia" ei etene eikä sotaa näy |
| Tahti | 2 — päivään 14 hyvä, sen jälkeen puhelimella pitkä tyhjä jakso (päivät 147–282) | 3 — hyvä päivään 55, sitten odottelua uudisasukasta | 2 — nopea alku, sitten 150 pelipäivää ilman tehtävää |
| Valintojen merkitys | 2 — neuvonantajan valinnalla ei näkynyt eroa, soturin rakennus ei estänyt ryöstöä | 4 — rakennusjärjestyksellä oli väliä; soturi torjui rosvot (toast päivänä 82) | 2 — Vartija ei näkynyt missään; mitään hyökättävää ei ollut |
| Palkitsevuus | 3 — tason avautumiskortti ja kaupunki palkitsivat, sen jälkeen ei mitään | 4 — varasto, kassa ja koko muuttuivat näkyvästi | 2 — tason nousu oli ainoa palkinto |
| Halu jatkaa | 2 — lopettaisin päivän ~150 paikkeilla | 3 — jatkaisin, jos 3. kaupunki saataisiin liikkeelle | 2 — lopettaisin, koska ei ole vastustajaa |

## Missä peli muuttuu sekavaksi

Taso 1 (kaupunki) on selkeä: ensimmäisten 20 toiminnon aikana vastaan tuli uusia asioita noin 9 (tervetulokortti, neuvonantajavalinta, kolmen kortin kierros, nopeusnapit, tavoitepaneeli, rakennusilmoitus, tason avautumiskortti, kaupunkipaikkakortti, kaupunkialueen heksakartta). Se on paljon, mutta kortit tulevat yksi kerrallaan ja jokaisessa on yksi selkeä nappi.

Hallinta karkaa tason 2 avautuessa:
- Puhelin, toiminto #9–10 (päivä 13–14): kaupunkialue avautuu ja heti perään kaupunkipaikkakortti. Kaksi isoa korttia peräkkäin.
- Puhelin, #11–14 (päivä 71–165): rosvokortti pysäyttää pelin, kaupunki 2 syntyy, ja sen jälkeen näytön ylälaidassa vilkkuu vihje "Kaupunkipaikka: Etelämetsä · napauta ruutua, niin uudisasukas lähtee". Paikkaa ei korosteta kartalla eikä kamera siirry sinne. Napautin, mitä luulin paikaksi, ja sain täysin eri ruudun kortin ("Uudisasukas: ei kaupunkia: valtio on lukossa"), joka kuulosti virheeltä.
- Rakentaja, #19–23 (päivä 82–234): molemmat kaupungit näyttävät "Uudisasukas valmis huomenna" päivästä 102 päivään 234 ilman että mitään tapahtuu. Luettelossa kaupunkien koko on 1 ja ruoka +0; uudisasukas "vaatii koon 2". Pelaajalle ei kerrota, että kaupunki ei kasva eikä uudisasukas koskaan valmistu.

## Persoona 1: Uusi pelaaja puhelimella

### Aikajana

| # | Päivä | Mitä tein | Mitä odotin | Mitä tapahtui | Kuva |
|---|---|---|---|---|---|
| 1 | 0 | Avasin pelin | Selvän aloituksen | Aloitusnäyttö, yksi iso nappi "Uusi peli" | shots/PLAYTEST-002-p1-01.webp |
| 2 | 1 | Napautin Uusi peli | Peli alkaa | Lento kaupunkiin, tervetulokortti ("Sinä johdat, kansa rakentaa") | shots/PLAYTEST-002-p1-02.webp |
| 3 | 1 | Napautin Valitse neuvonantaja | Jotain valittavaa | Kolme neuvonantajaa selityksineen ja neljäs "Ohjaan itse" | shots/PLAYTEST-002-p1-03.webp |
| 4 | 1 | Valitsin Kasvattajan | Peli alkaa | Kierros 1/3: tavoite ja mittari | shots/PLAYTEST-002-p1-04.webp |
| 5 | 1 | Seuraava | – | Kierros 2/3: nopeus ja tauko | shots/PLAYTEST-002-p1-05.webp |
| 6 | 1 | Seuraava | – | Kierros 3/3: neuvonantajan voi vaihtaa | shots/PLAYTEST-002-p1-06.webp |
| 7 | 1->7 | Aloita; odotin | Jotain näkyvää | Päivä 7: "Aamuranta rakensi: Louhos", mittari 1/2, hehku kaupungin ympärillä | shots/PLAYTEST-002-p1-07.webp |
| 8 | 7->13 | Nopeus 4x | Nopeampaa | Päivä 13: "Kaupunkialue avautuu, zoomaa ulos" -kortti, jossa nipistysohje | shots/PLAYTEST-002-p1-08.webp |
| 9 | 14 | Napautin Zoomaa ulos (nappi, koska en voi nipistää) | Kartta aukeaa | Siisti heksakartta, tiedustelija ja heti kaupunkipaikkakortti | shots/PLAYTEST-002-p1-09.webp |
| 10 | 35 | Rakenna kaupunki tänne | Kaupunki ilmestyy | Uudisasukas kävelee; ilmoitus "Tutkittu: kukkuloiden resurssi on Hiili" | shots/PLAYTEST-002-p1-10.webp |
| 11 | 71 | Odotin | – | Peli pysähtyi: "Rosvoja liikkeellä", Rakenna soturi / Luota puolustukseen | shots/PLAYTEST-002-p1-11.webp |
| 12 | 81 | Rakenna soturi | Rosvot torjutaan | Kaupunki 2 (Kivisalmi) syntyi, kaupunkikortti aukesi itsestään (ei pyydetty) | shots/PLAYTEST-002-p1-12.webp |
| 13 | 147 | Suljin kortin, odotin | Kolmas kaupunki | Vihje "Kaupunkipaikka: Etelämetsä · napauta ruutua", paikkaa ei näy | shots/PLAYTEST-002-p1-13.webp |
| 14 | 165 | Napautin merkkiä, jota luulin paikaksi | Uudisasukas lähtee | Aukesi ruudun kortti "valtio on lukossa" | shots/PLAYTEST-002-p1-14.webp |
| 15 | 177 | Pysäytin pelin ja katsoin | Löytäisin paikan | Ei mitään uutta; kaupunkipaikkaa ei näy | shots/PLAYTEST-002-p1-15.webp |
| 16 | 262 | Jatkoin, odotin | – | Uusi vihje, toinen paikannimi (Koillisniemi), edelleen ei näy | shots/PLAYTEST-002-p1-16.webp |
| 17 | 282 | Napautin vihjettä | Kamera lentää paikkaan | Ei mitään; ilmoitus "Rosvot ryöstävät kaupungin · Aamuranta" | shots/PLAYTEST-002-p1-17.webp |

### Hämmennyksen hetket
- #13–17: vihje nimeää kaupunkipaikan, mutta sitä ei korosteta eikä vihjeestä pääse paikkaan. Paikannimet (Etelämetsä, Koillisniemi) eivät kerro pelaajalle mitään, koska kartalla ei ole nimiä.
- #14: väärän ruudun napautus tuotti kortin, jonka teksti "Uudisasukas: ei kaupunkia: valtio on lukossa" kuulostaa virheeltä.
- #12: kaupunkikortti aukesi itsestään ilman pyyntöä ja peitti puolet näytöstä.
- #11 ja #17: rosvokortti tarjoaa soturin rakentamista ("valmis 2 pv"), mutta ryöstö tuli silti. En nähnyt, miksi soturi ei auttanut.
- #8: ohje "nipistä kahdella sormella" on selvä, mutta Zoomaa ulos -nappi oli pelastus. Emuloinnissa nipistys ei ollut mahdollinen.

### Kuollut aika
Päivät 147–282 (noin 2 minuuttia 4x-nopeudella, mutta reaaliajassa pitkä): ei mitään tehtävää, koska yksi tavoite (kolmas kaupunki) on jumissa. Pelkkä "napauta ruutua" -vihje ei auta.

### Mikä toimi
- Tervetulokortti ja kolme neuvonantajaa selityksineen: ymmärsin heti, että "kansa rakentaa".
- Tavoitepaneeli (mittari 0/2 -> 1/2) ja palkkio "+30 kultaa" näkyvät koko ajan.
- Tason avautumiskortti on dramaattinen ja selkeä, ja Zoomaa ulos -nappi pelasti puhelimella.
- Heksakartta on kaunis ja luettava; tiedustelijan reitti ja ? -merkit kertovat, mitä on tutkimatta.

### Lopetuskohta
Toiminto #14–15, päivä 165–177: kolmatta kaupunkia ei löydy, paikkaa ei saa esiin, eikä mikään muu tarjoa tekemistä. Lopettaisin tässä. Kaksi minuuttia -rajan ylittyi jo kohdassa #13.

## Persoona 2: Rakentaja

### Aikajana

| # | Päivä | Mitä tein | Mitä odotin | Mitä tapahtui | Kuva |
|---|---|---|---|---|---|
| 1 | 0 | Avasin pelin | – | Aloitusnäytössä Jatka-nappi (päivä 265) ja Uusi peli; edellinen peli oli tallessa ja kartoitus näytti 100 % | shots/PLAYTEST-002-p2-01.webp |
| 2 | 0 | Napautin Uusi peli | Uusi peli alkaa | Vahvistus "Aloita alusta, tallennus korvataan" | shots/PLAYTEST-002-p2-02.webp |
| 3 | 1 | Vahvistin | – | Tervetulokortti | shots/PLAYTEST-002-p2-03.webp |
| 4 | 1 | Valitse neuvonantaja -> Ohjaan itse | Kaikki valikot | Valinta sulki kortin, ei näkyvää muutosta | shots/PLAYTEST-002-p2-05.webp |
| 5 | 1 | Ohitin kierroksen, napautin kaupunkia | Rakennusvalikko | Heksan kortti (Metsä), ei rakennuksia | shots/PLAYTEST-002-p2-06.webp |
| 6 | 13 | Napautin kaupunkilappua | Valikko | Pikapaneeli (koko, ruoka, tuotanto) ja nappi Kaupunkikortti | shots/PLAYTEST-002-p2-07.webp |
| 7 | 19 | Kaupunkikortti | Rakennusvalikko | Kortti: ruoka, tuotanto, kauppa, painotus ja varasto | shots/PLAYTEST-002-p2-08.webp |
| 8 | 26 | Vieritin korttia | Rakennuslista | Työmaat Saha/Louhos/Pelto/Mylly/Leipomo kustannuksineen, harmaana ne, joiden ehto puuttuu | shots/PLAYTEST-002-p2-09.webp |
| 9 | 31 | Aloita työmaa: Saha | Saha nousee | Saha valmis ≤5 päivässä, varasto muuttui (lankkuja 2, tukkeja 27) | shots/PLAYTEST-002-p2-10.webp |
| 10 | 40 | Louhos | Kiveä | Louhos valmis, kiveä 4; seuraavat rakennukset aukesivat | shots/PLAYTEST-002-p2-11.webp |
| 11 | 47 | Vieritin alas | Tiedustelija | Rakennettavat yksiköt: Tiedustelija ("avaa seuraavan kartan") | shots/PLAYTEST-002-p2-12.webp |
| 12 | 54 | Tiedustelija | – | Päivä 54: kortti "Kaupunkialue avautuu" | shots/PLAYTEST-002-p2-13.webp |
| 13 | 55 | Myöhemmin, rullasin | Zoom ulos | Kamera zoomasi ulos; kaupunkipaikkakortti (pysäytti pelin) | shots/PLAYTEST-002-p2-14.webp |
| 14 | 66 | Rakenna kaupunki tänne | Kaupunki 2 | Uudisasukas lähti; kamera palasi kaupunkitasolle, ruudulla vihreä "laatta" kesken siirtymän (visuaalinen häiriö) | shots/PLAYTEST-002-p2-15.webp |
| 15 | 71 | – | – | Rosvokortti (1 soturi jo olemassa) | shots/PLAYTEST-002-p2-16.webp |
| 16 | 82 | Rakenna soturi | Torjunta | "Soturit torjuivat 2 rosvoa · Kivisalmi" | shots/PLAYTEST-002-p2-17.webp |
| 17 | 102 | Uudisasukas | 3. kaupunki | Valmiusaika ei kulu: "vaatii koon 2" | shots/PLAYTEST-002-p2-18.webp |
| 18 | 137 | 2x, odotin | – | Rosvoilmoitus; kaupunki ei kasva | shots/PLAYTEST-002-p2-19.webp |
| 19 | 150 | Avasin luettelon | Selitys | Molempien kaupunkien Uudisasukas "valmis huomenna", koko 1, ruoka +0 | shots/PLAYTEST-002-p2-20.webp |
| 20 | 234 | 4x, odotin | – | Edelleen sama; Aamuranta ryöstetty | shots/PLAYTEST-002-p2-21.webp |

### Hämmennyksen hetket
- #4: "Ohjaan itse" ei tuonut esiin mitään uutta; kortti vain sulkeutui. Piti arvata, että valikko löytyy kaupunkilapun kautta (#6–7). Reitti on 3 napautusta ja vieritys.
- #9: sahan rakennusajan vaikutus näkyy vain varastolukuna ("lankkuja 2"), ei kartalla eikä ilmoituksessa.
- #14: siirtymässä kuvaan ilmestyi iso yksivärinen vihreä laatta (renderöintihäiriö).
- #17–20: Uudisasukas "valmis huomenna" 140 pelipäivää. Kaupungin koko 1, ruoka +0, "ei kasva". Ei missään kerrota, että uudisasukas vaatii koon 2.
- #20: kaupunkikortti pysyi auki karttaa vaihtaessa, ja sen vihje (Tiedustelija valmis huomenna) oli vanhentunut.

### Kuollut aika
Päivät 102–234: ei mitään tehtävää. Ainoa tekeminen olisi ollut vaihtaa painotus Ruokaan, mutta siitä ei kerrottu, että se ratkaisisi jumin.

### Mikä toimi
- Rakennuskortin ketju: hinta, tarkoitus ja ehto (esim. "metsurin, sahan ja louhoksen jälkeen") on selvä. Harmaat vaihtoehdot kertovat, mitä seuraavaksi aukeaa.
- Sahan ja louhoksen jälkeen varasto muuttui heti, joten syy ja seuraus näkyvät.
- Rosvot ja soturi: soturin rakentaminen + ilmoitus "Soturit torjuivat 2 rosvoa" on hyvä palkitseva hetki.
- Tason avautuminen päivänä 54 oli nopea ja selkeä.

### Lopetuskohta
Toiminto #20, päivä 234. Kaupunkikoko ei kasva, uudisasukas ei valmistu, ja pääkaupunki ryöstetään kerta toisensa jälkeen. En voi optimoida mitään, kun peli ei kerro, mikä on rikki. Lopettaisin.

## Persoona 3: Valloittaja

### Aikajana

| # | Päivä | Mitä tein | Mitä odotin | Mitä tapahtui | Kuva |
|---|---|---|---|---|---|
| 1 | 1 | Uusi peli -> Vartija | Sotilaita | Kierros 1/3 | shots/PLAYTEST-002-p3-01.webp |
| 2 | 1 -> 12 | Ohitin kierroksen, 4x | Nopeasti eteenpäin | Päivä 12: Kaupunkialue avautuu | shots/PLAYTEST-002-p3-02.webp |
| 3 | 13 | Zoomaa ulos | Vastustajia | Kartta täynnä ? -merkkejä, tiedustelija, kaupunkipaikkakortti | shots/PLAYTEST-002-p3-03.webp |
| 4 | 13 -> 91 | Rakenna kaupunki, odotin | Kaupunki 2 ja armeija | Päivä 91: Kivisalmi koko 4, Aamuranta rakensi uudisasukkaan | shots/PLAYTEST-002-p3-04.webp |
| 5 | 182 | Odotin | Kolmas kaupunki | Vihje "Keskimetsä", Kivisalmi koko 7, ei kolmatta kaupunkia | shots/PLAYTEST-002-p3-05.webp |
| 6 | 211 | Napautin katkoviivarengasta | Kaupunkipaikka | Ruudun kortti (Metsä); "Rosvo kaatoi soturin · Aamuranta" | shots/PLAYTEST-002-p3-06.webp |
| 7 | 258 | Rullasin ulos | Vastustajat | Näkyi vain oma alue ja musta tyhjyys; ei vihollisia | shots/PLAYTEST-002-p3-07.webp |

### Hämmennyksen hetket
- #3–7: ei vastustajia, ei hyökkäysyksiköitä eikä viestiä siitä, milloin sotiminen alkaa.
- #5: sama kuin persoonalla 1: kaupunkipaikan nimi ilman sijaintia.
- #6: Vartija-neuvonantaja valittu, mutta soturi kaatui silti rosvoille; neuvonantajan valinnalla ei näkynyt eroa.

### Kuollut aika
Päivät 91–258: ei tehtävää. Zoomaus ulos (#7) paljasti vain tyhjää; rajattu alue ei kerro, että ylemmät tasot ovat lukossa.

### Mikä toimi
- Kaupunkialueen heksakartta on kaunis, ja tiedustelijan kartoitus on näkyvää etenemistä.
- Kivisalmen kasvu (koko 4 -> 7) ja kultamäärä kaupunkilapussa näyttivät edistystä.
- Nopeutus 4x toimii ja tuntuu nopealta.

### Lopetuskohta
Toiminto #7, päivä 258. Tylsistyin: tavoite on jumissa, eikä kukaan vastusta. Valloittaja ei saa mitään, mitä haluaa.

## Kolme tärkeintä korjausta

1. **Kolmas kaupunki ei synny, ja pelaaja ei näe, miksi.** Vihje "Kaupunkipaikka: Etelämetsä · napauta ruutua" ei osoita paikkaa, ja uudisasukas "valmis huomenna" voi jäädä paikalleen 140 päivää, kun kaupunki ei kasva (ruoka +0, "vaatii koon 2"). Pelaajan pitäisi kokea, että kamera lentää ehdotettuun paikkaan ja korostaa sen, ja että jos jokin estää etenemisen (kaupunki ei kasva), peli sanoo sen suoraan ja ehdottaa korjausta ("Aamuranta tarvitsee ruokaa, jotta uudisasukas valmistuu; vaihda painotus Ruokaan"). Kuvat: p1-13, p1-16, p2-19, p2-20, p2-21.
2. **Rosvot ryöstävät pääkaupungin, vaikka pelaaja reagoi, eikä syy näy.** Rosvokortti lupaa, että soturi auttaa (53 %), mutta ryöstö tulee silti (päivät 211–282), ja neuvonantajan valinnalla (Kasvattaja/Vartija) ei näy eroa. Pelaajan pitäisi kokea, että valmiiksi rakennettu puolustus torjuu rosvot (toast "Soturit torjuivat" oli hyvä), ja että tappion jälkeen peli kertoo, mitä olisi pitänyt tehdä. Kuvat: p1-17, p2-16, p2-17, p3-06.
3. **Kaupunkialueen avautuminen kaataa liikaa kerralla, ja puhelimella ylempää tasoa ei voi koskettaa.** Päivinä 13–14 tulee peräkkäin avautumiskortti ja kaupunkipaikkakortti, minkä jälkeen kaupunkikortti aukeaa itsestään ja peittää puolet ruudusta. Pelaajan pitäisi kokea yksi kortti kerrallaan, selvä seuraava tavoite ("Napauta valittua ruutua") ja kamera, joka ei vie hänen näkymäänsä pois. Lisäksi Valloittaja ei löydä mitään tekemistä (ei vastustajia, ei hyökkäystä): pelin pitäisi kertoa, milloin ja mistä vastustajat tulevat. Kuvat: p1-08, p1-09, p1-12, p3-07.

## Rajoitukset

- Puhelin emuloitiin ikkunan koolla 384 × 824 ilman nipistystä; zoomaus tehtiin Zoomaa ulos -napilla.
- Ohjetta (README) en avannut kertaakaan.
- Pelasin persoonaa kohden noin 17, 20 ja 7 toimintoa, koska jokainen persoona jäi jumiin ennen 50 toimintoa; tästä syystä lääni- ja valtiotasoa ei nähty lainkaan.
- Pelipäivät ovat HUD:sta; osa päivistä on arvioitu odotusajasta, koska aika kulki 4x-nopeudella.
- Kaikki kolme pelasivat samalla siemenellä 42, ja rosvot ilmestyivät päivänä 71 samassa paikassa, joten raportti kuvaa yhtä pelirataa. Valloittajan Kivisalmi (koko 7) kasvoi eri paikassa kuin muiden (koko 1), joten kaupunkipaikka ratkaisee, jumittuuko peli.
- Päivän 280 jälkeistä peliä ei nähty.
