# GlobeCiv3 — kaupunkitaso ja uusi alku

> Samin linjaukset 2026-10-20 (avoin kysymys 11, pelattavuuden uudistus). Suunnitelma,
> jota tarkennetaan storyittain. Toteutus on omaa koodia; Settlers-testistä otetaan
> tekniikka (Samin ystävän työ, käyttöön lupa Samin mukaan).

## Samin linjaukset

1. **Kaupunkitaso.** Settlers-testin (argoescobar.github.io/settlers) pinta ja
   maastonmuodostus: korkeuserot ja rakennukset. Siitä tulee kaupunkitaso, mutta
   mekaniikka on omaa.
2. **Pelaaja sijoittaa rakennukset** kaupungin maastoon, ja korkeuserot vaikuttavat.
3. **Uusi alku.** Kaupungin alkupaikaksi arvotaan monipuolinen maasto, jossa on yksi
   erikoisresurssi. Rakennuksia on aluksi vain muutama.
4. **Kuvernööri.** Kaikki toimii valitsemalla kuvernööri. Kuvernööreinä ovat nykyiset
   kolme: Kasvattaja, Kartoittaja ja Vartija.
5. **Seuraava kartta.** Kun kaupunki rakentaa tiedustelijan tai uudisasukkaan,
   pääsee seuraavalle kartalle (kaupunkialuetaso heksaruutuineen).
6. **Resurssit ja tutkimus.** Kansa tutkii alkupaikan erikoisresurssin ja näkee sen
   jälkeen saman lajin resurssit kartalla. Resursseja paljastuu sitä mukaa kuin niitä
   löytyy läänitasolla, ja jokainen löytö avaa uusia tutkimuskohteita.
7. **Resurssin rakennus.** Kun läänitasolla asuttaa uuden resurssin, saa sen
   rakennuksen. Valmis rakennus antaa uuden tutkimuksen, yksikön, bonuksen tai muun
   vastaavan.

## Kaupunkitason tekniikka (Settlers-testistä)

- Kärkipiste jokaisen ruudun keskelle, ja kolmiot naapuriruutujen keskipisteiden
  välille. Pinta on fasetoitu (flatShading), ja kärkivärit tulevat maastosta ja
  liukuvat ruudulta toiselle.
- Korkeus: satunnaiskenttä pehmennetään kuusi kertaa naapureiden keskiarvolla ja
  jaetaan 16 yhtä suureen kaistaan (vesi, ranta, nurmi, vuoret). Meillä korkeus
  tulee pelin omasta maastokentästä ja ruudun maastotyypistä, jotta ruutu näyttää
  siltä, mitä se pelissä on.
- Suunnattu valo ja varjokartta, ympäristövalo, puut ja kivet instansoituina malleina.
  Kamera katsoo vinosti.

## Toteutus GlobeCiv3:ssa

- Sääntö 1: sama maailma, renderöijä ja kamera. Kaupunkitaso on zoomausvyöhyke
  kaupunkialuetason sisällä: kun kamera tulee lähelle kaupunkia, sen alue nousee
  korkeuseroiksi ("maa nousee" -hetki seinäkellon mukaan, sääntö 5). Pelilogiikka
  (napautukset, yksiköt, kortit) pysyy ennallaan.
- Kaupungin alueen ruudut jaetaan pienemmiksi kolmioiksi pallon pinnalla. Verkko
  rakennetaan kaupungin keskipisteen ympärille omalla origollaan (tarkkuus).

## Rakennusten sijoitus (STORY-071, Sami 2026-10-20)

Samin valinnat: korkeus antaa bonuksen, jokaisella rakennuksella on oma paras
paikkansa ylhäällä tai alhaalla, ja kuvernööri sijoittaa rakennuksen ja pelaaja
siirtää sitä. Luvut ovat omia, sillä Civ I:ssä ei ole sijaintibonuksia.

- Rakennus seisoo kaupungin kahden renkaan maaruudulla, ei kuitenkaan keskustassa.
  Ruutuun mahtuu kaksi rakennusta.
- Jyrkkä maa estää rakentamisen: vuorelle rakennetaan vain louhos. Maaston
  rakennukset rakennetaan omalle maastolleen, ja kalastamo rantaan.
- Ylhäällä tarkoittaa vähintään 0,1 ruutuväliä keskustaa korkeammalla, ja alhaalla
  tarkoittaa muuta maata. Korkeus on sama kuin kaupunkitason näkymässä.

| Rakennus | Paras paikka | Bonus |
|---|---|---|
| Temppeli | ylhäällä | +1 tyytyväinen (rauhoittaa kaksi) |
| Kirjasto | ylhäällä | +1 tiede päivässä |
| Pelto | alhaalla | +1 ruoka päivässä (yhteensä +2) |
| Viljavarasto | alhaalla | +1 ruoka päivässä |
| Tori | alhaalla | +1 kauppa päivässä |
| Louhos | vuorella | +1 tuotanto päivässä (yhteensä +2) |

- Kuvernööri sijoittaa jokaisen valmistuneen rakennuksen parhaaseen vapaaseen
  paikkaan, ja jos sellaista ei ole, lähimmäksi keskustaa.
- Pelaaja siirtää rakennusta kaupunkitasolla. Ruudun kortissa on Siirrä-nappi,
  jonka jälkeen sallitut ruudut merkitään (kultainen merkki on paras paikka), ja
  napautus siirtää rakennuksen. Bonus seuraa rakennuksen mukana.
- Muurit ja Suuri muuri kiertävät kaupunkia eivätkä ole ruuduilla.

## Resurssit ja tutkimus (STORY-072, Sami 2026-10-20)

Samin valinnat: resurssit avaavat keksintöjä, ja tutkimaton resurssi näkyy
tuntemattomana merkkinä. Säännöt ovat omia.

- Jokainen erikoisresurssin laji (yksi kullakin maastolla) on tutkimuskohde siitä
  lähtien, kun laji on löytynyt kartoitetulta ruudulta. Tutkimus maksaa 10 tiedettä
  riippumatta siitä, mitä jo tunnetaan, eikä se nosta keksintöjen hintaa.
- Ennen tutkimusta resurssiruudulla on harmaa ?-merkki, ja ruutu tuottaa vain
  maastonsa verran. Tutkimus paljastaa lajin nimen ja värin kaikkialla, ja sen
  jälkeen resurssi tuottaa.
- Kansa tutkii itse: kun mitään ei ole valittu, tutkimuskohteeksi tulee löydetty
  tuntematon laji. Lajia tutkittaessa jokainen kaupunki antaa lisäksi yhden tieteen
  päivässä, joten tutkimus etenee kaupassakin ilman kauppaa. Valtion Oppinut ja
  muut neuvonantajat tutkivat lajit ennen keksintöjä.
- Lajit avaavat keksintöjä:

| Laji | Avaa |
|---|---|
| Hevoset (tasanko) | Ratsastus ja Pyörä |
| Hiili (kukkulat) | Rautatyö |
| Kulta (vuoret) tai Jalokivet (viidakko) | Rahatalous |
| Kala (valtameri) | Kartanteko |

- Muut keksinnöt ovat auki kuten ennen. Vanha alku (?classic) ja ennen
  STORY-072:ta tallennetut pelit tuntevat kaikki lajit.
- Kilpailijat ja kaupunkipaikkojen arviot käyttävät edelleen resurssien todellista
  tuottoa.

## Resurssien rakennukset (STORY-073, Sami 2026-10-20)

Samin valinnat: resurssi on asutettu, kun se on kaupungin alueella, ja jokaisella lajilla
on oma rakennus. Nimet ja luvut ovat omia.

- Kaupunki voi rakentaa lajin rakennuksen, kun tutkitun lajin resurssiruutu on sen
  alueella. Rakennus maksaa 40 tuotantoa, eikä sillä ole ylläpitoa.
- Rakennus seisoo kaupunkitasolla resurssiruudullaan, ja kalasatama rannalla kalan vieressä.
- Rakennus antaa bonuksensa joka päivä ja palkintonsa kerran valmistuessaan. Jos
  palkintona saatava keksintö on jo tiedossa, rakennus antaa sen sijaan 30 kultaa.
  Palkintona saatu yksikkö ei kuulu millekään kaupungille, joten sillä ei ole ylläpitoa.

| Laji | Rakennus | Joka päivä | Valmistuessa |
|---|---|---|---|
| Kala | Kalasatama | +2 ruokaa | Kartanteko |
| Hylkeet | Pyyntiasema | +2 ruokaa | tiedustelija |
| Keidas | Kastelukanava | +2 ruokaa | Keramiikka |
| Riista | Metsästysmaja | +1 ruoka, +1 tuotanto | tiedustelija |
| Poro | Poroaitaus | +2 ruokaa | tiedustelija |
| Hedelmällinen maa | Viljelmä | +1 ruoka, +1 tuotanto | uudisasukas |
| Hiili | Paja | +2 tuotantoa | Rautatyö |
| Hevoset | Talli | +1 tuotanto | ratsumies |
| Öljy | Öljylähde | +3 tuotantoa | — |
| Jalokivet | Koruverstas | +1 tyytyväinen | Hautajaisriitit |
| Kulta | Rahapaja | +3 kultaa | Rahatalous |

- Kuvernöörit rakentavat resurssirakennuksen, kun muuta tarvetta ei ole: Kasvattaja
  ruokaa antavan, Vartija tuotantoa antavan ja Kartoittaja minkä tahansa.

## Storyt

| Story | Sisältö |
|---|---|
| STORY-069 | Kaupunkitaso: korkeuserot, fasetoitu pinta, valo ja varjot, puut ja kivet, kaupungin talot ja rakennukset oletuspaikoilla |
| STORY-070 | Uusi alku: arvottu monipuolinen alkupaikka yhdellä erikoisresurssilla, valmis pääkaupunki, peli alkaa kaupunkitasolta, kuvernöörit, tiedustelija rakennettavaksi, ja tiedustelija tai uudisasukas avaa kaupunkialuetason |
| STORY-071 | Rakennusten sijoitus kaupunkitasolla: muutama rakennus ja korkeuksiin perustuvat paikkasäännöt |
| STORY-072 | Resurssit ja tutkimus: alkuresurssin tutkiminen paljastaa lajinsa, löydöt läänitasolla paljastavat lisää, ja resurssit avaavat tutkimuskohteita |
| STORY-073 | Resurssien rakennukset: uuden resurssin asuttaminen antaa sen rakennuksen, ja valmis rakennus antaa tutkimuksen, yksikön tai bonuksen |

Kilpailijoiden sodat (aiemmin STORY-069) siirtyvät näiden jälkeen.

## Avoimet kysymykset (kysytään yksi kerrallaan, kun story on vuorossa)

- ~~Mitkä muutamat rakennukset kaupunkitasolla on alussa, ja mitä ne tekevät?~~
  Ratkaistu: maaston rakennukset (STORY-070).
- ~~Miten korkeuserot vaikuttavat sijoitukseen?~~ Ratkaistu: oma paras paikka
  ylhäällä tai alhaalla, ja kuvernööri sijoittaa ja pelaaja siirtää (STORY-071).
- ~~Mitkä tutkimuskohteet kukin resurssilaji avaa, ja korvaako resurssipuu nykyiset
  keksinnöt vai täydentääkö se niitä?~~ Ratkaistu: lajit avaavat keksintöjä (STORY-072).
- ~~Mikä rakennus kullakin resurssilla on, ja mitä se antaa valmistuttuaan?~~
  Ratkaistu: oma rakennus jokaiselle lajille (STORY-073).
- ~~Riittääkö asuttamiseen, että resurssi on kaupungin alueella?~~ Ratkaistu: riittää
  (STORY-073).
- ~~Näkyvätkö resurssit kartalla vasta tutkittuina?~~ Ratkaistu: tuntematon merkki
  ilman tuottoa (STORY-072).
