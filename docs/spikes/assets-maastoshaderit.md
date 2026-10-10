# Assets-kansion maastoshaderit: sopivatko planeetan mallintamiseen?

> Tutkittu 2026-10-10 Samin pyynnöstä. Kansio `Assets/` (README.md, shaders.ts,
> ShaderTexture.ts, ThreeShaderTexture.ts) on työpuussa, mutta sitä ei ole
> commitoitu, koska merishaderin lisenssi ei sovi repoon (kohta 4).

## 1. Mitä kansiossa on

Viisi animoitua, ylhäältä kuvattua maisemashaderia: meri, tasanko, metsä, vuori
ja jäätikkö. Ne ovat WebGL1-fragmenttishadereita, jotka piirtävät neliön kuvan
pikselikoordinaateista (`gl_FragCoord`), ajasta, zoomista ja siirrosta. Kaksi
käärettä renderöi ne omaan canvasiin tai Three.js:n render targetiin, jolloin
tulos on tavallinen tekstuuri.

## 2. Voiko niillä mallintaa planeetan?

**Ei.** Shaderit tuottavat 2D-kuvan tekstuurin koordinaateissa. Ne eivät tiedä
paikkaa pallolla, eivät tuota korkeutta eivätkä ole deterministisiä paikan
suhteen. Planeetan muoto, mantereet ja maastotyyppien jakauma tulevat edelleen
maastofunktiosta f(siemen, piste, taso) (CLAUDE.md, sääntö 3).

## 3. Voiko niitä käyttää ruutujen ulkoasuun alimmilla tasoilla?

**Osittain, esirenderöityinä tekstuureina kaupunkialuetasolla.** Mittaus:
Intel UHD, Chrome, yksi 1024 × 1024 -kuva, GPU synkronoitu `readPixels`-kutsulla.

| Shaderi | ms / kuva (1024²) | Huomio |
|---|---|---|
| Metsä | 34,7 | Puiden latvukset ja aukiot, tasainen kuvio |
| Jäätikkö | 26,3 | Kiinteä sommitelma: laakso, sulamisvesipuro ja reunojen kalliot |
| Meri | 18,0 | Turkoosi aallokko ja välkkeet, tasainen kuvio |
| Tasanko | 10,7 | Peltolohkot ja yksi joki kuvan halki (kiinteä) |
| Vuori | 10,0 | Varjostettu korkokuva, lumi, järvet ja korkeuskäyrät |

- **Pikselikohtainen käyttö pelin shaderissa ei mahdu budjettiin.** Metsä maksaa
  noin 33 ns pikseliltä, eli koko 1280 × 800 -näkymä noin 33 ms, kun koko framen
  budjetti on 16,7 ms. Puhelimella hitaampi.
- **Kertaalleen renderöity tekstuuri on halpa:** 10–35 ms latauksessa per tyyppi
  ja pelissä yksi tekstuurihaku pikseliltä. Animoidun meren voi päivittää
  pienempänä harvoin tai jättää paikalleen.
- **Eivät ole saumattomasti toistuvia** (README sanoo saman). Laajalla alueella
  toisto näkyy saumoina. Ratkaisuja: heksasekoitus (kolme siirrettyä näytettä,
  jotka sekoitetaan heksasolujen rajoilla) tai ruutukohtainen pala, jolloin
  jokainen heksaruutu näyttää oman otteensa tekstuurista.
- **Tasangossa ja jäätikössä on kiinteä sommitelma**, joka toistuisi jokaisessa
  ruudussa (sama joki, sama laakso). Ne sopivat vain muokattuina ilman
  sommitelmaa.
- **Viisi tyyppiä yhteentoista maastoon:** meri → valtameri, tasanko →
  ruohomaa ja tasanko, metsä → metsä ja viidakko (värimuunnos), vuori → vuoret ja
  kukkulat, jäätikkö → arktinen. Aavikko, suo ja tundra puuttuvat.
- **Värit eivät vastaa Kartografi-tokeneita** (esimerkiksi turkoosi meri, kun
  `--terrain-ocean-*` on tumma sininen). Värit kannattaa ottaa tokeneista ja
  käyttää shaderia vain pinnan yksityiskohtana.
- **Syvällä zoomissa resoluutio loppuu.** Tasoilla 8–17 tekstuuri häivytetään
  pois, ja jatkuva proseduraalinen maasto jatkuu, kuten nyt.

## 4. Lisenssi: merishaderi on johdettu Seascapesta

Merishaderin aaltofunktio `oct` ja taivasfunktio `sky` vastaavat lähes rivi
riviltä Alexander Alekseevin (TDM) "Seascape"-shaderin funktioita `sea_octave`
ja `getSkyColor` (Shadertoy, 2014). Myös oktaavisilmukka on sama: kaksi
aikasiirrettyä kutsua, taajuus × 1,9, aallokon jyrkkyyden sekoitus 0,2 ja
kiertomatriisi `mat2(1.6, 1.2, -1.2, 1.6)`. Seascape on lisensoitu
CC BY-NC-SA 3.0 -lisenssillä, joka kieltää kaupallisen käytön ja vaatii saman
lisenssin. Se ei sovi yhteen GPL v3:n kanssa, joten merishaderia ei voi ottaa
julkiseen repoon sellaisenaan.

Muut neljä shaderia näyttävät yleisillä tekniikoilla kirjoitetuilta (value
noise, fbm, Voronoi-solut). Niiden alkuperä kannattaa silti varmistaa samalla,
koska hajautusfunktio `h1` on tunnettu verkkoesimerkki.

Lähteet:
[Seascape-kopio lisenssiotsakkeineen (Fuchsia)](https://fuchsia.googlesource.com/fuchsia/+/038d2b9/src/ui/examples/shadertoy/client/glsl_strings.cc),
[Seascape-shaderin Godot-käännös](https://godotshaders.com/shader/seascape-shader/).

## 5. Suositus

1. Merishaderi kirjoitetaan uudelleen omana, tai Claude Designilta pyydetään
   oma, saumattomasti toistuva vesikuvio. Assets-kansiota ei commitoida ennen
   tätä.
2. STORY-023:ssa ruudun pohjaväri tulee tokeneista ja maastolla on oma merkki.
   Pintakuviot (metsä, vuori sekä tasanko ja jäätikkö ilman kiinteää
   sommitelmaa) renderöidään latauksessa tekstuureiksi ja näytetään
   kaupunkialuetasolla heksasekoituksella.
3. Shadereita ei ajeta pikseleittäin pelin pintashaderissa.
