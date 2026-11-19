# GlobeCiv3 — kaupunkitason tuotantoketjut (STORY-088, PLAN-076)

> Suunnitelma 2026-11-20 (Enki). Samin valinnat samalta yöltä: ketjut puu ja vilja,
> kantajat näkyvät ja materiaalit korvaavat tuotannon kaupunkitasolla. L-kokoinen
> story: Anu katselmoi ja Sami hyväksyy ennen toteutusta.

## Tavoite

Kaupunkitaso on oma pelinsä: kansa kaataa puuta, sahaa lankkuja, louhii kiveä ja
leipoo leipää, ja pelaaja näkee kantajien kuljettavan tavaroita rakennuksesta toiseen.
Rakennukset syntyvät lankuista ja kivestä, ja leipä kasvattaa kaupunkia. Ylemmillä
tasoilla kaupunki näkyy entisin luvuin (ruoka, tuotanto ja kauppa), joten
kaupunkialueen ja sitä ylempien tasojen säännöt eivät muutu.

Koskee uutta peliä. Vanha alku (`?classic`) pysyy ennallaan.

## Tavarat ja varasto

Jokaisella pelaajan kaupungilla on varasto: tukit, lankut, kivi, vilja, jauhot,
leipä ja kala. Varasto näkyy kaupunkikortissa määrineen ja päivän virtoineen.
Tallennus saa valinnaisen kentän (`stock`); vanha tallennus saa tyhjän varaston
(sääntö 8).

**Aloitusvarasto:** 7 lankkua ja 2 kiveä. Se on Freeserfin pienin aloitusvarasto
(`src/inventory.cc`, `supplies_template[0]`: lankkuja 7 ja kiveä 2), ja se riittää
täsmälleen metsurin, sahan ja louhoksen rakentamiseen.

## Ketjut

| Rakennus | Maasto | Ottaa | Tuottaa | Lankkuja | Kiveä |
|---|---|---|---|---|---|
| Metsuri (uusi) | metsä tai viidakko | — | tukki | 2 | 0 |
| Saha (muuttuu) | — | tukki | lankku | 3 | 2 |
| Louhos (muuttuu) | kukkula tai vuori | — | kivi | 2 | 0 |
| Pelto (muuttuu) | ruohomaa tai tasanko | — | vilja | 4 | 1 |
| Mylly (uusi) | — | vilja | jauhot | 3 | 1 |
| Leipomo (uusi) | — | jauhot | leipä | 2 | 1 |
| Kalastamo (muuttuu) | ranta | — | kala | 2 | 0 |

Rakennusten lankut ja kivet ovat Freeserfistä (`src/building.cc`, `const_info`:
lumberjack 2/0, sawmill 3/2, stonecutter 2/0, farm 4/1, mill 3/1, baker 2/1 ja
fisher 2/0; Freeserf on GPL-3.0, commit `f537310`). Ketjujen järjestys tukki →
lankku ja vilja → jauhot → leipä on Freeserfin. Kaupungin keskusta on varasto
samaan tapaan kuin Freeserfin linna.

**Omat säännöt** (merkitään koodiin omiksi):

- Jokainen tuottaja tekee yhden tavaran kahdessa päivässä, ja jalostaja muuttaa
  yhden tavaran kahdessa päivässä, jos raaka-ainetta on varastossa.
- Leipä ja kala ovat ruokaa: kumpikin lisää ruokalaatikkoon 2 (yhden asukkaan päivän
  ruoan). Freeserfissä ruoka menee kaivoksille, mutta täällä se kasvattaa kaupunkia.
- Pelto ja kalastamo eivät enää anna +1 ruokaa ruudulle, vaan viljaa ja kalaa.
  Saha ja louhos eivät enää anna +1 tuotantoa, vaan lankkuja ja kiveä. Korkeusbonus
  (STORY-071) siirtyy tuotantonopeuteen: hyvällä korkeudella tuottaja tekee tavaran
  päivässä.
- Rakennus valmistuu, kun sen lankut ja kivet on kannettu työmaalle, ja sen jälkeen
  rakentaminen kestää kaksi päivää.

## Mikä korvautuu ja mikä jää

- Kaupunkitason rakennukset (taulukon seitsemän) maksavat lankkuja ja kiveä, eivät
  tuotantoa. Kaupunkikortin rakennuslista näyttää niille materiaalit.
- Kaupungin ruutujen ruoka, tuotanto ja kauppa (Freeciv) jatkuvat sellaisinaan.
  Tuotanto rakentaa yksiköt ja kaupunkialueen rakennukset (temppeli, viljavarasto ja
  muut), ja ruoka täyttää ruokalaatikkoa kuten ennen. Leipä ja kala tulevat lisäksi.
- Ylemmät tasot näkevät kaupungista samat luvut kuin ennen, ja kaupunkialueen
  neuvonantajat toimivat kuten ennen.

## Kantajat

Jokainen siirto näkyy kaupunkitasolla: kantaja kävelee korkokuvan pintaa pitkin
lähtöruudusta kohteeseen (tuottajalta keskustaan, keskustasta jalostajalle tai
työmaalle) tavara mukanaan pienenä värillisenä laatikkona. Matka kestää noin
päivän pelin kellolla ja nopeutuu pelin nopeuden mukana. Samaan aikaan näkyy
enintään 24 kantajaa, ja ylimenevät siirrot tapahtuvat ilman hahmoa. Vähennetyllä
liikkeellä kantajat eivät kävele, vaan tavara ilmestyy perille.

Kantajat ovat vain kuva: siirto tapahtuu varastossa päivän laskennassa, joten
ruudunpäivitys ei vaikuta peliin (determinismi, sääntö 7).

## Komennot

Rakennuksen valinta on jo komento (`build`). Uusia pelaajan tekoja ei tule;
tuotanto ja siirrot ovat sääntöjä, joita päivän laskenta toteuttaa.

## Neuvonantajat

Kaupunkitason neuvonantajat rakentavat ketjun järjestyksessä metsuri, saha, louhos,
pelto, mylly ja leipomo (Kalastamo rannalla pellon sijaan), ja sitten tiedustelijan,
joka avaa kaupunkialueen. Laajempi kuvernöörin peli on STORY-090:ssä.

## Testit

- Yksikkötestit: varaston kirjanpito (tavarat eivät synny eivätkä katoa siirroissa),
  ketjun eteneminen päivittäin, rakennus valmistuu vasta materiaaleilla, aloitusvarasto
  riittää kolmeen ensimmäiseen rakennukseen, leipä täyttää ruokalaatikkoa ja vanha
  tallennus saa tyhjän varaston.
- E2E: uusi peli, metsuri ja saha valmistuvat, lankkuja syntyy, varasto näkyy
  kaupunkikortissa ja kantajia näkyy kaupunkitasolla (kuvakaappaus).
- Vanhan alun testit pysyvät vihreinä.

## Riskit

- Kaupunkitaso hidastuu, jos kantajia on paljon: enintään 24, ja yksi instanssoitu
  verkko kaikille.
- Alku voi jumittua, jos lankut loppuvat ennen sahaa: aloitusvarasto ja
  neuvonantajien järjestys estävät sen, ja yksikkötesti varmistaa sen.
- Tasapaino (kahden päivän tahti, leivän ruoka-arvo) on arvaus, ja se kalibroidaan
  pelitestillä.
