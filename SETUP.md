# SETUP — GlobeCiv3 (uusintahaastattelu 2026-11-19)

Tee nämä järjestyksessä. Kohdat 1–3 kuittaavat alustuksen, eikä projekti
toimi oikein ennen niitä.

## A. Alustuksen kuittaus claude.aissa (nyt)

1. **Projektiohjeet.** Avaa projektissa "Globe Civ 3.0" kohta **Set project
   instructions** ja **KORVAA** koko nykyinen sisältö (ALUSTUSTILA-ohje)
   tiedoston `INSTRUCTIONS-FINAL.md` sisällöllä.
2. **Project knowledge.** Raahaa sinne `CLAUDE.md` ja `backlog.json`.
   Suositus: lisää myös `docs/infinite-zoom-tutkimus.md` reposta, koska ohjeet
   viittaavat siihen arkkitehtuurikysymyksissä. Skeemat `schemas/*.schema.json`
   voivat olla mukana. Kun myöhemmin lataat uuden version jostain tiedostosta,
   poista vanha samalla, jotta knowledgeen ei jää kahta backlogia.
3. **Pohjat pois knowledgesta.** Poista `CLAUDE.*.md.template`,
   `design-brief.template.md` ja `backlog.example.json`, jos niitä on. Tämän
   projektin knowledge oli alustuksen aikaan tyhjä, joten todennäköisesti
   poistettavaa ei ole, mutta tarkista. Claude vastaa myös knowledgeen
   jätetyistä tiedostoista, ja esimerkkiprojekti sekoittuisi oikeaan
   projektiin.

## B. Repo

4. ~~**Vie uudet tiedostot repoon.**~~ Tehty 2026-11-19: Enki commitoi
   tiedostot mainiin (STORY-079).
5. **Hyväksy tai palauta kirjatut storyt.** Storyt 073–078 (resurssien
   rakennukset, heksakortti, nimilappu, diplomatia, sota ja vaihdot) ovat
   tilassa `review`. Pelaa ne Pagesista ja kerro, mitkä hyväksyt. Sama koskee
   STORY-079:ää eli tätä backlogin jälkikirjausta. Nisaba merkitsee
   hyväksytyt tilaan `done`.
6. **Vahvista backlogin muoto.** `backlog.json` sisältää nyt vain epicit ja
   storyt (114 kt aiemman noin 600 kt:n sijaan). Suunnitelmat ja tiketit ovat
   ennallaan kansioissa `docs/plans` ja `docs/tickets`. Jos haluat ne takaisin
   samaan tiedostoon, sano se, niin päätös kumotaan.

## C. Design

7. Avaa **Claude Design** ja liitä sinne `design-brief.md` kokonaan. Aloita
   näkymistä 1–2 (tason tavoite ja nousuhetki).

## D. Seuraava askel

8. Aloita uusi keskustelu **Opuksella** (Enki) ja kirjoita:
   **"Tee STORY-083:n toteutussuunnitelma: Inanna-pelitestaaja."**
   Inanna ja lähtötason pelitesti (STORY-084) tehdään ennen yhtään
   pelattavuusmuutosta, jotta sekavuus on mitattu ennen korjaamista.
   STORY-080–082 (repohygienia, aineistot ja TypeScript 7) eivät muuta
   pelattavuutta, joten ne voi tehdä rinnalla.
