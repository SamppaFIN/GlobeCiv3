/**
 * nuclearPanel.ts — the nuclear war's screens (STORY-126, a trial at ?planet): the gallery of
 * leaders, the leaders' row with their faces, the player's orders, the playback of a round
 * with speech bubbles and flights on the globe, the log, the city marks and the end card.
 *
 * The panel only plays back the round's events (src/game/nuclear.ts computes the round at
 * once): a skip or reduced motion shows the same end. Lines are chosen from the war's seed,
 * the round and the event's place (leaders.ts), never from the game's random. Text goes in
 * with textContent; the faces are the constant SVG of leaderPortraits.ts.
 */
import {
  alive, BOMBER_LOAD, canOrder, citiesOf, loaded, MEGATONS, newWar, offends, peopleOf, play, PLAYER, score,
  type Order, type War, type WarEvent,
} from '../game/nuclear';
import { choose, lineOf, mishapText, outcomeText, PERSONAS, personaOf, PLAYER_PERSONA, TEMPERS, type Mood, type Persona, type Say } from '../game/leaders';
import { leaderFace } from './leaderPortraits';

export interface CityRef { leader: number; city: number }

/** What the panel asks of the globe (main.ts). */
export interface WarStage {
  /** The screen spot of a leader's city, or null behind the globe. */
  cityAt(at: CityRef): [number, number] | null;
  /** A flight from one city to another starting now, bursting in the air on the way if stopped; returns its seconds. */
  fly(kind: 'missile' | 'bomber' | 'people', from: CityRef, to: CityRef, color: string, speed: number, stopped: boolean): number;
  /** A blast at a city by the warhead's class (small: a puff); returns its seconds. */
  blast(at: CityRef, cls: number, small: boolean): number;
  /** A pulse at a city: a mishap's mark. */
  pulse(kind: 'raid' | 'unlock' | 'city' | 'find', at: CityRef): void;
  /** Turn the camera to show the way from one city to another. */
  look(from: CityRef, to: CityRef, speed: number): void;
  /** Flights and blasts off at once. */
  clear(): void;
  /** Colours over the realms' states, or none (STORY-126, Sami: each realm in its own colour). */
  tint(tints: { state: number; color: string; amount: number }[] | null): void;
  reduceMotion(): boolean;
  leave(): void;
}

export type WarPhase = 'gallery' | 'orders' | 'playback' | 'end';

const STANCES = ['Hymyilet', 'Nyökkäät', 'Ilmeetön', 'Mulkoilet', 'Puit nyrkkiä'];
const STOCK_NAMES = { warheads: 'Kärjet', missiles: 'Ohjukset', bombers: 'Pommikoneet', defenses: 'Torjunta' } as const;
const DEFENSE_NAMES = ['Ohjustorjunta', 'Täystorjunta'];
const MISSILE_NAMES = ['Kiitäjä', 'Nuoli', 'Ukkonen', 'Jättiläinen'];
const BOMBER_NAMES = ['Haukka', 'Kotka'];
/** What a leader seems to be doing, as the others saw it. */
const DOING_TEXT: Partial<Record<string, string>> = { loadMissile: 'Ohjus ladattu', loadBomber: 'Pommikone ilmassa', bomb: 'Pommikone ilmassa', defend: 'Torjunta valmiina', build: 'Rakentaa' };

type Act = 'build' | 'propaganda' | 'loadMissile' | 'loadBomber' | 'strike' | 'defend';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
const button = (cls: string, text: string, onClick: () => void) => {
  const b = el('button', `btn ${cls}`, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
};
const millions = (n: number) => `${n} milj.`;

export function createWarPanel(root: HTMLElement, stage: WarStage, seed: number, realms: number[][]) {
  // ─── The gallery ─
  const gallery = el('section', 'nw-gallery');
  gallery.setAttribute('aria-label', 'Valitse vastustajat');
  const gHead = el('div', 'nw-gallery-head');
  const gTitle = el('h2', 'nw-gallery-title', 'Valitse neljä vastustajaa');
  gTitle.tabIndex = -1;
  gHead.append(el('p', 'nw-kicker', 'Ydinsota · kokeilu'), gTitle);
  const gHint = el('p', 'nw-gallery-hint', 'Jokaisella on oma luonteensa. Sinä olet viides johtaja.');
  const cards = el('div', 'nw-cards');
  cards.setAttribute('role', 'group');
  cards.setAttribute('aria-label', 'Johtajat');
  const chosen: string[] = [];
  const cardButtons = PERSONAS.map(p => {
    const b = el('button', 'nw-card');
    b.type = 'button';
    b.style.setProperty('--leader', p.color);
    b.setAttribute('aria-pressed', 'false');
    const face = el('span', 'nw-card-face');
    face.innerHTML = leaderFace(p, 'calm', 72);
    const text = el('span', 'nw-card-text');
    text.append(el('span', 'nw-card-name', p.name), el('span', 'nw-card-temper', TEMPERS[p.profile].name), el('span', 'nw-card-motto', p.motto));
    b.append(face, text);
    b.addEventListener('click', () => {
      const i = chosen.indexOf(p.id);
      if (i >= 0) chosen.splice(i, 1);
      else if (chosen.length < 4) chosen.push(p.id);
      renderGallery();
    });
    cards.append(b);
    return b;
  });
  const gFoot = el('div', 'nw-gallery-foot');
  const gCount = el('p', 'nw-gallery-count');
  gCount.setAttribute('aria-live', 'polite');
  const fill = button('nw-fill', 'Arvo loput', () => {
    let n = 0;
    while (chosen.length < 4) {
      const p = choose(PERSONAS.filter(x => !chosen.includes(x.id)), seed, 'gallery', n++);
      chosen.push(p.id);
    }
    renderGallery();
  });
  const go = button('btn-primary nw-go', 'Sotaan!', () => start());
  const back = button('btn-ghost nw-leave', 'Aloitusnäyttöön', () => stage.leave());
  gFoot.append(gCount, fill, go, back);
  gallery.append(gHead, gHint, cards, gFoot);

  function renderGallery() {
    cardButtons.forEach((b, i) => {
      const at = chosen.indexOf(PERSONAS[i].id);
      b.setAttribute('aria-pressed', String(at >= 0));
      b.disabled = at < 0 && chosen.length >= 4;
    });
    gCount.textContent = `Valittu ${chosen.length} / 4`;
    go.disabled = chosen.length < 4;
    fill.disabled = chosen.length >= 4;
  }
  renderGallery();

  // ─── The war ─
  const panel = el('section', 'nw');
  panel.setAttribute('aria-label', 'Ydinsota');
  panel.hidden = true;
  const head = el('div', 'nw-head');
  const title = el('div', 'nw-title');
  const roundText = el('span', 'nw-round');
  title.append(el('span', 'nw-kicker', 'Ydinsota · kokeilu'), roundText);
  const speedBtn = button('btn-ghost nw-speed', '1×', () => { speed = speed === 1 ? 2 : 1; speedBtn.textContent = `${speed}×`; speedBtn.setAttribute('aria-label', `Nopeus ${speed}×`); });
  speedBtn.setAttribute('aria-label', 'Nopeus 1×');
  const skipBtn = button('btn-ghost nw-skip', 'Ohita', () => skip());
  const leaveBtn = button('btn-ghost nw-leave', '×', () => stage.leave());
  leaveBtn.setAttribute('aria-label', 'Aloitusnäyttöön');
  head.append(title, speedBtn, skipBtn, leaveBtn);

  const row = el('ul', 'nw-leaders');
  row.setAttribute('aria-label', 'Johtajat');

  // The stage: who speaks now, and what the narrator says
  const speech = el('div', 'nw-speech');
  speech.setAttribute('aria-hidden', 'true');
  speech.hidden = true;
  const speechFace = el('span', 'nw-speech-face');
  const speechBody = el('div', 'nw-speech-body');
  const speechName = el('span', 'nw-speech-name');
  const speechText = el('p', 'nw-speech-text');
  const speechNote = el('p', 'nw-speech-note');
  speechBody.append(speechName, speechText, speechNote);
  speech.append(speechFace, speechBody);

  const orders = el('div', 'nw-orders');
  const log = el('ol', 'nw-log');
  log.setAttribute('aria-label', 'Tapahtumat');
  log.setAttribute('aria-live', 'polite');
  panel.append(head, row, orders, log);

  const marks = el('div', 'nw-marks');
  marks.hidden = true;

  // A tap on a country opens what can be done to it right there (Sami 2026-11-24)
  const pop = el('div', 'nw-pop');
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Kaupunki');
  pop.hidden = true;
  let popAt: CityRef | null = null;

  const endCard = el('section', 'nw-end');
  endCard.setAttribute('aria-label', 'Sota päättyi');
  endCard.hidden = true;

  root.append(marks, pop, speech, gallery, panel, endCard);

  // ─── State ─
  let war: War | null = null;
  let personas: Persona[] = [];
  let phase: WarPhase = 'gallery';
  let speed = 1;
  /** The people shown: what the playback has reached. */
  let shown: number[][] = [];
  const doingSeen: string[] = ['', '', '', '', ''];
  const moods: Mood[] = ['calm', 'calm', 'calm', 'calm', 'calm'];
  let queue: WarEvent[] = [];
  let eventNo = 0;
  let stepEnd = 0;
  let stepEvent: WarEvent | null = null;
  let typing: { text: string; start: number; ms: number } | null = null;
  // The order being put together
  let act: Act | null = null;
  let cls = -1;
  let target: CityRef | null = null;
  const markButtons: HTMLButtonElement[][] = [];
  const leaderItems: { li: HTMLLIElement; face: HTMLSpanElement; people: HTMLSpanElement; cities: HTMLSpanElement; doing: HTMLSpanElement; stance?: HTMLButtonElement; drawn: string }[] = [];

  function start() {
    const ids = [...chosen, PLAYER_PERSONA.id];
    personas = ids.map(personaOf);
    war = newWar(seed, ids, personas.map(p => p.profile), realms.map((states, i) => states.map((state, c) => ({ state, name: personas[i].cities[c] }))));
    shown = war.leaders.map(l => l.cities.map(c => c.people));
    buildRow();
    buildMarks();
    gallery.hidden = true;
    panel.hidden = false;
    marks.hidden = false;
    phase = 'orders';
    say(PLAYER, null, 'Viisi johtajaa, viisi kaupunkia kullakin. Viimeinen pystyssä oleva voittaa.', 'calm');
    renderOrders();
    renderRow();
    // The focus goes on with the player, to the first order
    orders.querySelector<HTMLButtonElement>('.nw-act')?.focus();
  }

  function buildRow() {
    row.replaceChildren();
    leaderItems.length = 0;
    personas.forEach((p, i) => {
      const li = el('li', 'nw-leader');
      li.style.setProperty('--leader', p.color);
      const face = el('span', 'nw-leader-face');
      const text = el('span', 'nw-leader-text');
      // The whole name, and on a phone the last word of it
      const name = el('span', 'nw-leader-name');
      name.append(el('span', 'nw-name-full', p.name), el('span', 'nw-name-short', p.name.split(' ').at(-1)));
      const people = el('span', 'nw-leader-people');
      const cities = el('span', 'nw-leader-cities');
      const doing = el('span', 'nw-leader-doing');
      text.append(name, people, cities, doing);
      li.append(face, text);
      const item: (typeof leaderItems)[number] = { li, face, people, cities, doing, drawn: '' };
      if (i !== PLAYER) {
        const stance = button('btn-ghost nw-stance', STANCES[2], () => {
          if (!war || phase !== 'orders') return;
          const next = ((war.leaders[PLAYER].stance[i] + 3) % 5) - 2;
          play(war, { kind: 'stance', leader: i, stance: next });
          renderRow();
        });
        li.append(stance);
        item.stance = stance;
      }
      row.append(li);
      leaderItems.push(item);
    });
  }

  function renderRow() {
    const w = war;
    if (!w) return;
    w.leaders.forEach((l, i) => {
      const it = leaderItems[i];
      const people = shown[i].reduce((s, n) => s + n, 0);
      const living = shown[i].filter(n => n > 0).length;
      const mood: Mood = living === 0 ? 'fallen' : moods[i];
      const key = `${mood}`;
      if (it.drawn !== key) {
        it.face.innerHTML = leaderFace(personas[i], mood, 44);
        it.drawn = key;
      }
      it.people.textContent = millions(people);
      it.cities.textContent = living ? `${living}/5 kaupunkia` : 'Kukistunut';
      it.doing.textContent = living ? DOING_TEXT[doingSeen[i]] ?? '' : '';
      it.li.classList.toggle('fallen', living === 0);
      if (it.stance) {
        const st = w.leaders[PLAYER].stance[i];
        it.stance.textContent = STANCES[st + 2];
        it.stance.setAttribute('aria-label', `Asenteesi johtajaan ${personas[i].name}: ${STANCES[st + 2]}`);
        it.stance.disabled = phase !== 'orders' || !alive(l) || !alive(w.leaders[PLAYER]);
      }
    });
    roundText.textContent = phase === 'end' ? 'Sota päättyi' : `Kierros ${w.round + (phase === 'orders' ? 1 : 0)}`;
    skipBtn.hidden = phase !== 'playback';
  }

  function buildMarks() {
    marks.replaceChildren();
    markButtons.length = 0;
    personas.forEach((p, i) => {
      markButtons.push(realms[i].map((_, c) => {
        const b = el('button', 'nw-city');
        b.type = 'button';
        b.style.setProperty('--leader', p.color);
        b.dataset.leader = String(i);
        b.dataset.city = String(c);
        b.addEventListener('click', () => openPop({ leader: i, city: c }));
        marks.append(b);
        return b;
      }));
    });
  }

  // ─── Orders ─
  const order = (): Order | null => {
    if (!war) return null;
    const t = target;
    switch (act) {
      case 'build': return { kind: 'build' };
      case 'propaganda': return t ? { kind: 'propaganda', leader: t.leader, city: t.city } : null;
      case 'loadMissile': return cls >= 0 ? { kind: 'loadMissile', missile: cls } : null;
      case 'loadBomber': return cls >= 0 ? { kind: 'loadBomber', bomber: cls } : null;
      case 'defend': return cls >= 0 ? { kind: 'defend', defense: cls } : null;
      case 'strike': {
        const l = loaded(war);
        return l && t && cls >= 0 ? { kind: l.kind === 'missile' ? 'launch' : 'bomb', warhead: cls, leader: t.leader, city: t.city } : null;
      }
    }
    return null;
  };

  function renderOrders() {
    if (!war) return;
    orders.replaceChildren();
    const me = war.leaders[PLAYER];
    if (phase !== 'orders') return;
    if (!alive(me)) {
      orders.append(el('p', 'nw-note', 'Kaupunkisi ovat raunioina. Sota jatkuu ilman sinua.'), button('btn-primary nw-done', 'Katso seuraava kierros', () => give({ kind: 'watch' })));
      return;
    }
    // Your stock, in words as well as numbers
    const stock = el('p', 'nw-stock');
    stock.textContent = `${STOCK_NAMES.warheads} ${me.warheads.map((n, c) => `${MEGATONS[c]} Mt ×${n}`).join(', ')} · ${STOCK_NAMES.missiles} ${me.missiles.reduce((s, n) => s + n, 0)} · ${STOCK_NAMES.bombers} ${me.bombers.reduce((s, n) => s + n, 0)} · ${STOCK_NAMES.defenses} ${me.defenses.reduce((s, n) => s + n, 0)}`;
    const l = loaded(war);
    if (l) stock.textContent += ` · Ladattuna: ${l.kind === 'missile' ? `ohjus ${MISSILE_NAMES[l.cls]} (${l.load} Mt)` : `pommikone ${BOMBER_NAMES[l.cls]} (kuormaa ${l.load} Mt)`}`;
    const acts = el('div', 'nw-acts');
    acts.setAttribute('role', 'group');
    acts.setAttribute('aria-label', 'Tekosi tällä kierroksella');
    const options: [Act, string, boolean][] = [
      ['build', 'Rakenna', true],
      ['propaganda', 'Propaganda', true],
      ['loadMissile', 'Lataa ohjus', me.missiles.some(n => n > 0)],
      ['loadBomber', 'Lataa pommikone', me.bombers.some(n => n > 0)],
      ['strike', l?.kind === 'bomber' ? 'Pommita' : 'Laukaise', !!l],
      ['defend', 'Torjunta', me.defenses.some(n => n > 0)],
    ];
    for (const [a, text, ok] of options) {
      if (a === 'strike' && !l) continue;
      const b = button(`nw-act${a === 'strike' ? ' nw-act-strike' : ''}`, text, () => { act = a; cls = -1; if (a !== 'propaganda' && a !== 'strike') target = null; renderOrders(); });
      b.setAttribute('aria-pressed', String(act === a));
      b.disabled = !ok;
      acts.append(b);
    }
    orders.append(stock, acts);

    // The class: a missile, a bomber, a defence or a warhead
    const classes = (label: string, items: { text: string; ok: boolean }[]) => {
      const g = el('div', 'nw-choices');
      g.setAttribute('role', 'group');
      g.setAttribute('aria-label', label);
      items.forEach((it, c) => {
        const b = button('nw-choice', it.text, () => { cls = c; renderOrders(); });
        b.setAttribute('aria-pressed', String(cls === c));
        b.disabled = !it.ok;
        g.append(b);
      });
      orders.append(el('p', 'nw-label', label), g);
    };
    if (act === 'loadMissile') classes('Mikä ohjus?', me.missiles.map((n, c) => ({ text: `${MISSILE_NAMES[c]} · ${MEGATONS[c]} Mt · ${n} kpl`, ok: n > 0 })));
    if (act === 'loadBomber') classes('Mikä pommikone?', me.bombers.map((n, c) => ({ text: `${BOMBER_NAMES[c]} · ${BOMBER_LOAD[c]} Mt · ${n} kpl`, ok: n > 0 })));
    if (act === 'defend') classes('Mikä torjunta?', me.defenses.map((n, c) => ({ text: `${DEFENSE_NAMES[c]}${c === 0 ? ' (ohjukset)' : ' (myös pommikoneet)'} · ${n} kpl`, ok: n > 0 })));
    if (act === 'strike' && l) classes('Mikä kärki?', me.warheads.map((n, c) => ({ text: `${MEGATONS[c]} Mt · ${n} kpl`, ok: n > 0 && MEGATONS[c] <= l.load })));

    // The target: a leader's city from the list (or a tap on the globe)
    if (act === 'propaganda' || act === 'strike') {
      orders.append(el('p', 'nw-label', act === 'propaganda' ? 'Kenen kaupunkiin puhut?' : 'Mihin kaupunkiin?'));
      const list = el('div', 'nw-targets');
      war.leaders.forEach((foe, i) => {
        if (i === PLAYER || !alive(foe)) return;
        const g = el('div', 'nw-target');
        g.setAttribute('role', 'group');
        g.setAttribute('aria-label', personas[i].name);
        g.style.setProperty('--leader', personas[i].color);
        g.append(el('span', 'nw-target-name', personas[i].name));
        foe.cities.forEach((c, k) => {
          if (c.people <= 0) return;
          const b = button('nw-choice nw-city-choice', `${c.name} · ${millions(c.people)}`, () => { target = { leader: i, city: k }; renderOrders(); });
          b.setAttribute('aria-pressed', String(target?.leader === i && target.city === k));
          g.append(b);
        });
        list.append(g);
      });
      orders.append(list);
    }

    const o = order();
    const ok = !!o && canOrder(war, o);
    const summary = el('p', 'nw-summary');
    summary.textContent = o && ok ? describe(o) : act ? 'Valitse vielä, mitä ja mihin.' : 'Valitse tekosi. Kaikki johtajat toimivat samalla kierroksella.';
    orders.append(summary);
    if (o && ok && offends(war, o)) {
      const warn = el('p', 'nw-warn');
      warn.textContent = me.doing === 'build' && o.kind === 'build' ? 'Rakennat toista kierrosta peräkkäin: muut johtajat suuttuvat.' : 'Ladattu ase menee hukkaan, ja muut johtajat suuttuvat.';
      orders.append(warn);
    }
    const done = button('btn-primary nw-done', 'Valmis', () => { const x = order(); if (x) give(x); });
    done.disabled = !ok;
    orders.append(done);
    renderMarks();
  }

  function describe(o: Order): string {
    if (!war) return '';
    const city = (t: CityRef) => `${war!.leaders[t.leader].cities[t.city].name} (${personas[t.leader].name})`;
    switch (o.kind) {
      case 'build': return 'Tehtaat tekevät kierroksen aikana aseita: yhden jokaista elävää kaupunkia kohden ja yhden lisää.';
      case 'propaganda': return `Propagandaa kaupunkiin ${city({ leader: o.leader, city: o.city })}: 1–10 miljoonaa voi muuttaa sinulle, tai jotain outoa voi tapahtua.`;
      case 'loadMissile': return `Ladataan ohjus ${MISSILE_NAMES[o.missile]} (${MEGATONS[o.missile]} Mt). Laukaiset sen seuraavalla kierroksella.`;
      case 'loadBomber': return `Pommikone ${BOMBER_NAMES[o.bomber]} nousee ilmaan ${BOMBER_LOAD[o.bomber]} Mt:n kuormalla. Pommitat seuraavalla kierroksella.`;
      case 'defend': return `${DEFENSE_NAMES[o.defense]} on valmiina tämän kierroksen.`;
      case 'launch': return `${MEGATONS[o.warhead]} Mt:n kärki ohjuksella kohti kaupunkia ${city({ leader: o.leader, city: o.city })}.`;
      case 'bomb': return `Pommikone pudottaa ${MEGATONS[o.warhead]} Mt:n kärjen kaupunkiin ${city({ leader: o.leader, city: o.city })}.`;
      default: return '';
    }
  }

  function give(o: Order) {
    if (!war || phase !== 'orders') return;
    closePop();
    const events = play(war, o);
    if (!events) return;
    act = null;
    cls = -1;
    target = null;
    queue = events;
    eventNo = 0;
    stepEnd = 0;
    phase = 'playback';
    orders.replaceChildren(el('p', 'nw-note', 'Kierros käynnissä…'));
    renderRow();
    renderMarks();
  }

  // ─── Playback ─
  function say(by: number, sayKind: Say | null, text: string, mood: Mood, note = '') {
    const p = personas[by] ?? PLAYER_PERSONA;
    speech.hidden = false;
    speech.style.setProperty('--leader', p.color);
    speechFace.innerHTML = leaderFace(p, mood, 72);
    speechName.textContent = p.name;
    const line = sayKind ? lineOf(p.profile, sayKind, war?.seed ?? seed, war?.round ?? 0, eventNo, p.id) : text;
    typing = stage.reduceMotion() ? null : { text: line, start: performance.now(), ms: Math.min(1100, line.length * 28) };
    speechText.textContent = typing ? '' : line;
    speechNote.textContent = note;
    if (by >= 0) moods[by] = mood;
    // The log gets the whole line at once (aria-live: no letter by letter)
    const li = el('li', 'nw-log-line');
    li.textContent = `${p.name}: ${line}${note ? ` ${note}` : ''}`;
    log.prepend(li);
    while (log.children.length > 8) log.lastElementChild!.remove();
  }
  const narrate = (text: string) => {
    speechNote.textContent = text;
    const li = el('li', 'nw-log-line nw-log-note', text);
    log.prepend(li);
    while (log.children.length > 8) log.lastElementChild!.remove();
  };

  /** Starts an event's playback; returns its seconds at 1×. */
  function begin(e: WarEvent): number {
    if (!war) return 0;
    const name = (i: number) => personas[i].name;
    const cityName = (t: CityRef) => war!.leaders[t.leader].cities[t.city].name;
    switch (e.kind) {
      case 'load':
        doingSeen[e.by] = e.what === 'missile' ? 'loadMissile' : 'loadBomber';
        say(e.by, 'load', '', 'smug', e.what === 'missile' ? `Lataa ohjuksen ${MISSILE_NAMES[e.cls]}.` : `Pommikone ${BOMBER_NAMES[e.cls]} nousee ilmaan.`);
        return 1.8;
      case 'defend':
        doingSeen[e.by] = 'defend';
        say(e.by, 'defend', '', 'calm', `${DEFENSE_NAMES[e.cls]} valmiina.`);
        stage.pulse('find', capital(e.by));
        return 1.6;
      case 'build':
        doingSeen[e.by] = 'build';
        say(e.by, 'build', '', 'calm', 'Tehtaat käyntiin.');
        return 1.3;
      case 'made': {
        if (e.by !== PLAYER) { narrate(`${name(e.by)}: tehtaat valmistivat ${Object.values(e.made).flat().reduce((s, n) => s + n, 0)} asetta.`); return 0.8; }
        const parts: string[] = [];
        e.made.warheads.forEach((n, c) => { if (n) parts.push(`${n} × ${MEGATONS[c]} Mt:n kärki`); });
        e.made.missiles.forEach((n, c) => { if (n) parts.push(`${n} × ohjus ${MISSILE_NAMES[c]}`); });
        e.made.bombers.forEach((n, c) => { if (n) parts.push(`${n} × pommikone ${BOMBER_NAMES[c]}`); });
        e.made.defenses.forEach((n, c) => { if (n) parts.push(`${n} × ${DEFENSE_NAMES[c].toLowerCase()}`); });
        narrate(`Tehtaasi valmistivat: ${parts.join(', ')}.`);
        return 1.6;
      }
      case 'propaganda': {
        doingSeen[e.by] = '';
        const from = { leader: e.target, city: e.from };
        say(e.by, 'propaganda', '', 'smug', e.moved > 0 ? `${millions(e.moved)} muutti kaupungista ${cityName(from)}.` : `Kaupungista ${cityName(from)} ei muuttanut ketään.`);
        stage.look(from, { leader: e.by, city: e.to }, speed);
        return 0.6 + flown(stage.fly('people', from, { leader: e.by, city: e.to }, personas[e.by].color, speed, false));
      }
      case 'mishap': {
        doingSeen[e.by] = '';
        const at = e.city >= 0 ? { leader: e.leader, city: e.city } : capital(e.leader);
        const text = mishapText(e.mishap, war.seed, war.round, eventNo);
        const mood: Mood = e.mishap === 'ufo' || e.mishap === 'boom' ? 'smug' : 'scared';
        say(e.by, null, text, mood, e.moved ? (e.mishap === 'ufo' || e.mishap === 'boom' ? `+${millions(e.moved)}` : `${millions(e.moved)} ${e.to ? 'lähti' : 'menetettiin'}.`) : '');
        if (e.to) {
          stage.look(at, e.to, speed);
          return 0.8 + flown(stage.fly('people', at, e.to, personas[e.by].color, speed, false));
        }
        stage.look(at, at, speed);
        stage.pulse(e.mishap === 'ufo' ? 'unlock' : e.mishap === 'boom' ? 'city' : 'raid', at);
        if (e.mishap === 'fallout') shown[e.leader].forEach((n, c) => { if (n > 0) stage.pulse('raid', { leader: e.leader, city: c }); });
        return 2.6;
      }
      case 'strike': {
        doingSeen[e.by] = e.delivery === 'bomber' && e.outcome !== 'crash' && e.outcome !== 'stopped' ? 'bomb' : '';
        const from = capital(e.by);
        const to = { leader: e.target, city: e.city };
        const warhead = e.warhead >= 0 ? `${MEGATONS[e.warhead]} Mt` : 'tyhjä';
        say(e.by, e.revenge ? 'fall' : 'strike', '', e.revenge ? 'fallen' : 'angry', `${e.revenge ? 'Kosto: ' : ''}${warhead} kohti kaupunkia ${cityName(to)}.`);
        stage.look(from, to, speed);
        const flight = flown(stage.fly(e.delivery, from, to, personas[e.by].color, speed, e.outcome === 'stopped' || e.outcome === 'crash'));
        pending = { e, at: performance.now() + (flight * 1000) / speed };
        return flight + (e.outcome === 'hit' ? 2.4 : 1.3);
      }
      case 'fall':
        doingSeen[e.who] = '';
        say(e.who, 'fall', '', 'fallen', `${name(e.who)} kukistui.`);
        return 2.0;
      case 'end':
        return 0.2;
    }
  }

  /** A flight's seconds at 1× from the stage's at this speed; with reduced motion only its end, a moment. */
  const flown = (seconds: number) => (stage.reduceMotion() ? 0.3 : seconds * speed);

  /** A strike's landing, when its flight arrives. */
  let pending: { e: Extract<WarEvent, { kind: 'strike' }>; at: number } | null = null;
  function land(e: Extract<WarEvent, { kind: 'strike' }>) {
    if (!war) return;
    const to = { leader: e.target, city: e.city };
    const text = outcomeText(e.outcome, war.seed, war.round, eventNo);
    if (e.outcome === 'hit' || e.outcome === 'ruins') {
      stage.blast(to, Math.max(0, e.warhead), false);
      shown = e.people.map(r => [...r]);
      const struck = e.target;
      if (e.loss > 0) say(struck, 'struck', '', shown[struck].some(n => n > 0) ? (e.loss > 20 ? 'scared' : 'angry') : 'fallen', `${text} ${millions(e.loss)} menehtyi kaupungissa ${war.leaders[e.target].cities[e.city].name}.`);
      else narrate(text);
    } else if (e.outcome === 'stopped') {
      say(e.target, 'defend', '', 'smug', text);
    } else narrate(text);
    renderRow();
    renderMarks();
  }
  const capital = (i: number): CityRef => ({ leader: i, city: Math.max(0, shown[i].findIndex(n => n > 0)) });

  function finishStep() {
    if (pending) { land(pending.e); pending = null; }
    if (stepEvent) shown = stepEvent.people.map(r => [...r]);
    stepEvent = null;
  }

  function endOfRound() {
    if (!war) return;
    if (war.winner !== null) { showEnd(); return; }
    phase = 'orders';
    renderRow();
    renderOrders();
  }

  function skip() {
    if (phase !== 'playback' || !war) return;
    finishStep();
    stage.clear();
    if (typing) speechText.textContent = typing.text;
    for (; eventNo < queue.length; eventNo++) {
      const e = queue[eventNo];
      if (e.kind === 'load') doingSeen[e.by] = e.what === 'missile' ? 'loadMissile' : 'loadBomber';
      if (e.kind === 'defend' || e.kind === 'build') doingSeen[e.by] = e.kind;
      if (e.kind === 'strike' || e.kind === 'propaganda' || e.kind === 'mishap') doingSeen[e.by] = '';
    }
    shown = war.leaders.map(l => l.cities.map(c => c.people));
    typing = null;
    narrate('Kierros ohitettiin.');
    endOfRound();
  }

  function showEnd() {
    if (!war) return;
    phase = 'end';
    renderRow();
    orders.replaceChildren();
    marks.hidden = true;
    endCard.replaceChildren();
    const w = war.winner!;
    const ranked = war.leaders.map((l, i) => ({ i, score: score(l) })).sort((a, b) => b.score - a.score);
    const face = el('span', 'nw-end-face');
    face.innerHTML = w >= 0 ? leaderFace(personas[w], 'smug', 96) : leaderFace(PLAYER_PERSONA, 'fallen', 96);
    const h = el('h2', 'nw-end-title', w === PLAYER ? 'Voitit sodan!' : w >= 0 ? `Voittaja: ${personas[w].name}` : 'Kukaan ei voittanut.');
    const line = el('p', 'nw-end-line', w >= 0 ? `”${lineOf(personas[w].profile, 'win', war.seed, war.round)}”` : 'Maailma on hiljainen. Kenelläkään ei ole enää kaupunkeja.');
    const list = el('ol', 'nw-scores');
    list.setAttribute('aria-label', 'Pisteet');
    for (const r of ranked) list.append(el('li', 'nw-score', `${personas[r.i].name}: ${r.score} pistettä · ${millions(peopleOf(war.leaders[r.i]))}, ${citiesOf(war.leaders[r.i])} kaupunkia`));
    const again = button('btn-primary nw-again', 'Uusi sota', () => {
      endCard.hidden = true;
      panel.hidden = true;
      speech.hidden = true;
      chosen.length = 0;
      seed = seed + 1;
      war = null;
      moods.fill('calm');
      doingSeen.fill('');
      typing = null;
      pending = null;
      queue = [];
      act = null;
      target = null;
      phase = 'gallery';
      stage.tint(null);
      gallery.hidden = false;
      log.replaceChildren();
      renderGallery();
      gTitle.focus();
    });
    const leave = button('btn-ghost nw-leave-end', 'Aloitusnäyttöön', () => stage.leave());
    const foot = el('div', 'nw-end-foot');
    foot.append(again, leave);
    endCard.append(face, h, line);
    if (queue.some(e => e.kind === 'end' && e.byScore)) endCard.append(el('p', 'nw-end-note', `Kierrosraja täyttyi: eniten pisteitä sai ${w >= 0 ? personas[w].name : 'ei kukaan'}.`));
    endCard.append(list, foot);
    endCard.hidden = false;
    again.focus();
  }

  function renderMarks() {
    if (!war) return;
    const picking = phase === 'orders' && (act === 'propaganda' || act === 'strike');
    markButtons.forEach((list, i) => list.forEach((b, c) => {
      const n = shown[i]?.[c] ?? 0;
      const name = war!.leaders[i].cities[c].name;
      b.textContent = n > 0 ? `${name} ${n}` : `${name} ✕`;
      b.classList.toggle('ruins', n <= 0);
      b.classList.toggle('picked', !!target && target.leader === i && target.city === c);
      b.classList.toggle('target', picking && i !== PLAYER && n > 0 && alive(war!.leaders[i]));
      b.disabled = phase !== 'orders';
      b.tabIndex = -1;
      b.setAttribute('aria-hidden', 'true');
    }));
    // Each realm in its leader's colour; a city in ruins dark
    stage.tint(personas.flatMap((p, i) => realms[i].map((state, c) => ({ state, color: (shown[i]?.[c] ?? 0) > 0 ? p.color : '#2a2620', amount: (shown[i]?.[c] ?? 0) > 0 ? (i === PLAYER ? 0.4 : 0.5) : 0.65 }))));
  }

  /** The city of a state, if it is one of the realms'. */
  const cityOf = (state: number): CityRef | null => {
    for (let i = 0; i < realms.length; i++) {
      const c = realms[i].indexOf(state);
      if (c >= 0) return { leader: i, city: c };
    }
    return null;
  };

  /** A bubble at a city: what can be done to it now, each a whole order at a tap. */
  /** Where the focus was before the bubble opened, for it to return to. */
  let popOpener: HTMLElement | null = null;
  function openPop(at: CityRef, focusStance = false) {
    if (!war || phase !== 'orders') return;
    if (pop.hidden) popOpener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    const me = war.leaders[PLAYER];
    const city = war.leaders[at.leader].cities[at.city];
    pop.replaceChildren();
    popAt = at;
    pop.style.setProperty('--leader', personas[at.leader].color);
    const title = el('p', 'nw-pop-title', `${city.name} · ${city.people > 0 ? millions(city.people) : 'raunioina'}`);
    const who = el('p', 'nw-pop-who', at.leader === PLAYER ? 'Oma kaupunkisi' : personas[at.leader].name);
    pop.append(title, who);
    const actions = el('div', 'nw-pop-acts');
    const add = (text: string, o: Order | null, cls = '') => {
      const b = button(`nw-pop-act ${cls}`, text, () => { closePop(); if (o) give(o); });
      b.disabled = !o || !canOrder(war!, o);
      actions.append(b);
    };
    const l = loaded(war);
    if (at.leader !== PLAYER && city.people > 0 && alive(me)) {
      if (l) {
        const w = [3, 2, 1, 0].find(c => me.warheads[c] > 0 && MEGATONS[c] <= l.load) ?? -1;
        add(w >= 0 ? `${l.kind === 'missile' ? 'Laukaise ohjus' : 'Pommita'} · ${MEGATONS[w]} Mt` : 'Ei sopivaa kärkeä', w >= 0 ? { kind: l.kind === 'missile' ? 'launch' : 'bomb', warhead: w, leader: at.leader, city: at.city } : null, 'nw-pop-strike');
      } else {
        const m = [3, 2, 1, 0].find(c => me.missiles[c] > 0 && me.warheads.some((n, w) => n > 0 && MEGATONS[w] <= MEGATONS[c]));
        if (m !== undefined) add(`Lataa ohjus ${MISSILE_NAMES[m]}`, { kind: 'loadMissile', missile: m });
        else if (me.bombers.some(n => n > 0)) add('Lataa pommikone', { kind: 'loadBomber', bomber: me.bombers[1] > 0 ? 1 : 0 });
      }
      add('Propaganda', { kind: 'propaganda', leader: at.leader, city: at.city });
      if (!l) actions.append(el('p', 'nw-pop-note', 'Ohjus tai pommikone ladataan ensin, ja isku lähtee seuraavalla kierroksella.'));
    } else if (at.leader === PLAYER && alive(me)) {
      add('Rakenna aseita', { kind: 'build' });
      const d = me.defenses[1] > 0 ? 1 : me.defenses[0] > 0 ? 0 : -1;
      if (d >= 0) add(DEFENSE_NAMES[d], { kind: 'defend', defense: d });
    }
    if (at.leader !== PLAYER && alive(war.leaders[at.leader]) && alive(me)) {
      // Your stance to the leader: not a round, and on a phone only here
      const st = me.stance[at.leader];
      const stance = button('btn-ghost nw-pop-stance', `Asenteesi: ${STANCES[st + 2]} ↻`, () => {
        if (!war) return;
        play(war, { kind: 'stance', leader: at.leader, stance: ((st + 3) % 5) - 2 });
        renderRow();
        openPop(at, true);
      });
      actions.append(stance);
    }
    const more = button('btn-ghost nw-pop-more', 'Tarkemmin…', () => {
      closePop();
      if (at.leader !== PLAYER && city.people > 0) { act = l ? 'strike' : 'propaganda'; target = at; cls = -1; }
      renderOrders();
      orders.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    });
    const close = button('btn-ghost nw-pop-close', '×', () => closePop());
    close.setAttribute('aria-label', 'Sulje');
    actions.append(more);
    pop.append(actions, close);
    pop.hidden = false;
    (focusStance ? pop.querySelector<HTMLButtonElement>('.nw-pop-stance') : actions.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
  }
  function closePop() {
    if (pop.hidden) return;
    const back = pop.contains(document.activeElement);
    pop.hidden = true;
    popAt = null;
    // The focus returns where it was, or to the orders
    if (back) (popOpener?.isConnected && !popOpener.closest('[hidden]') ? popOpener : orders.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    popOpener = null;
  }
  pop.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

  // ─── Each frame ─
  function update(now: number) {
    if (phase === 'gallery' || !war) return;
    if (typing) {
      const n = Math.min(typing.text.length, Math.ceil((typing.text.length * (now - typing.start)) / typing.ms));
      speechText.textContent = typing.text.slice(0, n);
      if (n >= typing.text.length) typing = null;
    }
    if (pending && now >= pending.at) { const p = pending; pending = null; land(p.e); }
    if (phase === 'playback' && now >= stepEnd) {
      finishStep();
      renderRow();
      if (eventNo >= queue.length) endOfRound();
      else {
        stepEvent = queue[eventNo];
        const seconds = begin(stepEvent);
        eventNo++;
        stepEnd = now + (seconds * 1000) / (stage.reduceMotion() ? Math.max(speed, 3) : speed);
        renderRow();
      }
    }
    if (popAt) {
      const at = stage.cityAt(popAt);
      if (!at) closePop();
      else {
        // Kept on the screen, and above the city in the lower half
        const half = Math.min(132, window.innerWidth / 2 - 4);
        const x = Math.min(Math.max(at[0], half + 4), window.innerWidth - half - 4);
        // Below the city when it fits, else above it, and never off the screen
        const height = pop.offsetHeight;
        const above = at[1] + 20 + height > window.innerHeight - 8 && at[1] - 20 - height >= 8;
        pop.classList.toggle('above', above);
        const y = above ? at[1] : Math.min(at[1], Math.max(8, window.innerHeight - 8 - height - 20));
        pop.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
    // The marks follow the globe
    markButtons.forEach((list, i) => list.forEach((b, c) => {
      const at = stage.cityAt({ leader: i, city: c });
      b.hidden = !at;
      if (at) b.style.transform = `translate(${at[0]}px, ${at[1]}px) translate(-50%, -50%)`;
    }));
  }

  return {
    update,
    get phase() { return phase; },
    get war() { return war; },
    get left() { return phase === 'playback' ? queue.length - eventNo + (pending ? 1 : 0) : 0; },
    pick: (ids: string[]) => { chosen.length = 0; chosen.push(...ids.slice(0, 4)); renderGallery(); },
    start: () => { if (chosen.length === 4) start(); },
    give: (o: Order) => give(o),
    /** A tap on the globe at a state: a realm's city opens its bubble. Returns whether it was one. */
    tapState: (state: number) => {
      // A tap on the globe during the playback skips it (STORY-126 criterion 3)
      if (phase === 'playback') { skip(); return true; }
      const at = cityOf(state);
      if (!at || phase !== 'orders') return phase !== 'gallery';
      openPop(at);
      return true;
    },
    skip,
  };
}
