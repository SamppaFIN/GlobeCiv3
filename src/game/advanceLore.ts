/**
 * advanceLore.ts — what each advance is and a saying from its time (STORY-109; Sami 2026-11-22:
 * each science gets an explanation of what it does and a historical saying).
 *
 * The explanations are own text. The sayings are real, from works long in the public domain,
 * translated into Finnish by us (own translation from the original, checked against the
 * English translation named). None is taken from the model games (rule 4). Sources:
 *  - Herodotus, Histories 5.58 (Godley 1920, Loeb): the Phoenicians with Cadmus brought letters
 *  - Plato, Phaedrus 275a (Jowett 1892): Thamus to Theuth on writing and memory
 *  - Hesiod, Works and Days 150–151 (Evelyn-White 1914): the race of bronze, no black iron
 *  - Pliny the Elder, Natural History 34.138 (Bostock & Riley 1857, ch. 39): iron the most
 *    useful and the most fatal instrument (optimo pessimoque vitae instrumento)
 *  - Thucydides 2.43 (Crawley 1874): Pericles' funeral oration, the whole earth the tomb
 *  - Hesiod, Works and Days 25 (Evelyn-White 1914): potter against potter, craftsman against craftsman
 *  - Suetonius, Life of Augustus 28.3 (Rolfe 1914): left marble the city he found brick
 *  - Aristotle, Nicomachean Ethics 5.5, 1133b (Ross 1908): money as a measure makes goods commensurate
 *  - The Code of Hammurabi, prologue (King 1910): that the strong should not harm the weak
 *  - Homer, Iliad 2.204 (Murray 1924): the rule of many is not good; let there be one ruler
 *  - Vitruvius, On Architecture 1.3.2 (Morgan 1914): durability, convenience and beauty
 *  - Ptolemy, Geography 1.1 (Stevenson 1932): a representation of the whole known world
 *  - Xenophon, On the Art of Horsemanship 11.6 (Marchant 1925, Perseus): what a horse does
 *    under constraint it does without understanding, like a dancer whipped and goaded
 *  - Boethius, The Consolation of Philosophy 2.2 (Cooper 1902): Fortune turns her wheel
 *  - Proclus, Commentary on Euclid's Elements I, 68 (Friedlein 1873; Morrow 1970): Euclid's
 *    answer to Ptolemy, no royal road to geometry
 * STORY-121 (each checked in its source 2026-11-26):
 *  - Heraclitus, fragment B123 Diels–Kranz (Burnet 1920, fr. 10): nature loves to hide
 *  - Francis Bacon, Essays (1625), L. Of Studies: reading maketh a full man; conference a ready
 *    man; and writing an exact man
 *  - Adam Smith, The Wealth of Nations (1776), book I, chapter 2 (Cannan 1904): not from the
 *    benevolence of the butcher, the brewer, or the baker
 *  - Plato, Apology 38a (Jowett 1892): the unexamined life is not worth living
 *  - Galileo, Il Saggiatore (1623) 6, from the Italian: philosophy is written in this grand
 *    book, the universe, always open to our eyes, and it is written in the language of mathematics
 *  - Caesar, The Gallic War 4.17 (McDevitte & Bohn 1869): to cross by boats he deemed neither
 *    safe enough nor worthy of his own dignity or that of the Roman people, before the bridge
 *    over the Rhine
 */
import type { Advance } from './science';

export interface Lore {
  /** What the advance is, in the world: own text. */
  what: string;
  /** A saying of its time: the words in Finnish, who said them, and where. */
  quote: { text: string; who: string; where: string };
}

export const ADVANCE_LORE: Record<Advance, Lore> = {
  alphabet: {
    what: 'Oma merkki kullekin äänteelle. Parikymmentä merkkiä riittää minkä tahansa sanan kirjoittamiseen, joten kirjoittamaan voi oppia muukin kuin kirjuri.',
    quote: { text: 'Kadmoksen mukana tulleet foinikialaiset toivat Hellakseen monia taitoja ja niiden joukossa kirjaimet, joita kreikkalaiset eivät ennen tunteneet.', who: 'Herodotos', where: 'Historiateos 5.58' },
  },
  writing: {
    what: 'Puhe säilyy savitaulussa ja kääröissä. Tieto kulkee kaupungista toiseen ja sukupolvelta seuraavalle, ja kirjastot keräävät sen yhteen.',
    quote: { text: 'Tämä keksintö tuo oppijoiden sieluihin unohdusta, sillä he lakkaavat käyttämästä muistiaan.', who: 'Platon', where: 'Faidros 275a' },
  },
  bronze: {
    what: 'Kupari ja tina sulatetaan yhteen pronssiksi, joka on kovempaa kuin kumpikaan. Siitä valetaan työkaluja, kilpiä ja suuria patsaita.',
    quote: { text: 'Heidän aseensa olivat pronssia ja talonsa pronssia, ja pronssilla he tekivät työnsä; mustaa rautaa ei vielä ollut.', who: 'Hesiodos', where: 'Työt ja päivät 150–151' },
  },
  iron: {
    what: 'Rautamalmi pelkistetään ahjossa ja taotaan. Rautaa löytyy lähes kaikkialta, joten sitä riittää kansan työkaluihin ja kokonaisten joukkojen aseisiin.',
    quote: { text: 'Rauta on ihmisen kädessä samalla kertaa hyödyllisin ja tuhoisin työkalu.', who: 'Plinius vanhempi', where: 'Luonnonhistoria 34.138' },
  },
  ceremonial: {
    what: 'Vainajat haudataan menoin ja muistetaan yhdessä. Yhteiset riitit sitovat kansan toisiinsa, ja niiden paikoille nousevat temppelit.',
    quote: { text: 'Kuuluisien miesten hautana on koko maa.', who: 'Thukydides', where: 'Peloponnesolaissota 2.43, Perikleen hautajaispuhe' },
  },
  pottery: {
    what: 'Savi muovataan ja poltetaan ruukuiksi, joissa vilja, öljy ja viini säilyvät pitkän talven yli. Varasto tasaa katovuodet.',
    quote: { text: 'Savenvalaja kantaa kaunaa savenvalajalle ja kirvesmies kirvesmiehelle.', who: 'Hesiodos', where: 'Työt ja päivät 25' },
  },
  masonry: {
    what: 'Kivet ja poltetut tiilet ladotaan vuoroittain laastiin. Muuri kestää vihollisen ja vuosisadat, ja kaupunki saa pysyvät rajansa.',
    quote: { text: 'Sain kaupungin tiilisenä, ja jätän sen marmorisena.', who: 'Augustus', where: 'Suetonius, Augustuksen elämä 28.3' },
  },
  currency: {
    what: 'Leimattu metalli kelpaa jokaisessa kaupassa. Sillä mitataan tavaroiden arvo, eikä vaihtoon tarvita toista, joka haluaa juuri sinun tavarasi.',
    quote: { text: 'Raha mittana tekee tavarat yhteismitallisiksi ja saattaa ne tasapainoon.', who: 'Aristoteles', where: 'Nikomakhoksen etiikka 1133b' },
  },
  law: {
    what: 'Lait kirjoitetaan kaikkien nähtäville, ja tuomio seuraa samaa sääntöä jokaiselle. Riidat ratkeavat ilman kostoa.',
    quote: { text: 'Jotta oikeus vallitsisi maassa ja pahantekijät tuhoutuisivat, eikä väkevä sortaisi heikkoa.', who: 'Hammurabin lakikokoelma', where: 'johdanto' },
  },
  monarchy: {
    what: 'Yksi hallitsija, hovi ja perimysjärjestys. Valta pysyy koossa, ja käskyt kulkevat koko valtakuntaan.',
    quote: { text: 'Monien valta ei ole hyvä. Olkoon yksi hallitsija, yksi kuningas.', who: 'Homeros', where: 'Ilias 2.204' },
  },
  construction: {
    what: 'Kaari, laasti ja tarkka mittaus tekevät suurista rakennuksista mahdollisia. Vesijohdot tuovat veden kaupunkiin, ja areenat kokoavat kansan.',
    quote: { text: 'Kaikki on rakennettava niin, että siinä on lujuutta, käyttökelpoisuutta ja kauneutta.', who: 'Vitruvius', where: 'Arkkitehtuurista 1.3.2' },
  },
  mapmaking: {
    what: 'Rannat, joet ja kaupungit piirretään mittakaavaan ja ilmansuuntiin. Matkan voi suunnitella ennen kuin lähtee, ja meri muuttuu tieksi.',
    quote: { text: 'Maantiede on piirroksin tehty kuva koko tunnetusta maailmasta ja kaikesta, mitä siihen kuuluu.', who: 'Klaudios Ptolemaios', where: 'Maantiede 1.1' },
  },
  horseback: {
    what: 'Hevonen kesytetään kantamaan ratsastajaa. Viestit, kauppa ja sotajoukot kulkevat moninkertaisella vauhdilla.',
    quote: { text: 'Mitä hevonen tekee pakotettuna, sen se tekee ymmärtämättä, eikä siinä ole kauneutta, yhtä vähän kuin tanssijassa, jota ruoskitaan ja piikitään.', who: 'Ksenofon', where: 'Ratsastustaidosta 11.6' },
  },
  wheel: {
    what: 'Pyörä ja akseli kantavat kuorman, jota yksikään selkä ei jaksa. Kärryt, vaunut ja savenvalajan pyörä syntyvät samasta ajatuksesta.',
    quote: { text: 'Minä pyöritän pyörääni ja iloitsen, kun alin nousee ylimmäksi ja ylin vajoaa alimmaksi.', who: 'Boethius', where: 'Filosofian lohdutus 2.2, Onnettaren sanat' },
  },
  mathematics: {
    what: 'Luku, mitta ja todistus. Pellot mitataan, rakennusten lujuus lasketaan ja tähtien kulku ennustetaan ennen kuin mitään nähdään.',
    quote: { text: 'Geometriaan ei ole kuninkaantietä.', who: 'Eukleides', where: 'kuningas Ptolemaiokselle Prokloksen mukaan' },
  },
  mysticism: {
    what: 'Tähtien liike, unet ja enteet luetaan jumalten viesteiksi. Papit ja ennustajat kokoavat kansan temppeleihin, ja pyhät paikat rauhoittavat levottomia mieliä.',
    quote: { text: 'Luonto rakastaa kätkeytyä.', who: 'Herakleitos', where: 'Fragmentti B123 (Diels–Kranz)' },
  },
  literacy: {
    what: 'Lukemaan oppii muukin kuin kirjuri. Lait, kauppakirjat ja tarinat luetaan ääneen toreilla, ja suuri kirjasto kokoaa yhteen kaiken, mitä muut kansat tietävät.',
    quote: { text: 'Lukeminen tekee ihmisestä täyden, keskustelu valmiin ja kirjoittaminen täsmällisen.', who: 'Francis Bacon', where: 'Esseet (1625), Opiskelusta' },
  },
  trade: {
    what: 'Karavaanit kuljettavat tavaraa kaupungista toiseen. Kukin kaupunki tekee sitä, minkä osaa parhaiten, ja saa muut tavarat vaihdossa, ja yhteisvoimin nousevat suuret ihmeet.',
    quote: { text: 'Emme odota päivällistämme teurastajan, panimomestarin tai leipurin hyväntahtoisuudesta, vaan siitä, että he katsovat omaa etuaan.', who: 'Adam Smith', where: 'Kansojen varallisuus (1776), kirja I, luku 2' },
  },
  philosophy: {
    what: 'Ajattelijat kysyvät, mitä ovat hyvä, totuus ja oikeus, ja kiistelevät vastauksista julkisesti. Ensimmäinen filosofien koulu saa kokonaisen sukupolven ajattelemaan.',
    quote: { text: 'Tutkimaton elämä ei ole ihmiselle elämisen arvoista.', who: 'Sokrates', where: 'Platon, Sokrateen puolustuspuhe 38a' },
  },
  astronomy: {
    what: 'Tähtien ja planeettojen radat mitataan ja kirjataan vuodesta toiseen. Kalenteri pitää kylvöt oikeassa ajassa, ja tähtitorni tekee kaupungistaan oppineiden keskuksen.',
    quote: { text: 'Filosofia on kirjoitettu tähän suureen kirjaan, maailmankaikkeuteen, joka on alati auki silmiemme edessä, ja se on kirjoitettu matematiikan kielellä.', who: 'Galileo Galilei', where: 'Il Saggiatore (1623), 6' },
  },
  bridges: {
    what: 'Kivestä ja puusta rakennetaan siltoja jokien ja rotkojen yli. Tie ei enää kierrä estettä, ja rakentajat oppivat tekemään tiet puolessa ajassa.',
    quote: { text: 'Laivoilla ylittämistä Caesar ei pitänyt kyllin turvallisena eikä omalle eikä Rooman kansan arvolle sopivana.', who: 'Julius Caesar', where: 'Gallian sota 4.17, ennen siltaa Reinin yli' },
  },
};
