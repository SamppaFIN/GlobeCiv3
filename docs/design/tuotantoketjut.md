# GlobeCiv3 — kaupunkitason tuotantoketjut (STORY-088, PLAN-076; kantajat STORY-101)

> Suunnitelma 2026-11-20 (Enki). Samin valinnat samalta yöltä: ketjut puu ja vilja,
> kantajat näkyvät ja materiaalit korvaavat tuotannon kaupunkitasolla. L-kokoinen
> story. Anu ei ollut käytettävissä, joten Utu katselmoi sen Samin päätöksellä
> ("kyllä muutoksin"). Tämä versio sisältää katselmoinnin muutokset, ja kantajat
> siirtyivät omaan storyynsä STORY-101.

## Tavoite

Kaupunkitaso on oma pelinsä: kansa kaataa puuta, sahaa lankkuja, louhii kiveä ja
leipoo leipää. Rakennukset syntyvät lankuista ja kivestä, ja leipä ja kala ruokkivat
kaupunkia. STORY-101 tuo kantajat, jotka näyttävät tavaroiden kulun.

## Kenellä ketjut ovat

Vain uuden pelin pääkaupungilla on ketjut (`City.chain`). Kentän olemassaolo on
kytkin: kaikki muut kaupungit, vanha alku (`?classic`) ja tallennukset ennen
STORY-088:aa jatkavat entisillä säännöillä (maastorakennusten +1 ja 30 tuotannon
hinta). Utun löydös: muuten vanha tallennus olisi saanut tyhjän varaston ja
jumittunut, ja vanhan alun rakennusvalikko olisi kasvanut.

Ylemmät tasot näkevät pääkaupungin ruoan, tuotannon ja kaupan samasta yieldistä.
Luvut ovat alussa pienemmät kuin ennen, koska pelto, saha, louhos ja kalastamo eivät
enää anna +1:tä, ja ruoka tulee ketjusta vasta, kun leipää tai kalaa on.

## Tavarat ja varasto

Varastossa ovat tukit, lankut, kivi, vilja, jauhot, leipä ja kala. Kaupunkikortissa
on yksi tiivis rivi: "Varasto: lankkuja 7, kiveä 2 · Työmaa: Metsuri, valmis 2 pv".

**Aloitusvarasto:** 7 lankkua ja 2 kiveä. Se on Freeserfin pienin aloitusvarasto
(`src/inventory.cc`, `supplies_template[0]`), ja se riittää täsmälleen metsuriin,
sahaan ja louhokseen.

## Ketjut

| Rakennus | Paras paikka (tavara päivässä) | Ottaa | Tuottaa | Lankkuja | Kiveä |
|---|---|---|---|---|---|
| Metsuri (uusi) | metsä tai viidakko | — | tukki | 2 | 0 |
| Saha | — | tukki | lankku | 3 | 2 |
| Louhos | kukkula tai vuori | — | kivi | 2 | 0 |
| Pelto | alhaalla | — | vilja | 4 | 1 |
| Mylly (uusi) | ylhäällä | vilja | jauhot | 3 | 1 |
| Leipomo (uusi) | — | jauhot | leipä | 2 | 1 |
| Kalastamo | (rannalla aina) | — | kala | 2 | 0 |

Lankut ja kivet ovat Freeserfistä (`src/building.cc`, `const_info`, GPL-3.0, commit
`f537310`), ja yksikkötesti vertaa taulukkoa niihin. Ketjujen järjestys tukki →
lankku ja vilja → jauhot → leipä on Freeserfin.

**Omat säännöt** (merkitty koodiin omiksi):

- Tuottaja tekee tavaran kahdessa päivässä, parhaalla paikallaan päivässä. Jalostaja
  ottaa raaka-aineen varastosta työn alkaessa.
- Ketjurakennus sopii mille tahansa maalle paitsi vuorelle (louhos myös vuorelle,
  kalastamo rannalle). Korkokuvassa on puita ja kiviä kaikkialla, joten mikään
  paikka ei jää ilman metsuria tai louhosta (Utun jumiutumishuoli).
- **Perusta ensin:** pelto, mylly, leipomo ja kalastamo aukeavat vasta, kun metsuri,
  saha ja louhos ovat valmiit. Aloitusvarasto riittää niihin missä järjestyksessä
  tahansa, eikä mikään muu järjestys voi jumittaa alkua (Utu: pelto ensin olisi
  jättänyt sahalle liian vähän lankkuja).
- Leipä ja kala ovat aterioita: asukas syö enintään yhden päivässä, ja ateria antaa
  2 ruokaa. Ateriat lasketaan kaupungin päivän ruokaan (`cityYield`), joten ylijäämä
  ja kasvupäivät näyttävät ne (Utun huomio).
- Työmaita on yksi kerrallaan. Kun lankut ja kivet ovat työmaalla, rakentaminen
  kestää kaksi päivää.

## Päivän järjestys (kiinteä)

1. Kaupungin tavallinen päivä: ruoka, kasvu ja tuotanto (`cityDay`).
2. Asukkaat syövät ateriat, jotka päivän yield laski.
3. Rakennukset työskentelevät järjestyksessä metsuri, saha, louhos, pelto, mylly,
   leipomo ja kalastamo, joten tänään kaadettu tukki voidaan sahata tänään.
4. Työmaa ottaa varastosta puuttuvat lankut ja kivet, ja rakentajat tekevät päivän työn.

Päivä palauttaa siirrot (`Move`), joista STORY-101 piirtää kantajat.

## Tuotanto rinnalla

Kaupungin tuotanto (Freeciv) jatkuu rinnalla: se rakentaa yksiköt ja kaupunkialueen
rakennukset, ja ennen ensimmäistä rakennusta se on kultaa, jotta mitään ei kerry
pankkiin (Utun huomio). Ketjurakennusta ei voi ostaa kullalla. Ensimmäisen
rakennuksen jälkeen neuvonantaja tekee tiedustelijan kuten ennen, ja työmaat
jatkuvat samaan aikaan.

## Tallennus ja komennot

- `City.chain` = varasto, rakennusten työpäivät ja työmaa (rakennus, lankut, kivet ja
  päivät). Tallennus tarkistaa jokaisen kentän kokonaislukurajoin (sääntö 8 ja
  tietoturvasääntö 5), ja vanha tallennus latautuu ilman kenttää.
- Työmaan aloitus on `build`-komento: ketjukaupungissa ketjurakennus aloittaa
  työmaan. Muualla metsuri, mylly ja leipomo hylätään.

## Neuvonantajat

Jokainen neuvonantaja pitää työmaan käynnissä millä tasolla tahansa: ensin metsuri,
saha ja louhos, sitten pelto, mylly, leipomo ja kalastamo (Kasvattaja: kalastamo
ennen myllyä). Oma ohjaus valitsee itse. Uusi peli aloittaa metsurin työmaan.

## Testit

- Yksikkö: aloitusvarasto riittää täsmälleen perustaan, perusta ensin missä
  järjestyksessä tahansa, työmaa odottaa puuttuvia tarvikkeita, ketju tuottaa leipää
  ilman jumia, tavarat säilyvät, determinismi, Freeserfin luvut, ateriat yieldissä,
  sijoitus ja paras paikka, komento ja tallennus (myös ketjun keskeltä).
- E2E (`chains.e2e.ts`): uusi peli Oma ohjaus, varastorivi, lukitut työmaat, perusta
  pelaajan komennoilla, pelto ja tallennus ketjun keskeltä. `new-start.e2e.ts`
  tarkistaa metsurin työmaan.
- Vanhan alun testit pysyvät ennallaan.

## Riskit ja avoimet

- Tahti on arvaus: siemenellä 42 Oma ohjaus sai perustan noin päivään 6 ja pellon
  päivään 19. Sahan tahti (lankku kahdessa päivässä) on pullonkaula, ja tukkeja
  kertyy. Kalibroidaan autopilotilla (STORY-085) ja Inannan pelitestillä.
- Ylimääräiset lankut ja kivi jäävät varastoon, kun ketju on valmis. Niille tulee
  käyttöä kaupunkialueen rakennuksissa myöhemmin (STORY-089/090).

## STORY-101: kantajat (seuraava)

Jokainen siirto näkyy kaupunkitasolla: kantaja kävelee korkokuvaa pitkin
lähtörakennuksesta kohteeseen tavara mukanaan. Siirron logiikka tapahtuu päivän
laskennassa, ja kantajan matka kestää saman päivän pelin kellolla, joten kuva on
suora projektio (tietoinen poikkeus sääntöön 5, koska kantajat seuraavat pelin
kelloa). Enintään 24 kantajaa yhdessä instanssoidussa verkossa, polkujen korkeudet
tallennetaan, ja vähennetyllä liikkeellä kantajia ei ole. Mittaus Intel UHD:lla ja
S23 Ultralla (8 ms:n pääsäiebudjetti).
