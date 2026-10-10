# 🌍 GlobeCiv3

Selaimessa toimiva sivilisaatiosimulaatio heksaplaneetalla. Kartta piirtyy sitä
mukaa kuin tutkit: aloitat yhdestä kaupunkialueesta sumun keskeltä, ja zoom
ulos aukeaa taso kerrallaan. Planeetasta yksittäiseen ruutuun zoomataan
saumattomasti ilman, että näkymä vaihtuu.

**Pelaa:** https://samppafin.github.io/GlobeCiv3/ (toimii puhelimessa ja
työpöydällä)

## Pelin kulku

- **Aloitus.** Pyöritä planeettaa ja paina *Uusi peli*. Kamera laskeutuu
  arvottuun kaupunkialueeseen, ja kaikki sen ulkopuolella on sumussa.
- **Tutkiminen.** Kaksi tiedustelijaa kartoittaa sumua omin päin. Moodit
  *Tutki*, *Kerää* ja *Puolusta* ja lippu ohjaavat niitä. Aika kulkee
  reaaliajassa (noin 1,5 s per päivä), ja pelin voi tauottaa tai nopeuttaa
  (1×, 2× ja 4×).
- **Löydöt.** Joskus tiedustelija tekee löydön. Peli pysähtyy, ja valitset
  kahdesta vaihtoehdosta toisen.
- **Kaupungit.** Valitse uudisasukas, napauta karttaa paikan merkiksi ja paina
  *Perusta kaupunki tähän*. Kaupunki kasvaa ja rakentaa sotureita ja
  uudisasukkaita.
- **Uudet tasot.** Kun 60 % kotiläänistä on kartoitettu, läänitaso aukeaa
  (alueiden painotus ja retkikunnat). Kun 60 % kotivaltiosta on kartoitettu,
  valtiotaso aukeaa (valtion linja ja tavoitelääni).

## Ohjaus

| | Työpöytä | Puhelin |
|---|---|---|
| Zoom | hiiren rulla | nipistys |
| Liikuta karttaa | veto | veto |
| Valitse alue tai yksikkö | klikkaus | napautus |
| Sukella alueeseen | toinen klikkaus tai tuplaklikkaus | toinen napautus |
| Taso ylös (kun auki) | `−` tai rulla | nipistys ulos |
| Pyöritä aloitusplaneettaa | veto tai nuolinäppäimet | veto |

HUDin napit toimivat myös näppäimistöllä (Tab ja Enter).

## Kehitys

Vaatii Node.js:n 20.19+ tai 22.12+.

```
npm install
npm run dev        # kehityspalvelin: http://localhost:3000/GlobeCiv3/
npm test           # yksikkötestit (Vitest)
npm run build      # tuotantobuild dist/-kansioon
npm run test:e2e   # build ja selaintestit (Playwright, vaatii Chromen)
```

`CI=1 npx playwright test` ajaa selaintestit kuten GitHub Actions
(SwiftShader ilman näytönohjainta). Osoitteen parametrit:

- `?seed=N` aloittaa pelin samasta paikasta joka kerta.
- `?free` ohittaa aloituksen ja sumun, jolloin koko maailmaa voi tutkia vapaasti.

Kansiot:

- `src/globe` sisältää renderöinnin, kameran, pinnan ruudut ja shaderit.
- `src/game` sisältää pelilogiikan (yksiköt, löydöt, kaupungit, kello ja
  kartoitus), ja sen testit ajetaan Nodessa.
- `src/ui` sisältää HUDin ja kortit.
- `tests/e2e` sisältää selaintestit.
- `docs` sisältää suunnitelmat, tiketit, designin ja tutkimukset. Projektin
  säännöt ja päätökset ovat tiedostossa [CLAUDE.md](CLAUDE.md) ja työlista
  tiedostossa [backlog.json](backlog.json).

## Lähteet

- Pelin perussäännöt ja luvut (maastojen tuotot, kasvu ja rakennuskustannukset)
  tulevat Civilization I:n mekaniikasta [Freecivin](https://github.com/freeciv/freeciv)
  civ1-sääntösarjan kautta (GPL). Lähteet ovat koodikommenteissa. Nimet,
  tekstit ja grafiikat ovat omia.
- Ilme (Kartografi) ja käyttöliittymän tyylit ovat Claude Designin
  suunnittelemia.
- Fontti: Inter (SIL Open Font License 1.1, paketti `@fontsource/inter`).
- Kuvakkeita: [Phosphor](https://phosphoricons.com/) (MIT).
- Ruutujen pintakuviot: oma vesi sekä pelto, metsä ja korkokuva, jotka on
  siirretty Clauden Samin pyynnöstä tekemistä shadereista.

## Taustaa

GlobeCiv3 yhdistää kaksi aiempaa projektia:

- [GlobeCiv2.0](https://github.com/SamppaFIN/GlobeCiv2.0): 2D-sivilisaatiosimulaatio, josta simulaatiologiikka siirretään
- [GlobeCiv](https://github.com/SamppaFIN/GlobeCiv): alkuperäinen Three.js-heksaglobi

## Lisenssi

Copyright (C) 2026 Sami Räisänen

Tämä ohjelma on vapaa ohjelmisto: voit jakaa ja muokata sitä GNU General
Public Licensen ehdoilla, sellaisina kuin Free Software Foundation ne on
julkaissut, joko lisenssin version 3 tai (valintasi mukaan) minkä tahansa
myöhemmän version ehdoilla.

Ohjelmaa jaetaan siinä toivossa, että siitä on hyötyä, mutta ILMAN MITÄÄN
TAKUUTA, edes oletettua takuuta KAUPALLISESTA HYÖDYNNETTÄVYYDESTÄ tai
SOVELTUVUUDESTA TIETTYYN TARKOITUKSEEN. Katso lisätiedot GNU General Public
Licensestä, joka on tiedostossa [LICENSE](LICENSE).

SPDX-License-Identifier: GPL-3.0-or-later
