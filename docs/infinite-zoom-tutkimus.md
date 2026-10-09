# Infinite zoom GlobeCiv3:ssa: tutkimus ja ehdotus

> Kirjoitettu 2026-10-09. Lähteenä GlobeCiv3:n, GlobeCiv2:n ja globe-civilisationin
> koodi sekä GlobeCiv2:n kansiossa oleva GlobeCiv3-tikettisuunnitelma.
> *(laskettu)* = johdettu tässä muistiossa näkyvästä kaavasta.
> *(mitattava)* = arvio, joka vahvistetaan STORY-004:n prototyypillä.

## 1. Mitä on tehty

| Projekti | Mitä se on | Tila |
|---|---|---|
| `globe-civilisation` (JS, Three.js) | 3D-heksaglobi, yksiköt, diplomatia, partikkelit. `Globe.js` on noin 2 150 riviä. | Toimiva demo, git-historiassa 8 committia |
| `globe-civilisation-autosim` | Edellisen kopio AutoSim-portausta varten | Yksi commit, kesken |
| `GlobeCiv2` (TS, Phaser 3, Svelte, Zustand) | 2D-sivilisaatiosimulaatio 120×80 ruudun kartalla: kansalaiset, moodit, fog of war, barbaarit ja teknologia. Kolme zoom-tasoa (`ZoomLevels.ts`: 15×10, 60×40 ja 120×80). | v0.2 julkaistu GitHub Pagesiin |
| `GlobeCiv3` (TS, Three.js r184, Phaser 4.1) | Runko: yksi tiedosto `src/globe/main.ts` (187 riviä). Kansiot `sim/`, `overlay/`, `stores/` ja `assets/` ovat tyhjiä. Ei git-repoa. | T-GC3-001 on merkitty valmiiksi, mutta globi ei käynnisty (kohta 2) |

GlobeCiv3:n alkuperäinen suunnitelma on 12 tikettiä kansiossa
`GlobeCiv2/docs/tickets-globeciv3/`. Siinä jokainen 3D-heksa sisältää oman
GlobeCiv2-simulaation, ja heksan tuplaklikkaus avaa sen Phaser-ikkunana overlayn päälle.

## 2. Havainnot nykykoodista

1. **Globi kaatuu käynnistyksessä.** Three.js r125:stä lähtien `IcosahedronGeometry`
   on indeksoimaton, joten `geo.index` on `null`. Rivi `geo.index!.count` heittää
   TypeErrorin ennen kuin `animate()` käynnistyy, ja ruutu jää mustaksi.
   `npm run build` menee silti läpi, koska `!` ohittaa tyyppitarkistuksen.
   Vahvistettu Node-ajolla: `index: null`.
2. **Ruudukossa on 362 solmua, ei noin 10 000.** Kommentti "~10k vertices" on peräisin
   vanhasta Three.js:stä, jossa jako oli rekursiivinen. Nykyinen kaava on
   10·(d+1)²+2 = 362, kun d = 5. Solmuista 12 on viisikulmioita ja 350 kuusikulmioita,
   ja särmiä on 1 080 *(laskettu ja ajettu)*.
3. **Naapurilaskenta on neliöllinen.** Jokaiselle särmälle tehdään `findIndex` koko
   solmulistan yli. 362 solmulla se ei haittaa, mutta tiheämmällä ruudukolla haittaa.
4. **Phaserin pääversio on vaihtunut.** GlobeCiv3:een oli asennettu Phaser 4.1, mutta
   GlobeCiv2:n koodi on kirjoitettu Phaser 3.88:lle. T-GC3-003:n "kopioi sellaisenaan"
   olisi vaatinut vähintään API-tarkistuksen. *Päivitys 2026-10-09: Sami päätti luopua
   overlaysta, ja Phaser poistettiin riippuvuuksista.*
5. **Simulaatio on sidottu globaaleihin storeihin.** `mapStore` ja `gameStore` ovat
   moduulitason singletoneja. Sivu tuntee siis vain yhden kartan, eikä "simulaatio
   per heksa" onnistu ennen kuin tila muutetaan instanssikohtaiseksi.
6. **Simulaatiologiikka ei juuri riipu Phaserista, mikä on hyvä uutinen.** `SimLoop`,
   `CitizenAI`, `VoxelMap` ja järjestelmät tuovat vain toisiaan ja Zustandin.
   Phaser on render-, scene- ja input-kerroksessa sekä `TileTypes`-tiedoston väreissä.
7. **Kartan generointi on deterministinen** (`mulberry32` ja value noise), mutta se
   tapahtuu tasossa. Lämpötila lasketaan `y / height`-suhteesta. Pallolla
   naapurikarttojen reunat eivät kohtaa, eikä leveysaste vastaa sijaintia.
8. **Kamera on rajattu.** OrbitControlsin etäisyys on 6–30 yksikköä pallon
   keskipisteestä, ja pallon säde on 5. Pinnalle asti ei pääse.

## 3. Ydinristiriita

GlobeCiv2:n design-filosofia sanoo: *"Zoom ei lataa uutta näkymää — se vain
tarkentaa resoluutiota"*. Se lupaa *"maailman, joka on olemassa kaikilla tasoilla
samanaikaisesti — planeetasta yksittäisen kansalaisen kasvoihin"*.

GlobeCiv3:n tikettisuunnitelma tekee päinvastoin. Tuplaklikkaus vaihtaa toiseen
moottoriin, toiseen kameraan ja toiseen koordinaatistoon. Overlay on leikkaus, ei zoom.
Lisäksi muodot eivät sovi yhteen. Kuusikulmion sisältä ei voi zoomata suorakaiteen
muotoiseen 120×80-karttaan, eivätkä vierekkäisten heksojen kartat jatku toisiinsa.

**Johtopäätös:** saumaton infinite zoom ei synny overlay-arkkitehtuurin päälle.
Tarvitaan yksi maailma, yksi renderöijä ja yksi kamera, joiden tarkkuus kasvaa zoomatessa.

## 4. Ehdotettu arkkitehtuuri

```
 taso    näkymä          mitä piirretään                     simulaatio
 ──────  ──────────────  ──────────────────────────────────  ────────────────────
 L0–3    planeetta       362 aluetta väreinä, rajat           makro: kaikki alueet
 L4–7    manner / alue   biomit, joet, kaupungit pisteinä     makro
 L8–10   ruutu           GlobeCiv2-tason ruudut               meso: omistus, fog
 L11–14  kaupunki        rakennukset, kansalaiset             mikro: agentit kuplassa
 L15–17  kansalainen     yksittäinen hahmo, kasvot            mikro
```

### 4.1 Sisäkkäinen ruudukko: kuutiopallo ja quadtree

Zoomin pohjaksi tarvitaan hierarkia, jossa jokainen solu jakautuu täsmälleen
lapsisoluiksi. Kuusikulmiot eivät jakaudu kuusikulmioiksi ilman rakoja.

| Vaihtoehto | Sisäkkäisyys | Sopivuus |
|---|---|---|
| **Kuutiopallo + quadtree** (6 tahkoa, solu jakautuu 4 lapseksi) | Täydellinen | Paras. Neliöruudut vastaavat GlobeCiv2:n ruutukarttaa, ja osoite on yksinkertainen (tahko, taso, x, y). |
| Ikosaedrin kolmiojako (solu jakautuu 4 kolmioksi) | Täydellinen kolmioille | Kuusikulmiot ovat kolmioiden duaaleja, eivätkä ne ole sisäkkäisiä. |
| H3-tyylinen aukko-7-heksahierarkia | Likimääräinen | Lapset eivät peitä vanhempaa tarkasti, mikä tuo saumoja aggregointiin. |

**Heksailme säilyy.** Nykyisistä 362 heksasta tulee pelin alueita (provinsseja).
Jokainen hieno solu kuuluu lähimmän heksakeskuksen alueeseen (Voronoi pallolla), ja
rajat piirretään viivoina. Raja on sama jokaisella zoom-tasolla, koska se lasketaan
samasta pisteestä.

**Tasomäärä** *(laskettu)*. Tasolla L on 6·4^L solua. GlobeCiv2:n tiheys (9 600 ruutua
alueella) koko planeetalle on 362 · 9 600 ≈ 3,5 miljoonaa ruutua, ja 6·4^L ylittää sen,
kun L ≈ 10. Kansalaisen kasvoihin tarvitaan vielä noin 7 tasoa (2^7 = 128), joten
tasoja on yhteensä noin 17. "Infinite" tarkoittaa siis käytännössä noin 17 tasoa.
Niiden alle voi halutessa jatkaa proseduraalisella yksityiskohdalla.

### 4.2 Maailma on funktio, ei taulukko

Maasto on funktio f(seed, piste yksikköpallolla, taso). Kohinaa näytteistetään 3D:ssä
solun keskipisteestä, mistä seuraa kolme asiaa:

- Mikä tahansa solu millä tahansa tasolla voidaan generoida pyydettäessä. Mitään ei tarvitse tallentaa ennen kuin pelaaja muuttaa sitä.
- Naapurisolut kohtaavat automaattisesti, koska ne näytteistävät samaa jatkuvaa funktiota.
- Leveysaste on todellinen, koska se luetaan pisteen y-koordinaatista.

**Tasojen yhtenevyys.** Tason L tekseli näytteistää kohinaa vain niillä oktaaveilla,
jotka ovat tekseliä suurempia (kaistarajattu fBm). Näin karkea näkymä vastaa hienon
näkymän keskiarvoa, eikä väri hyppää zoomatessa. `ZoomLevels.aggregateCell` tekee jo
saman alhaalta ylös pelaajan muuttamalle datalle.

**Sääntö:** generoitu data kulkee ylhäältä alas funktiona, ja pelaajan muuttama data
kulkee alhaalta ylös aggregointina.

### 4.3 Simulaatio-LOD

Kaikkea ei voi simuloida kansalaistasolla, koska 362 aluetta × 9 600 ruutua on noin
3,5 miljoonaa ruutua *(laskettu)*. Alkuperäinen suunnitelma kiertää ongelman
rajoittamalla peliä kymmeneen aktiiviseen täyteen simulaatioon. Ehdotus on kolme kerrosta:

| Kerros | Laajuus | Malli | Tikki |
|---|---|---|---|
| Makro | Kaikki 362 aluetta | Tilastot: väestö, ruoka, sotavoima, valloitus-% | Aina |
| Meso | Alueet, joilla on toimintaa | Solukohtainen omistus ja fog | Harvemmin |
| Mikro | Kamerakupla, 1–3 aluetta *(mitattava)* | GlobeCiv2:n agentit: `Citizen`, `CitizenAI`, `SimLoop` | Täysi |

- **Makro on totuus.** Mikrokerros on tarkennus, joka raportoi muutokset takaisin.
- **Materialisointi.** Kun kamera laskeutuu alueelle, agentit luodaan makrotilastojen mukaan (väestömäärä, moodijakauma) deterministisellä siemenellä.
- **Tiivistys.** Kun kamera poistuu, agentit kootaan takaisin tilastoiksi. Väestön on säilyttävä täsmälleen, ja se on testattava invariantti.

### 4.4 Kamera ja tarkkuus

- **Logaritminen zoom kohti kursoria.** Korkeus pinnasta kerrotaan vakiolla jokaisella rullan pykälällä, ja zoom kohdistuu siihen pallon pisteeseen, jota kursori osoittaa. Mobiilissa pinch toimii samalla mallilla.
- **Kallistus korkeuden mukaan.** Ylhäällä katsotaan suoraan alas, ja alhaalla kamera kallistuu kohti horisonttia. Siirtymä on jatkuva.
- **OrbitControls korvataan omalla ohjaimella.** Sen tila on pallon piste, korkeus, suunta ja kallistus.
- **Dynaaminen near ja far.** Near on noin korkeus / 10, ja far on etäisyys horisonttiin. Horisonttietäisyys on √(2Rh), joten matalalla far pienenee itsestään. Kun h = 0,0001 ja R = 5, far ≈ 0,03 ja near ≈ 0,00001, joten suhde on noin 3 000 *(laskettu)*. Se mahtuu 24-bittiseen syvyyspuskuriin, ja `logarithmicDepthBuffer` jää varasuunnitelmaksi. Tähtitausta piirretään omana passinaan ilman syvyyttä.
- **Kamerasuhteellinen renderöinti syvimmillä tasoilla.** float32:n tarkkuus säteellä 5 on noin 4,8·10⁻⁷. Tasolla 17 solu on noin 6·10⁻⁵ yksikköä, eli solua kohden on vain noin 126 askelta *(laskettu)*. Se ei riitä kasvojen yksityiskohtiin. Ratkaisuna kamera pysyy origossa, ja jokaisen ruudun sijainti kamerasta lasketaan CPU:lla float64:nä joka framessa. Tasoilla 0–10 askelia on yli 16 000 solua kohden, joten tätä tarvitaan vasta kaupunkitasolla.

### 4.5 Visuaalinen jatkuvuus

- **LOD määräytyy ruudun näyttökoosta, ei zoom-kynnyksistä.** Ruutu jaetaan, kun se on yli noin 256 px leveä, ja yhdistetään, kun se on alle 128 px. Hystereesi estää välkkymisen.
- **Ruutuja on näkyvissä vakiomäärä zoomista riippumatta.** 1920×1080-näytölle mahtuu noin 32 ruutua kokoa 256×256 *(laskettu)*, ja sekatasojen ja horisontin kanssa niitä on muutamia kymmeniä. Tämä on syy, miksi infinite zoom on ylipäätään mahdollinen: framen kustannus ei kasva syvyyden mukana.
- **Ristiinhäivytys.** Lapsiruudut häivytetään esiin vanhemman päälle noin 200 ms:ssa *(mitattava)*. Koska vanhemman väri on lasten keskiarvo, siirtymä on lähes huomaamaton.
- **Esitystapa vaihtuu häivyttämällä.** Järjestys on väripinta, biomit, ruudut, instansoidut rakennukset, kansalaisbillboardit ja lopuksi hahmo. Jokainen vaihto käyttää samaa häivytyssääntöä.
- **Reunat.** Samalla tasolla olevat naapurit jakavat reunavertexit, ja eri tasojen väliin lisätään helmat (skirts) rakojen peittämiseksi.
- **Generointi tehdään Web Workerissa LRU-välimuistin kanssa.** Viten worker-asetus (`format: 'es'`) on jo valmiina. Ruudun tekstuuri on DataTexture, esimerkiksi 64×64 tekseliä.

### 4.6 Syöte ja käyttöliittymä

- **Tuplaklikkaus säilyy, mutta se lentää alueelle.** Korkeus ja isoympyrä interpoloidaan noin sekunnissa. `prefers-reduced-motion` vaihtaa lennon välittömäksi siirtymäksi.
- **Svelte-HUD näyttää nykyisen tason kontekstin.** Se voi olla planeetan tilanne, alueen tilastot, kaupungin rakennukset tai kansalaisen tiedot. Tason vaihto ei avaa uutta ikkunaa.

## 5. Vanhat tiketit uudessa backlogissa

| Vanha | Uusi | Huomio |
|---|---|---|
| T-GC3-001 alustus | STORY-001 | Merkitty valmiiksi, mutta globi kaatuu. Korjaus on ensimmäinen story. |
| T-GC3-002 JS → TS | STORY-008, STORY-012 | Vain tarvittavat osat: ruudukko ja aluegraafi. Koko `Globe.js`:ää ei siirretä. |
| T-GC3-003 sim-moottorin kopiointi | STORY-013, STORY-015 | Vain renderöijästä riippumaton logiikka. Phaser-scenejä ei kopioida. |
| T-GC3-004…006 slotit ja GameLoop | STORY-013, STORY-014 | Slotista tulee alue, jolla on makrotila. |
| T-GC3-007…008 overlay | STORY-005, STORY-007 | Overlayn tilalle tulevat zoom ja fly-to. |
| T-GC3-009…010 valloitus ja leviäminen | STORY-016 | Sama idea, mutta makrotasolla. |
| T-GC3-011 visuaalit | STORY-011, STORY-012, STORY-018 | |
| T-GC3-012 deploy | STORY-002 | |

## 6. Riskit

1. **Suurin riski on simulaatiokerrosten yhtenevyys.** Jos materialisointi ja tiivistys eivät säilytä tilaa, pelaaja näkee kaupungin "muuttuvan" zoomatessa. Lievennyksenä väestön ja omistuksen säilyminen yksikkötestataan.
2. **Mobiilin suorituskyky.** Kymmenet DataTexture-ruudut ja instansoidut kansalaiset ovat kevyitä, mutta workerissa tehtävä generointi kilpailee prosessorista. Asia mitataan STORY-004:ssä.
3. **Laajuus.** 17 tasoa on paljon sisältöä. MVP voi päättyä noin tasolle 12 (ruutu ja kaupunki), ja kasvot lisätään myöhemmin. Kamera- ja tarkkuusratkaisun on silti kestettävä kaikki 17 tasoa.

## 7. Ensimmäinen todiste

STORY-004 on 2–3 päivän spike. Siinä rakennetaan tyhjä kuutiopallo-quadtree, jonka
ruudut ovat pelkkiä värejä, sekä oma kamera, logaritminen zoom ja ristiinhäivytys
tasolta 0 tasolle 17. Mitataan FPS, ruutujen määrä, generointiaika ja värinä (jitter)
syvimmällä tasolla. Jos tämä toimii, loppu on sisällön lisäämistä samaan putkeen.
