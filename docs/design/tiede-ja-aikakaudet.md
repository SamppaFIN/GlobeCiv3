# GlobeCiv3 — tiede ja aikakaudet (EPIC-014)

> Luonnos 2026-11-23 (Enki). Samin toive samalta iltapäivältä: kun keksintö valmistuu,
> ikkuna kertoo sen vaikutukset, ja peli pysähtyy, kunnes seuraava tutkimus on valittu.
> Tieteeseen tulevat kaikki aikakaudet, ja ydinsota avautuu. Kun keksintö avaa
> rakennuksen, ikkunasta voi priorisoida sen. Jokaisen keksinnön vaikutus kerrotaan
> selvästi. Sami hyväksyy tai korjaa tämän suunnitelman ennen storyjä 120–123.

## Samin valinnat (2026-11-23)

1. **Pysähdys:** keksintökortti pysäyttää pelin aina, myös neuvonantajan hoitaessa
   tiedettä. Valtion neuvonantajan ehdotus on valmiiksi valittuna, joten yksi
   napautus jatkaa. Omalla ohjauksella mitään ei ole valittu.
2. **Laajuus:** kaikki aikakaudet eli Freecivin civ1-sääntöjen koko keksintöpuu
   (67 keksintöä, joista 15 on jo pelissä).
3. **Aikakauden vaihto:** avainkeksinnöt.
4. **Rakennuksen priorisointi:** kolme valintaa kortissa: kaikki kaupungit ensin,
   pääkaupunki ensin tai neuvonantaja päättää. Valinta on komento (sääntö 7), ja
   kuvernöörit noudattavat sitä, kunnes rakennus on valmis.
5. **Ydinsota avautuu** (Samin viesti 15:34).

## Oletukset (kysymys keskeytyi; Sami vahvisti ne 2026-11-24)

| Kysymys | Oletus | Vaihtoehto |
|---|---|---|
| Laivat ja lentokoneet (noin 13 keksintöä avaa civ1:ssä laivan tai lentokoneen, joita pelissä ei ole) | Keksintö saa oman maavaikutuksen, joka merkitään omaksi säännöksi (esim. Merenkulku: yksiköt ylittävät meren) | Laivat ja lentokoneet yksiköiksi (uusi liikkumisjärjestelmä) tai keksintö pelkkänä välivaiheena |
| Ydinsota | Aloitusnäyttöön tulee heti nappi nykyiseen ydinsotakokeiluun (STORY-119), ja atomiaika liittää ydinsodan peliin planeettatasolle (STORY-123) | Vain atomiaika tai vain nappi |
| Uudet henkilöt | Jokainen uusi aikakausi tuo kaikille 15 roolille uuden henkilön (75 henkilöä), ja muotokuvan vaatteet ja päähine tulevat aikakaudesta | Vain osa aikakausista tai ei uusia henkilöitä |
| Järjestys | STORY-117 valmiiksi, sitten tämä epic, ja STORY-014 sen jälkeen | STORY-014 ensin |
| MVP | Epic ei ole MVP-epicien listassa (kuten EPIC-013), koska MVP:ssä on jo 30 storya | Sami päättää |

## Aikakaudet

Freecivin civ1-säännöissä ei ole aikakausia, joten jako ja avainkeksinnöt ovat omia.
Järjestys noudattaa Civ V:n aikakausia (Unciv) yhdistettynä pelin nykyisiin kahteen.
Avaimet muodostavat ketjun: jokainen avain on seuraavan avaimen ja ydinfission
edellytys. Siksi aikakaudet tulevat aina järjestyksessä, mikään ei jää väliin, ja
tutkimus päätyy atomiaikaan, valitsi pelaaja tai neuvonantaja mitä tahansa. Ketju
tarkistettiin civ1:n vaatimuksista skriptillä, joka myös varmisti, että kaikki 67
keksintöä ovat taulukossa ja että jokaisen keksinnön vaatimukset ovat samalla tai
aiemmalla aikakaudella.

| # | Aikakausi | Avainkeksintö (civ1) | Keksinnöt (civ1) |
|---|---|---|---|
| 1 | Varhaisaika | Pelin alussa | Aakkoset, Pronssityö, Hautajaisriitit, Keramiikka, Muuraus, Ratsastus, Pyörä, Kirjoitus, Lakikokoelma, Kartanteko, Rahatalous, Mystiikka (12) |
| 2 | Rauta-aika | Rautatyö (Iron Working, nykyinen sääntö) | Rautatyö, Matematiikka, Monarkia, Rakentaminen, Lukutaito, Kaupankäynti, Filosofia, Tasavalta, Tähtitiede, Siltojenrakennus (10) |
| 3 | Keskiaika | Ruuti (Gunpowder) | Ruuti, Feodalismi, Ritarilaitos, Uskonto, Yliopisto, Pankkitoiminta, Lääketiede, Keksiminen, Insinööritaito (9) |
| 4 | Uusi aika | Metallurgia (Metallurgy) | Metallurgia, Merenkulku, Fysiikka, Magnetismi, Painovoimateoria, Kemia, Demokratia (7) |
| 5 | Teollinen aika | Teräs (Steel) | Teräs, Höyryvoima, Rautatie, Teollistuminen, Sähkö, Osakeyhtiö, Räjähteet, Asevelvollisuus, Jalostus, Kommunismi (10) |
| 6 | Moderni aika | Auto (Automobile) | Auto, Polttomoottori, Elektroniikka, Lentäminen, Massatuotanto, Ammattiyhdistys, Atomiteoria, Kehittynyt lentäminen, Rakettitekniikka, Tietokoneet (10) |
| 7 | Atomiaika | Ydinfissio (Nuclear Fission) | Ydinfissio, Ydinvoima, Avaruuslento, Muovit, Robotiikka, Suprajohteet, Kierrätys, Geenitekniikka, Fuusiovoima (9) |

Keksintöjen nimet ovat omia suomennoksia, ja vaatimukset ja hinnat tulevat
Freecivin civ1-säännöistä (data/civ1/techs.ruleset, commit 04852fb, GPL).
Aikakaudelle kuuluvuus on vain kertomusta ja tiedepuun järjestystä varten. Itse
aikakausi vaihtuu vain avaimesta.

## Mitä keksinnöt avaavat

Luvut tulevat civ1-säännöistä (buildings.ruleset, units.ruleset,
governments.ruleset ja effects.ruleset, commit 04852fb). Yhteenveto:

- **Rakennukset (13 uutta):** oikeustalo, kasarmi, katedraali, yliopisto, pankki,
  tehdas, voimala, vesivoimala, ydinvoimala, joukkoliikenne, kierrätyskeskus,
  ohjustorjunta ja tuotantolaitos.
- **Maayksiköt (9 uutta):** ritari, muskettisoturi, kiväärimies, panssari, tykki,
  tykistö, mekanisoitu jalkaväki, diplomaatti ja karavaani.
- **Hallitusmuodot:** tasavalta, demokratia ja kommunismi (civ1:n verokatot,
  sotaväsymys ja tuotannon säännöt; korruptio puuttuu yhä, STORY-047).
- **Ihmeet (noin 17 uutta):** jokainen kerran pelissä, ja vanhenevat ihmeet
  vanhenevat civ1:n keksinnöistä.
- **Laivat, lentokoneet ja ydinohjus:** oletuksen mukaan oma maavaikutus (yllä).
  Ydinohjus (Rakettitekniikka) kuuluu planeettatason ydinsotaan.
- **Saastuminen** (civ1: tehtaat ja voimalat) jätetään pois, kunnes Sami haluaa sen.
  Rakennukset, jotka civ1:ssä vain vähentävät saastetta (joukkoliikenne ja
  kierrätyskeskus), saavat oman vaikutuksen tai jäävät pois; päätös tehdään
  STORY-122:n suunnitelmassa.

Jokaisella keksinnöllä on yksi vaikutusten lähde (`advanceEffects`), jota käyttävät
keksintökortti, tiedepuu ja Tietokirja. Vaikutus kerrotaan luvuin: "Kirjasto:
+50 % tiedettä kaupungissa · 80 tuotantoa · ylläpito 1 kulta".

## Ydinsota pelissä

Ydinsotakokeilu (STORY-097, `?planet`) on erillinen peli viidellä keksityllä
johtajalla. STORY-119 tuo sen aloitusnäyttöön. STORY-123 liittää sen peliin: kun
kansa keksii ydinfission ja planeettataso on auki, planeettatasosta tulee ydinsota,
jossa pelaaja ja kilpailijat (Pohjola, Tapiola ja Ahtola) ovat johtajia omine
valtioineen. Kokeilun säännöt (jännite, ohjukset ja torjunta) siirtyvät sellaisinaan.
Yksityiskohdat ja niiden kysymykset ovat STORY-123:n suunnitelmassa.

## Jako storyihin

| Story | Koko | Sisältö |
|---|---|---|
| STORY-118 Keksintökortti | M | Kortti vaikutuksineen, pysähdys, seuraavan tutkimuksen valinta, rakennuksen priorisointi komentona, yksi vaikutusten lähde |
| STORY-119 Ydinsota aloitusnäytöstä | S | Aloitusnäytön nappi nykyiseen ydinsotakokeiluun |
| STORY-120 Aikakaudet | L | Seitsemän aikakautta avaimista, aikakauden kortti, 75 uutta henkilöä, muotokuvien vaatteet, Tietokirja ja kertomus |
| STORY-121 Rauta-aika ja keskiaika | L | Varhaisajan, rauta-ajan ja keskiajan uudet keksinnöt ja niiden rakennukset, yksiköt, tasavalta ja ihmeet |
| STORY-122 Uusi aika ja teollinen aika | L | Kyseisten aikakausien keksinnöt ja niiden avaamat asiat, demokratia ja kommunismi |
| STORY-123 Moderni ja atomiaika | L | Loput keksinnöt, ja ydinfissio liittää ydinsodan planeettatasolle |

## Avoimet kysymykset

1. ~~Yllä olevan taulukon oletukset (laivat, ydinsota, henkilöt, järjestys ja MVP).~~ Ratkaistu 2026-11-24: Sami valitsi oletukset. Aikakausien avaimet tulevat peliin keksintöineen storyissa 121–123 (PLAN-101).
2. Avainkeksinnöt: Ruuti, Metallurgia, Teräs, Auto ja Ydinfissio. Höyryvoima, jota
   tasot-ja-aikakaudet.md ehdotti, ei ole ketjussa: sen voi keksiä ennen metallurgiaa.
3. Saastuminen pois vai mukaan.
