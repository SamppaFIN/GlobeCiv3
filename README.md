# 🌍 GlobeCiv3

Selaimessa toimiva sivilisaatiosimulaatio heksaplaneetalla. Tavoitteena on
zoomata saumattomasti planeetasta yksittäiseen kansalaiseen ilman, että
näkymä vaihtuu.

**Pelaa:** https://samppafin.github.io/GlobeCiv3/

Projekti on varhaisessa vaiheessa. Tällä hetkellä näkyvissä on 3D-heksaglobi
(362 aluetta). Suunnitelma ja arkkitehtuuri ovat tiedostoissa
[docs/infinite-zoom-tutkimus.md](docs/infinite-zoom-tutkimus.md) ja
[backlog.json](backlog.json).

## Käynnistys

Vaatii Node.js:n 20.19+ tai 22.12+.

```
npm install
npm run dev      # kehityspalvelin: http://localhost:3000/GlobeCiv3/
npm test         # yksikkötestit (Vitest)
npm run build    # tuotantobuild dist/-kansioon
```

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
