# STORY-004: infinite zoom -prototyypin tulokset

> Mitattu 2026-10-09. Prototyyppi on haarassa `spike/infinite-zoom`, eikä sitä
> mergetä sellaisenaan (STORY-004:n hyväksymiskriteeri). Suunnitelma: PLAN-003.

## Yhteenveto

Yhden renderöijän infinite zoom toimii työpöydällä tasolta 1 tasolle 17.
Mittauksessa ei ollut leikkauksia eikä värinää, eikä kuvissa näy aukkoja tai
z-fightingia, ja ruudunpäivitys pysyy 60 fps:ssä integroidulla näytönohjaimella. **Työpöydän tulos vahvistaa päätöksen luopua
Phaser-overlaysta.** Puhelinmittaus puuttuu vielä (kohta 4).

## 1. Mittausympäristö (työpöytä)

| | |
|---|---|
| Näytönohjain | Intel UHD Graphics (0x9BC4), ANGLE Direct3D 11 |
| Selain | Headless Chrome 154, Windows 11 |
| Näkymä | 1280 × 800, devicePixelRatio 1 |
| Build | `vite build`, tarjoiltu `vite preview` -palvelimella |
| Menetelmä | `node scripts/bench.mjs` → `spike.html?bench`. Lento kulkee etäisyydeltä 25 etäisyydelle 0,0001 (log-asteikolla 30 s), pysyy pohjalla 4 s ja nousee takaisin 15 s:ssa. Kohde on rantaviivalla, joka on etsitty puolitushaulla. |

Headless Chrome tahdistaa ruudunpäivityksen 60 Hz:iin, joten 60 fps on
mittauksen yläraja. Luku ei kerro, paljonko näytönohjaimella jää varaa.

## 2. Tulokset

| Mittari | Tulos | Tavoite tai odotus |
|---|---|---|
| FPS, keskiarvo | 59,9 | 60 (työpöytä) |
| FPS, 1 %:n alin | 59,5 | |
| Pahin frame | 33,4 ms | Yksittäisiä 2 framen pudotuksia tasoilla 13–14 |
| Syvin saavutettu taso | 17 | 17 |
| Piirrettyjä ruutuja enintään | 482 | Rajattu: ei kasva syvyyden mukana |
| Välimuistissa enintään | 2 045 meshiä | Muistinkäyttöä ei mitattu |
| Ruudun generointi | 0,9 ms/ruutu (pääsäie) | Budjetti 4 ms/frame |
| Generointia framessa enintään | 5,7 ms | Budjetti ylittyy yhdellä ruudulla |
| Värinä tasolla 17, kamerasuhteellinen | 0,036 px | alle 0,5 px |
| Värinä tasolla 17, naiivi float32 | 4 092 px | Näyttää, miksi kamerasuhteellisuus on välttämätön |
| Zoom kohti kursoria, virhe | 0 px | Piste pysyy kursorin alla, myös kallistettuna |

### Tasoittain

| Taso | Frameja | FPS | Pahin ms | Ruutuja (ka) |
|---|---|---|---|---|
| 1 | 51 | 60 | 16,8 | 14 |
| 2 | 135 | 60 | 16,8 | 38 |
| 3 | 155 | 60 | 16,8 | 91 |
| 4 | 158 | 60 | 17,1 | 135 |
| 5 | 154 | 60 | 17,0 | 124 |
| 6 | 148 | 60 | 16,8 | 108 |
| 7 | 143 | 60 | 16,8 | 107 |
| 8 | 139 | 60 | 16,8 | 112 |
| 9 | 126 | 60 | 16,8 | 129 |
| 10 | 133 | 60 | 16,8 | 151 |
| 11 | 128 | 60 | 16,8 | 201 |
| 12 | 142 | 60 | 16,8 | 271 |
| 13 | 150 | 58,5 | 33,4 | 296 |
| 14 | 145 | 58,4 | 33,3 | 310 |
| 15 | 150 | 60 | 16,8 | 336 |
| 16 | 153 | 60 | 16,9 | 343 |
| 17 | 720 | 60 | 17,0 | 297 |

Raakadata: [STORY-004-bench-desktop.json](STORY-004-bench-desktop.json).
Taso 0 ei näy taulukossa, koska lento alkaa niin läheltä, että pallo on jo
jaettu tasolle 1.

### Kuvat

| Näkymä | Taso | Kuva |
|---|---|---|
| Kaukaa | 1 | [STORY-004-etaalta.png](STORY-004-etaalta.png) |
| Manner | 8 | [STORY-004-manner.png](STORY-004-manner.png) |
| Ruutu | 13 | [STORY-004-ruutu.png](STORY-004-ruutu.png) |
| Syvin | 17 | [STORY-004-syvin.png](STORY-004-syvin.png) |
| Syvin, tasovärit | 17 | [STORY-004-syvin-tasovarit.png](STORY-004-syvin-tasovarit.png) |

## 3. Havainnot

1. **Kamerasuhteellinen renderöinti ratkaisee tarkkuuden kokonaan.** Kun verteksit tallennetaan suhteessa ruudun keskipisteeseen ja Three.js laskee model-view-matriisin float64:nä, virhe on tasolla 17 alle sadasosa pikselistä. Erillistä floating origin -järjestelmää ei tarvita.
2. **Dynaaminen near ja far näyttää riittävän.** Viidessä kuvassa (tasot 1, 8, 13 ja 17) ei näy z-fightingia, ja near/far-suhde on tasolla 17 noin 900. `logarithmicDepthBuffer`ia ei tarvita, ellei liikkeessä tehtävä tarkistus näytä muuta.
3. **Ruutumäärä on rajattu.** Määrä vaihtelee 14:n ja 482:n välillä riippuen siitä, kuinka paljon horisonttia kallistettu kamera näkee, mutta se ei kasva syvyyden mukana.
4. **Generointi pääsäikeessä riittää työpöydällä.** 0,9 ms/ruutu ja 4 ms:n budjetti pitävät framen alle 17 ms:n lähes koko ajan. Tasoilla 13–14 oli yksittäisiä noin 33 ms:n frameja, joiden syytä ei selvitetty. Puhelimessa generointi on todennäköisesti hitaampaa, mikä on syy siirtää se workeriin (STORY-010).
5. **Värimorfi on toteutettu ilman läpinäkyvyyttä, mutta sen saumattomuus on vielä katsomatta liikkeessä.** Liikkumattomista kuvista poppausta ei voi arvioida, joten tämä on Samin manuaalinen tarkistus (zoomaa rantaviivaa sisään ja ulos tasovärit päällä ja ilman). Hystereesin takia yhdistyminen (zoom ulos) tarvitsee erillisen 0,3 s:n häivytyksen, koska pelkkä näyttökoko ei riitä jatkuvuuteen molempiin suuntiin.
6. **Väri verteksien kohdalla on liian karkea.** Rantaviiva porrastuu 16 × 16 -verteksiruudukon mukaan. Tuotantoversiossa väri lasketaan tekseleittäin (esimerkiksi 64 × 64 DataTexture ruutua kohden), kuten tutkimusmuistiossa on suunniteltu (STORY-009).
7. **Kohinan hienot oktaavit ovat syvällä heikkoja.** Avomerellä ja sisämaassa tasot 12–17 näyttävät tasaisilta. Kiinnostavaa sisältöä syvillä tasoilla syntyy vasta pelin datasta (rakennukset ja kansalaiset), ei pelkästä maastokohinasta.
8. **Testiajo kaatui kerran selittämättä** ("no tests", molemmat testitiedostot). Vikaa ei saatu toistettua neljällä uudella ajolla. Epäilty syy on Windowsin asemakirjaimen kirjainkoko (`c:` vs `C:`).

## 4. Puhelinmittaus

_Odottaa Samin mittausta._

Ohje: kone ja puhelin samassa wifissä. Kun `vite preview --host` on käynnissä
koneella, avaa puhelimella:

```
http://192.168.1.208:4173/GlobeCiv3/spike.html?bench
```

Odota noin 50 sekuntia, kunnes HUD:iin tulee teksti "BENCH VALMIS", ja ota siitä
kuvakaappaus. Jos sivu ei aukea, Windowsin palomuuri todennäköisesti estää
Noden: salli se yksityisessä verkossa.

| | |
|---|---|
| Puhelin | _odottaa_ |
| FPS ka / 1 % alin | _odottaa_ |
| Syvin taso | _odottaa_ |
| Generointi ms/ruutu | _odottaa_ |
| Värinä | _odottaa_ |

## 5. Mitä prototyyppi ei kata

- Tekstuurit, korkeuserot ja maaston kohokuvio. Pallo on sileä.
- Generointi workerissa (STORY-010).
- Esitystavan vaihtuminen (rakennukset ja kansalaiset), joka vaatii varsinaista ristiinhäivytystä (STORY-011).
- Simulaatio (EPIC-004).
- Muistinkäyttö. Välimuistin 2 045 meshiä on mitattu määränä, ei megatavuina.

## 6. Mitä siirretään tuotantoon

Koodia ei mergetä sellaisenaan. Seuraavat ratkaisut kirjoitetaan uudelleen
storyjen mukana:

| Ratkaisu | Tiedosto haarassa | Story |
|---|---|---|
| Kuutiopallon ruutuosoitteet ja testit | `src/spike/cubeSphere.ts` | STORY-008 |
| "Tartu palloon" -zoom ja -raahaus | `src/spike/camera.ts` | STORY-005 |
| Kamerasuhteelliset verteksit, dynaaminen near ja far | `src/spike/tiles.ts`, `camera.ts` | STORY-006 |
| LOD-valinta, budjetoitu generointi ja karsinta | `src/spike/tiles.ts` | STORY-008, STORY-010 |
| Värimorfi ja yhdistymisen häivytys | `src/spike/tiles.ts`, `noise.ts` | STORY-011 |
| Bench-reitti ja CDP-mittausskripti | `src/spike/metrics.ts`, `scripts/bench.mjs` | STORY-003 (suorituskykymittaus CI:hin) |

## 7. Suositus

Päätös luopua Phaser-overlaysta (CLAUDE.md, osio 13) vahvistuu työpöydän
mittauksella. Tyhjä maailma yltää 60 fps:ään tasolta 1 tasolle 17 integroidulla
näytönohjaimella, ja tarkkuus ja zoom toimivat syvimmällä tasolla. Lopullinen
vahvistus odottaa puhelimen 30 fps -mittausta. Jos puhelin jää alle tavoitteen,
ensimmäiset säädöt ovat generoinnin siirto workeriin, pienempi luontibudjetti ja
korkeampi jakokynnys. Nämä ovat budjettisäätöjä, eivätkä ne kyseenalaista yhden
renderöijän mallia.
