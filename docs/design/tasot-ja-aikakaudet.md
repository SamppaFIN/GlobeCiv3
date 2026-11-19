# GlobeCiv3 — tasojen ja aikakausien sisältö (STORY-099)

> Luonnos 2026-11-19 (Enki). Samin visio samalta illalta: peli on neuvonantajien
> simulaatio, jossa pelaaja säätää neuvonantajia ja kansa toteuttaa ja rakentaa.
> Jokaisella tasolla on omat rakennukset, yksiköt, politiikka ja uskonto, jotka
> vaikuttavat juuri sen tason toimintoihin, ja jokainen aikakausi avaa tasoille eri
> toimintoja. Ydinaseet tulevat vasta kehittyneessä pelissä, ja diplomatia tulee
> ennen niitä. Sami hyväksyy tai korjaa tämän suunnitelman ennen toteutusta.

## Periaatteet

1. **Pelaaja ohjaa neuvonantajia, kansa tekee.** Jokaisella tasolla on kolme
   neuvonantajaa ja piilotettu Ohjaan itse (STORY-096). Tämän suunnitelman sisältö on
   sitä, mitä neuvonantaja valitsee ja kansa rakentaa. Pelaajan valinta on linja, ei
   yksittäinen klikkaus.
2. **Kukin järjestelmä kuuluu yhdelle tasolle** (päätös 2026-11-19). Sama asia ei
   näy kahdella tasolla, vaan ylempi taso käyttää alemman valmiita tuotoksia
   kokonaisuuksina.
3. **Aikakausi avaa toimintoja.** Aikakausi vaihtuu keksinnöistä, eli tiedepuu on
   myös aikakausien kello (anunnakkien me-säädökset). Aikakausi näkyy tasopaneelissa
   (STORY-098), ja uusi aikakausi saa oman nousuhetkensä.
4. **Vain mekaniikat lainataan** (sääntö 4). Nimet ovat omia. Lähde on mainittu
   jokaisen rivin perässä, ja lähteen lisenssi ja luvut tarkistetaan ennen
   ensimmäistä lainattua lukua (avoin kysymys 15). Rivi ilman lähdettä on oma.

## Aikakaudet

| Aikakausi | Avautuu | Lähde |
|---|---|---|
| Varhaisaika | Pelin alussa | Kaikki esikuvat |
| Rauta-aika | Rautatyö ja yksi muu toisen polven keksintö | Civ III:n aikakaudet (Freeciv civ2civ3), omat ehdot |
| Teollinen aika | Höyryvoima (uusi keksintö) | Sama |
| Atomiaika | Atomifysiikka (uusi keksintö) | Sama |

Nykyinen keksintöpuu (Aakkoset, Pronssityö, Hautajaisriitit, Keramiikka, Muuraus,
Rahatalous, Kirjoitus, Lakikokoelma, Monarkia, Rakentaminen, Kartanteko, Ratsastus,
Rautatyö, Pyörä ja Matematiikka) kattaa varhaisajan ja rauta-ajan alun. Teollinen
aika ja atomiaika tarvitsevat uusia keksintöjä, ja ne kuuluvat MVP:n jälkeiseen
aikaan.

## Tasot × sisältö

Merkinnät: **nyt** = pelissä jo, **MVP** = tehdään MVP:ssä, **myöh.** = MVP:n jälkeen.

### Kaupunki (Settlers, Freeserf)

| | Varhaisaika | Rauta-aika | Teollinen aika | Atomiaika |
|---|---|---|---|---|
| Rakennukset | Saha, louhos, pelto, kalastamo (**nyt**); puunkaato → saha → lankut, pelto → mylly → leipomo (**MVP**, STORY-088) | Kaivokset, sulatto, paja, asepaja (myöh.) | Tehdas, voimala (myöh., oma) | Reaktori (myöh., oma) |
| Yksiköt | Kantajat ja rakentajat eli muurahaiset, jotka kantavat tavarat näkyvästi (**MVP**, STORY-088) | Kaivosmiehet, sepät | Koneet | — |
| Politiikka | Jakelulinja: minne ruoka ja lankut menevät ensin (Settlersin jakoasetukset; **MVP**, kuvernööri valitsee, STORY-090) | Työkalujen jako | — | — |
| Uskonto | Pyhäkkö: asukkaat tyytyväisiä, työ nopeampaa (oma; myöh.) | — | — | — |
| Vaikuttaa | Rakentamisen tahtiin ja siihen, milloin valmis settlementti syntyy (STORY-089) | | | |

### Kaupunkialue (Civilization I, Freeciv civ1)

| | Varhaisaika | Rauta-aika | Teollinen aika | Atomiaika |
|---|---|---|---|---|
| Rakennukset | Temppeli, viljavarasto, muuri, kirjasto, ihmeet (**nyt**) | Tori, vesijohto, areena (**nyt**) | Tehdas, pankki, rautatie (myöh.) | Ydinvoimala, ohjustorjunta, joka suojaa kaupunkia planeettatason iskuilta (myöh.) |
| Yksiköt | Tiedustelija, uudisasukas, soturi, falangi (**nyt**) | Ratsumies, miekkamies, sotavaunut, katapultti (**nyt**) | Tykistö, rautatiejoukot (myöh.) | — |
| Politiikka | Itsevaltius → monarkia (**nyt**, valtion neuvonantaja hoitaa) | Tasavalta (myöh.) | Demokratia, kommunismi (myöh.) | — |
| Uskonto | Temppelit rauhoittavat (**nyt**) | Papisto: temppeli rauhoittaa kaksi (oma, myöh.) | — | — |
| Vaikuttaa | Kasvuun, kaupunkien perustamiseen ja tavoitteeseen "kolme kaupunkia" | | | |

### Lääni (Civilization III, Freeciv civ2civ3)

| | Varhaisaika | Rauta-aika | Teollinen aika | Atomiaika |
|---|---|---|---|---|
| Rakennukset | Tiet ja resurssien yhdistäminen: tiellä kaupunkiin yhdistetty resurssi hyödyttää koko lääniä (**MVP**, STORY-093) | Maaherran hovi: vähentää kaukaisten kaupunkien hukkaa (civ2civ3:n kakkospalatsi; **MVP**, STORY-093) | Teollisuusalue (myöh.) | Lentokenttä (myöh.) |
| Yksiköt | Retkikunnat (**nyt**), työläiset (**MVP**, STORY-093) | Karavaanit (myöh.) | — | — |
| Politiikka | Kulttuurirajat: kulttuuri laajentaa rajoja (civ2civ3; **MVP**, STORY-093) | Maaherran painotus | — | — |
| Uskonto | Pyhät paikat: temppelit tuovat kulttuuria, ja usko leviää rajojen yli (Civ V:n uskonpaine, Unciv; myöh.) | | | |
| Vaikuttaa | Rajoihin, asutettaviin alueisiin ja tavoitteeseen "neljä lääniä" | | | |

### Valtio (Civilization V, Unciv)

| | Varhaisaika | Rauta-aika | Teollinen aika | Atomiaika |
|---|---|---|---|---|
| Rakennukset | Ihmeet koko valtiolle (**nyt** osin) | Kansalliset ihmeet (myöh.) | — | Ydinohjelma, joka avaa planeettatason ydinaseet (Civ V:n Manhattan-projekti; myöh.) |
| Yksiköt | Armeijat Kenraalin johdolla (**nyt**) | Diplomaatit (myöh.) | — | — |
| Politiikka | Valtion linja, verot, kaupunkivaltioiden suosio, diplomatia, sota ja kauppa (**nyt** osin, STORY-094 kokoaa) | Linjaukset kuten perinne, vapaus ja kunnia (Civ V:n sosiaaliset linjaukset, Unciv; myöh.) | Ideologia (myöh.) | — |
| Uskonto | Kantajumala → valtionuskonto → opit (Civ V, Unciv; myöh.) | | | |
| Vaikuttaa | Sotaan, kauppaan, tieteeseen ja tavoitteeseen "valtaa kotivaltio" | | | |

### Planeetta (Nuclear War; avointa lähdettä ei tunneta, kaikki omaa)

| | Varhaisaika | Rauta-aika | Teollinen aika | Atomiaika |
|---|---|---|---|---|
| Rakennukset | — | — | Radioasema propagandalle | Ohjussiilot, lentotukikohdat, torjunta |
| Yksiköt | — | Lähettiläät | — | Ohjukset, pommikoneet |
| Politiikka | — | Lähettiläät ja liitot | Propaganda, joka kääntää toisen johtajan väestöä omaksi | Ydinpelote, aseistariisunta |
| Uskonto | — | — | Julistukset eli ideologian paine (Civ V:n ideologiat; oma muoto) | — |
| Vaikuttaa | Johtajien väliseen voimatasapainoon: viimeinen pystyssä tai suurin väestö voittaa | | | |

Ydinsotakokeilu (STORY-097) testaa planeettatason atomiaikaa testilinkistä ennen kuin
aikakaudet ovat pelissä. Siinä rauta-ajan diplomatia ja teollisen ajan propaganda
tiivistetään kokeilun alkuvaiheiksi.

## Jako storyihin

| Story | Tähän suunnitelmaan liittyvä sisältö |
|---|---|
| STORY-088 Tuotantoketjut | Kaupungin varhaisajan ketjut ja muurahaiset |
| STORY-089 Valmis settlementti | Ketjujen tuotos, josta syntyy settlementti |
| STORY-090 Kuvernööri pelaa kaupunkitasoa | Jakelulinja kuvernöörin valintana |
| STORY-091 ja 092 Kaupunkialue | Nykyinen Civ I -sisältö pysyy; uutta vain valmiin settlementin asutus |
| STORY-093 Läänitaso | Tiet ja resurssien yhdistäminen, maaherran hovi, kulttuurirajat ja työläiset |
| STORY-094 Valtiotaso | Linja, verot, kaupunkivaltiot ja diplomatia kootaan valtiotasolle |
| STORY-098 Tasopaneeli | Aikakausi ja tason tiedot näkyviin |
| STORY-097 Ydinsotakokeilu | Planeetan atomiaika |
| Uusi story (MVP:n jälkeen) | Aikakaudet: rauta-ajan raja, teollinen aika, atomiaika ja niiden keksinnöt |
| Uusi story (MVP:n jälkeen) | Uskonto: pyhät paikat ja valtionuskonto |

MVP:hen ei tule uusia storyja: varhaisaika ja rauta-aika ovat jo nykyisten
storyjen sisältöä, ja uskonto, teollinen aika ja atomiaika tulevat MVP:n jälkeen
(avoin kysymys 19).

## Kysymykset Samille

1. **Hallitusmuoto:** kuuluuko se kaupunkialueelle (Civ I) vai valtiolle, kuten nyt?
   Ehdotus: valtiolle, koska se koskee kaikkia kaupunkeja ja valtion neuvonantaja
   hoitaa sen jo.
2. **Uskonnon syvyys:** riittääkö MVP:n jälkeen yksi uskontojärjestelmä
   (valtionuskonto ja sen leviäminen), vai saako jokainen taso omansa taulukon
   mukaan?
3. **Aikakauden vaihto:** avainkeksinnöt (ehdotus), kerättyjen keksintöjen määrä vai
   pelivuodet?
