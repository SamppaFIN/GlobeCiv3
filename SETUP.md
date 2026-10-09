# SETUP — GlobeCiv3

Tee nämä järjestyksessä. Kohdat 1–4 kuittaavat alustuksen, eikä projekti
toimi oikein ennen niitä.

## A. Alustuksen kuittaus (nyt)

1. **Vastaa jäljellä oleviin kysymyksiin.** Yhdeksän alkuperäistä kysymystä
   ratkesi 2026-10-09 (osio 13). Jäljellä on viisi avointa kysymystä, joista
   kiireellisin on kysymys 4: onko "Infinite" organisaatio, jonka nimissä
   GPL-tekijänoikeus ilmoitetaan.
2. **Projektiohjeet (claude.ai).** Jos käytät tätä myös claude.ai-projektina,
   avaa **Set project instructions** ja **KORVAA** koko nykyinen sisältö
   (ALUSTUSTILA-ohje) tiedoston `INSTRUCTIONS-FINAL.md` sisällöllä.
3. **Project knowledge.** Raahaa sinne `CLAUDE.md`, `backlog.json` ja
   `docs/infinite-zoom-tutkimus.md`. Skeemat `schemas/*.schema.json` voivat
   olla mukana. Kun myöhemmin lataat uuden version jostain tiedostosta, poista
   vanha samalla, jotta knowledgeen ei jää kahta backlogia.
4. **Pohjat pois knowledgesta.** Poista `CLAUDE.*.md.template`,
   `design-brief.template.md` ja `backlog.example.json`. Claude vastaa myös
   knowledgeen jätetyistä tiedostoista, ja esimerkkiprojekti sekoittuisi
   oikeaan projektiin.

Claude Codessa `CLAUDE.md` luetaan automaattisesti projektin juuresta.
Myös `C:\Projects\CLAUDE.md` ladataan. Sen vastausprotokolla on sama kuin
tässä projektissa, mutta sen identiteetti (Aavistus) jää tämän projektin
identiteetin (Linssi) alle.

## B. Repo (STORY-002)

5. Luo GitHubiin **julkinen** ja tyhjä repo `SamppaFIN/GlobeCiv3` ilman
   README-, .gitignore- ja LICENSE-pohjia.
6. Kansiossa `C:\Projects\GlobeCiv3`:
   - `git init`
   - `LICENSE` (GPL v3, tekijänä Sami tai Infinite, katso avoin kysymys 4)
   - ensimmäinen commit ja push `main`-haaraan
7. Päivitä `backlog.json`:n `_meta.git_commit` ja `_meta.git_branch`, ja
   lataa uusi versio knowledgeen vanhan tilalle.
8. GitHubissa: **Settings → Pages → Source: GitHub Actions**.

## C. Design

9. Avaa **Claude Design** ja liitä sinne `design-brief.md` kokonaan.
   Suunnittele näkymät listan järjestyksessä, yksi kerrallaan.

## D. Seuraava askel

10. Aloita uusi keskustelu ja kirjoita:
    **"Tee STORY-001:n toteutussuunnitelma (PLAN-001)."**
    STORY-001 korjaa globin käynnistyksen. Sen jälkeen vuorossa on
    STORY-004, infinite zoom -prototyyppi, joka ratkaisee arkkitehtuurin.
