# GlobeCiv3 — hahmot ja tarinat (EPIC-013, STORY-102–106)

> Suunnitelma 2026-11-21 (Enki). Samin toive: joka tasolla on neuvonantajanapit,
> jokaisen aikakauden neuvonantajilla on nimet, kuvat ja omat bonukset, jokaisella
> hahmolla on nimi ja jokaisella kaupungilla dynaaminen tarina. Tekstit ovat
> värikkäitä, ja niissä on linkkejä muihin teksteihin, wikiin ja yksikön sijaintiin.
>
> Utu katselmoi suunnitelman 2026-11-21: kyllä muutoksin. Muutokset ovat tässä
> versiossa: STORY-105 jaettiin kahtia (bonukset STORY-107:ään), rikas teksti
> rakennetaan segmenteistä eikä merkkijonoon liimaamalla, ilmoitukset pysyvät
> linkittöminä, riippuvuudet ja järjestys korjattiin, ja kaupunkitason kolmikon
> migraatio kirjattiin.

## Samin valinnat (2026-11-21)

- **Napit:** tason kolmen neuvonantajan muotokuvat näkyvät aina HUDissa. Aktiivinen
  on korostettu, ja napautus vaihtaa sen. Vieressä on pieni Ohjaan itse -nappi.
- **Aikakausi:** roolit pysyvät, mutta jokainen aikakausi tuo roolin tilalle uuden
  nimetyn henkilön, jolla on oma kuva ja bonus.
- **Kuvat:** omat SVG-muotokuvat, jotka kootaan koodissa osista Kartografi-tyyliin.
  Aikakausi vaihtaa vaatteet ja päähineen, ja rooli vaihtaa esineen kädessä.
- **Tarina:** kaupunkikortissa on proosakappale, joka kasvaa tapahtumista ja jonka
  kertoo kronikoitsija.
- **Tekstit:** värikkäät ja linkitetyt. Linkki vie kaupunkiin, yksikön sijaintiin tai
  wikin sivulle.

## Periaatteet

- **Kaikki on omaa** (sääntö 4): nimet, muotokuvat, bonukset ja tekstipohjat.
  Nimilistassa on kalevalaisia ja vanhoja suomalaisia etunimiä (kansanperinnettä).
  Elävien ihmisten nimiä ei käytetä.
- **Generoitu on funktio** (sääntö 3): nimi ja muotokuva lasketaan siemenestä ja
  tunnisteesta, eikä niitä tallenneta. Tallennukseen tulee vain kaupungin
  tapahtumaloki, koska tarinaa ei voi laskea jälkikäteen.
- **Tekstiä ei kirjoita tekoäly pelin aikana.** Pelissä ei ole palvelinta eikä
  salaisuuksia (osio 9), joten tarina kootaan suomenkielisistä pohjista.
- **Väri ei ole ainoa vihje** (osio 4, saavutettavuus). Linkki on alleviivattu ja
  näppäimistöllä valittava painike, ja sen tyyppi kerrotaan saavutettavassa
  nimessä.
- **Vanha alku `?classic`** pitää vanhat yksikkönimet ("Tiedustelija 1"), koska sen
  mekaniikkatestit nojaavat niihin. Nimet tulevat uuteen peliin.

## STORY-102: Nimet hahmoille (S)

**Muoto:** uuden pelin jokaisella yksiköllä on tyyppi ja etunimi, esimerkiksi
"Tiedustelija Kalervo" ja "Uudisasukas Aino".

**Lähde:** etunimi valitaan siemenestä ja yksikön tunnisteesta (`nextId`) omasta
listasta (`src/game/personNames.ts`, 80 nimeä). Elossa olevilla yksiköillä ei ole
samaa etunimeä samaan aikaan. Siksi nimi on siemenen, tunnisteen ja elossa olevien
nimien funktio, ja se on deterministinen komentolokin kautta (sääntö 7). Kun lista
loppuu, nimi toistuu roomalaisella numerolla ("Aino II"). Neuvonantajilla on oma,
käsin kirjoitettu taulukkonsa, joten ne eivät kuluta yksiköiden listaa.

Vanha tallennus, joka ladataan uudessa tilassa, saa uusille yksiköille etunimet, ja
vanhat yksiköt pitävät numeronsa. Tämä on hyväksytty sekoitus.

**Tallennus:** nimi tallentuu jo nyt yksikön mukana, joten vanhat tallennukset
pitävät vanhat nimensä.

**Testit:**
- Sama siemen antaa samat nimet.
- Elossa olevien yksiköiden nimet ovat erilaiset.
- Vanha alku pitää vanhat nimet.
- E2E: uuden pelin yksiköllä on etunimi.

## STORY-103: Rikas teksti ja linkit (M)

**Segmentit:** teksti on lista segmenttejä: pelkkää tekstiä tai viite
(`{ ref: 'city', tile, name }`, `{ ref: 'unit', id, name }`, `{ ref: 'wiki', key }`,
`{ ref: 'person', id }` ja `{ ref: 'era', era }`). Nimet kulkevat parametreina eivätkä
liimaudu merkkijonoon. Tallennuksesta tuleva nimi, kuten `{yksikkö:1}`, ei siksi
voi muuttua linkiksi (Utu, tietoturvasääntö 5).

**Piirtäjä:** `src/ui/richText.ts` rakentaa DOM-elementit `createElement`- ja
`textContent`-kutsuilla. Se ei käytä `innerHTML`:ää, ja linkit ovat `<button>`-elementtejä
eivätkä `<a href>`. Wiki-avain valitaan sallittujen avainten taulukosta. Tyyppi saa
värin Kartografi-tokeneista: henkilö, kaupunki, yksikkö, rakennus, keksintö,
resurssi ja aikakausi.

**Ilmoitukset** saavat värit, mutta eivät linkkejä. Ne ovat live-alue, joka häipyy,
ja niiden teksti pysyy samana lokissa ja testeissä.

**Linkit:**

| Linkki | Mitä tapahtuu | Jos kohdetta ei ole |
|---|---|---|
| Kaupunki | Kamera lentää kaupunkiin, ja pikapaneeli aukeaa | — |
| Yksikkö | Kamera lentää yksikön nykyiseen ruutuun, ja yksikkö valitaan | Kaatunut yksikkö näkyy tekstinä ilman linkkiä, ja kohde tarkistetaan napautushetkellä |
| Wiki | Tietokirjan sivu aukeaa (STORY-104) | Ennen Tietokirjaa termi on värillinen ilman painiketta |

Kaupunki tunnistetaan ruudusta (`tile`). Tuhoutunut kaupunki ja vastustajan
kaupunki näkyvät tekstinä. Lento ei vie lukitun tason (`lockedLevel`) yli.

**Käyttö:** kaupunkikortti, pikapaneeli, neuvonantajien kortit, tarina ja Tietokirja.
Ilmoitukset saavat vain värit.

**Testit:**
- Jäsennin: tunnetut ja tuntemattomat viitteet.
- Tyhjä ja rikkinäinen merkintä näkyy tekstinä, eikä mikään suoritu koodina
  (tietoturvasääntö 5).
- E2E: kaupunkilinkki lentää kaupunkiin, ja yksikkölinkki lentää yksikön ruutuun.

## STORY-104: Tietokirja (M, riippuu 103:sta ja 105:stä)

Pelin sisäinen wiki. Sivut syntyvät sääntötaulukoista:
- rakennukset (`BUILDS`)
- yksiköt
- keksinnöt (`ADVANCES`)
- resurssit
- tavarat ja ketjut (`CHAIN_RULES`)
- neuvonantajat
- tasot ja aikakaudet

**Sisältö:** jokaisella sivulla on kuvaus, luvut ja lähde. Lähdekenttä tulee
sääntötaulukoihin pakollisena. Vahvistetut lähteet kirjataan, muut ovat "oma" tai "ei
tiedossa", eikä lähdettä arvata (koodaussääntö 5). Avoin kysymys Samille: saako
avoimen lähdekoodin projektien nimet Freeciv ja Freeserf näkyä pelissä lähteinä?
Sääntö 4 kieltää vain esikuvapelien nimet. Sivujen väliset viitteet ovat linkkejä. Esimerkiksi viljavarasto viittaa
keksintöön Keramiikka ja leipä myllyyn.

**Avaaminen:** Tietokirja aukeaa linkistä ja tasopaneelin (i) pikatoiminnosta.
Kortissa on takaisin-nappi.

**Testit:**
- Jokaisella rakennukselle, yksiköllä ja keksinnöllä on sivu, jolla on lähde.
- Linkit osoittavat olemassa oleville sivuille.
- E2E: avaus, linkki ja takaisin.

## STORY-105: Neuvonantajat kasvoineen (L) ja STORY-107: aikakauden bonukset (M)

Utu jakoi alkuperäisen STORY-105:n kahtia. STORY-105 sisältää kaupunkitason
kolmikon, napit sekä henkilöt nimineen ja muotokuvineen. STORY-107 sisältää
bonukset.

**Roolit:** viidellä tasolla on kolme roolia kullakin. Kaupunkitaso saa oman
kolmikkonsa, koska se nyt jakaa kaupunkialueen kolmikon:

| Taso | Roolit |
|---|---|
| Kaupunki (uusi) | Rakentaja (metsuri, saha ja louhos ensin, sitten muu ketju), Ruokkija (pelto, mylly, leipomo ja kalastamo heti perustan jälkeen) ja Retkeilijä (tiedustelija heti ensimmäisen rakennuksen jälkeen) |
| Kaupunkialue | Kasvattaja, Kartoittaja ja Vartija |
| Lääni | Asuttaja, Tutkimusmatkailija ja Vartija |
| Valtio | Laajentaja, Oppinut ja Kenraali |
| Planeetta | Valloittaja, Löytöretkeilijä ja Linnoittaja |

Ylempien tasojen roolien teot pysyvät nykyisinä. Kaupunkitason kolmikko on uusi, ja
sen teot jaetaan nykyisestä `startAdvice`- ja `chainAdvice`-järjestyksestä:
- Rakentaja: metsuri, saha ja louhos, sitten pelto, mylly ja leipomo.
- Ruokkija: perustan jälkeen pelto, kalastamo, mylly ja leipomo.
- Retkeilijä: tiedustelija heti ensimmäisen rakennuksen jälkeen.

Vartijan "soturi ensin" jää kaupunkialueen Vartijalle. Kaupunkitason soturi tulee
rosvojen ensimmäisestä kortista (Rakenna soturi).

**Migraatio:**
- `cityAdvisor` ohjaa jatkossa vain kaupunkialuetta, ja uusi `townAdvisor` ohjaa
  kaupunkitasoa (startAdvice ja chainAdvice) myös sen jälkeen, kun kaupunkialue on
  avautunut.
- `AdvisorLevel`, `advise`-komento ja sen validointi saavat tason `town`.
- Vanhassa tallennuksessa `townAdvisor` johdetaan `cityAdvisor`ista (Kasvattaja →
  Ruokkija, Kartoittaja → Retkeilijä, Vartija → Rakentaja).
- Kun `openLevel` on 4, `cityAdvisor` nollataan valintaan Oma ohjaus, koska
  kaupunkialue ei ole vielä auki.
- Vanhan komentolokin `advise city` -rivit tarkoittivat kaupunkitasolla kaupungin
  kuvernööriä. Uusinta (STORY-095) tulkitsee ne lokin päivän ja tason avulla.
- Muuttuvat testit: `onboarding`, `new-start`, `chains`, `conquest` ja
  `province-advisors`.

**Henkilöt:** jokainen rooli saa jokaisella aikakaudella oman henkilön, jolla on nimi,
arvonimi, muotokuva ja yksi bonus. MVP:n kahteen aikakauteen (Varhaisaika ja
Rauta-aika) tarvitaan 5 × 3 × 2 = 30 henkilöä. Teollinen aika ja Atomiaika tulevat
aikakausien mukana.

**Bonukset (STORY-107)** ovat pieniä, omia ja yhdestä vaikutustyypistä kerrallaan.
Ne kulkevat sääntöihin yhtenä `advisorBonus`-oliona eivätkä kuutena parametrina.
Kasautumissääntö: bonus vaikuttaa vain oman tasonsa kohteisiin, joten kaupunkitason
bonus vaikuttaa pääkaupunkiin ja kaupunkialueen bonus muihin kaupunkeihin. Oma
ohjaus ei saa bonusta. Jokainen vaikutustyyppi kytketään yhteen kohtaan nykyisissä
säännöissä:

| Vaikutus | Kytkentä | Esimerkki |
|---|---|---|
| ruoka, tuotanto, kauppa tai tiede | `cityYield` | +1 ruoka pääkaupungissa |
| tavaran teko | `workDay` | leipä päivässä |
| näkö | tiedustelijan `sight` | +1 rengas |
| puolustus | rosvotaistelu | ×1,25 |
| asutus | uudisasukkaan hinta | −10 tuotantoa |
| kulta | päivän kassa | +1 kulta päivässä |

Bonus on voimassa, kun henkilö on tasonsa aktiivinen neuvonantaja. Jokainen luku on
koodissa merkitty omaksi. Kalibrointi tehdään pelitestillä, ja autopilotilla vasta
kun se on olemassa (STORY-085 odottaa STORY-095:ää).

**Toteutus (STORY-107, 2026-11-21):** jokaisella tasolla on omat kohteensa, joten
kaksi tasoa ei koskaan kasvata samaa lukua:

| Taso | Kohteet | Vaikutustyypit |
|---|---|---|
| Kaupunki | pääkaupunki, sen ketjut ja rosvot sen portilla | ruoka, tuotanto, kauppa, leipä, puolustus |
| Kaupunkialue | muut kaupungit, rosvot niiden portilla ja tiedustelijat | ruoka, tuotanto, kauppa, näkö, puolustus |
| Lääni | uudisasukkaat ja paimentolaiset | asutus, puolustus |
| Valtio | kassa ja tutkimus | kulta, tiede |
| Planeetta | kilpailijoiden hyökkäykset | puolustus |

Henkilöiden luvut ovat tiedostossa `src/game/persons.ts` ja säännöt tiedostossa
`src/game/bonuses.ts`. Uudisasukkaan alennus näkyy rakentamisessa, mutta kaupunkikortin
valmistumisaika ja ostohinta laskevat yhä täydellä hinnalla.

**Muotokuvat:** `src/ui/portraits.ts` kokoaa SVG:n osista: kasvon muoto, hiukset,
parta ja silmät henkilön tunnisteesta, aikakauden vaatteet ja päähine sekä roolin
esine (vasara, leipä, kartta, keihäs, kirja ja niin edelleen). Värit tulevat
tokeneista. Kuvia ei tallenneta, vaan ne lasketaan aina uudelleen.

**HUD:**
- Mittaririvin Neuvonantaja-nappi korvataan tason kolmella pyöreällä
  muotokuvanapilla (36 px, kosketusalue 44 px) ja pienellä Ohjaan itse -napilla.
- Aktiivinen nappi on korostettu, ja sillä on `aria-pressed`.
- Saavutettava nimi on esimerkiksi "Neuvonantaja Aino, Kasvattaja, Varhaisaika: +1
  ruoka pääkaupungissa".
- Pitkä painallus tai hiiren vienti näyttää kortin, jossa ovat henkilö, rooli, teot
  ja bonus.

Puhelimen HUD saa viedä enintään 28 % korkeudesta (STORY-025). Utun arvion mukaan
kolme nappia ja Ohjaan itse eivät mahdu puhelimen mittaririville. HUDin korkeus
mitataan ensin. Jos rivi ei mahdu, puhelimella näkyy aktiivisen neuvonantajan
muotokuva, jonka napautus avaa kolmikon, ja leveällä näytöllä kolmikko näkyy aina.
Kosketusalueiden väli on vähintään 8 px. Napin saavutettava nimi ei ala sanoilla
"Ohjaan itse", koska neljä testiä hakee valintakortin nappia sillä nimellä.

**Aikakauden vaihtuminen:** nousuhetken kortti esittelee uudet henkilöt. Aikakauden
ehto on yhä tasot-ja-aikakaudet.md:n avoin kysymys, ja siihen asti Rautatyö avaa
rauta-ajan.

**Tallennus:** aktiivinen rooli on jo tallennuksessa (`cityAdvisor` ja muut).
Kaupunkitason rooli on uusi kenttä (`townAdvisor`), ja vanhassa tallennuksessa sen
oletus johdetaan `cityAdvisor`ista (sääntö 8).

**Testit:**
- 30 henkilöä: jokaisella nimi, kuva ja bonus.
- Bonukset vaikuttavat vain aktiivisena, ja jokaiselle vaikutustyypille on yksi
  yksikkötesti.
- Vanha tallennus latautuu.
- E2E: napit joka tasolla, vaihto komentona ja puhelimen HUD rajan alla.

## STORY-106: Kaupungin kertomus (M)

**Loki:** jokaisella kaupungilla on tapahtumaloki (`City.history`). Lokiin kirjataan
nimet merkkijonoina, koska elävän tilan haku rikkoisi säännön "sama loki, sama
teksti": yksikkö voi olla jo kaatunut. Pääkaupungin perustaja on uuden alun
uudisasukas, jonka nimi annetaan ennen kuin hänet poistetaan. Lokiin kirjataan:
- perustaminen: päivä, perustajan nimi, maasto ja resurssi
- ensimmäiset rakennukset
- kasvu kokoihin 3, 5 ja 8
- torjutut ja ryöstäneet rosvot
- ihmeet
- aikakauden vaihtuminen
- valtaus ja menetys

Lokissa on enintään 40 tapahtumaa. Vanhimmat yhdistetään deterministisesti yhteen
"alkuvuodet"-merkintään. Loki tallennetaan valinnaisena kenttänä (sääntö 8):
`validateSave` sallii enintään 40 tapahtumaa, tapahtumatyypit ovat sallitusta
listasta ja luvut on rajattu. `SAVE_VERSION` ei nouse.

**Kertomus** on puhdas funktio `narrate(loki, siemen, kaupunki, aikakausi)`, eikä se
käytä `Math.random`:ia.

**Kertomus:** kronikoitsija kirjoittaa lokista proosakappaleen pohjilla, jotka
vaihtelevat siemenen mukaan. Kertomuksen sävy muuttuu aikakauden mukana.
Kertomuksessa on linkit perustajaan, rakennuksiin (wiki), naapurikaupunkeihin ja
neuvonantajaan. Esimerkki:

> "Aamuranta syntyi joen mutkaan, jonne uudisasukas Aino toi ensimmäiset tukit.
> Metsurin kirves kaikui ennen kuin kaupungilla oli nimeä, ja leipomon savu nousi
> ensimmäisen talven jälkeen. Kun rosvot tulivat päivänä 63, soturi Kalervo seisoi
> portilla eikä kaupunki menettänyt jyvääkään."

**Vanha tallennus:** kertomus alkaa siitä, mikä tiedetään (nimi, maasto ja nykyiset
rakennukset): "Kaupungin alkuvuosista ei ole kirjoitettu."

**Testit:**
- Loki kirjautuu jokaisesta tapahtumasta.
- Sama loki antaa saman tekstin.
- Vanha tallennus latautuu.
- E2E: kertomus kasvaa tapahtuman jälkeen, ja sen linkit toimivat.

## Järjestys

1. STORY-102: nimet (S). Kaikki muu nojaa niihin.
2. STORY-105: neuvonantajat kasvoineen (L): kolmikot, napit ja henkilöt.
3. STORY-103: rikas teksti ja linkit (M).
4. STORY-106: kertomus (M, riippuu 102:sta ja 103:sta).
5. STORY-107: aikakauden bonukset (M).
6. STORY-104: Tietokirja (M). Wikilinkit näkyvät värillisinä termeinä jo ennen
   Tietokirjaa, ja ne muuttuvat linkeiksi, kun sivut ovat olemassa.

## Laajuus

EPIC-013 on kuusi storya: yksi S, neljä M:ää ja yksi L. MVP:ssä on jo 23
storya, kun raja on 20. Siksi EPIC-013 ei ole MVP-epicien listassa, vaikka se
tehdään nyt Samin pyynnöstä ennen kantajia (STORY-101).
