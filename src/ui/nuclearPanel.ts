/**
 * nuclearPanel.ts — the war of leaders' panel and its marks on the globe (STORY-097, trial).
 *
 * The panel tells the day and the world's tension, each leader's people, attitude and
 * weapons, the player's acts and what happened lately. On the globe each leader's
 * capital carries its name and people, and each state of its realm a dot of its colour.
 */
import { ACT_DAYS, alive, canAct, MAX_SHIELDS, nukesOpen, NUKES_AT, type Act, type NuclearWorld } from '../game/nuclear';

/** Each leader's colour: the player in the accent, the others apart from it. */
export const LEADER_COLORS = ['#d2cefd', '#e0a458', '#7fb7be', '#d8737f', '#a3c46c'];

export interface NuclearMarks {
  /** Each leader's capital on screen, or null out of view. */
  capitals: ([number, number] | null)[];
  /** Each realm state's dot on screen: leader and position. */
  dots: { leader: number; at: [number, number] }[];
}

const attitudeWord = (n: number) => (n >= 50 ? 'ystävällinen' : n >= 15 ? 'myönteinen' : n > -15 ? 'varautunut' : n > -50 ? 'vihamielinen' : 'raivoissaan');
const people = (n: number) => `${n.toLocaleString('fi-FI', { maximumFractionDigits: 1 })} milj.`;

export function createNuclearPanel(root: HTMLElement, on: { act(a: Act): void; togglePause(): void; setSpeed(s: number): void; leave(): void }) {
  const el = document.createElement('section');
  el.className = 'nuclear';
  el.setAttribute('aria-label', 'Johtajien sota');
  el.innerHTML = `<div class="nuclear-head">
      <button class="btn btn-secondary nuclear-leave" type="button" aria-label="Aloitusnäyttöön"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 L8 12 L15 19"/></svg></button>
      <div class="nuclear-title"><span class="nuclear-kicker">Planeetta · kokeilu</span><span class="nuclear-day" aria-live="polite"></span></div>
      <button class="btn btn-secondary nuclear-pause" type="button"></button>
      <div class="seg nuclear-speed" role="radiogroup" aria-label="Nopeus">${[1, 4].map(s => `<label class="seg-opt"><input type="radio" name="nuclear-speed" value="${s}">${s}×</label>`).join('')}</div>
    </div>
    <div class="nuclear-tension"><span class="nuclear-tension-label">Jännite</span><div class="nuclear-meter" role="meter" aria-label="Maailman jännite" aria-valuemin="0" aria-valuemax="100"><div class="nuclear-meter-fill"></div><div class="nuclear-meter-tick" style="left:${NUKES_AT}%"></div></div><span class="nuclear-tension-value"></span></div>
    <ul class="nuclear-leaders" aria-label="Johtajat"></ul>
    <div class="nuclear-acts" role="group" aria-label="Sinun tekosi"><p class="nuclear-ready"></p><div class="nuclear-buttons"></div></div>
    <ol class="nuclear-log" aria-label="Tapahtumat" aria-live="polite"></ol>`;
  root.appendChild(el);
  const marks = document.createElement('div');
  marks.className = 'nuclear-marks';
  root.appendChild(marks);
  const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
  q('.nuclear-pause').addEventListener('click', on.togglePause);
  q('.nuclear-leave').addEventListener('click', on.leave);
  el.querySelectorAll<HTMLInputElement>('input[name="nuclear-speed"]').forEach(i => i.addEventListener('change', () => on.setSpeed(Number(i.value))));
  let target = -1;
  q('.nuclear-leaders').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-leader]');
    if (b && !b.disabled) target = Number(b.dataset.leader);
  });
  let pending: Act | null = null;
  q('.nuclear-buttons').addEventListener('click', e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (b && !b.disabled) pending = JSON.parse(b.dataset.act!) as Act;
  });

  let last = '';
  const capitals: HTMLElement[] = [];
  const dots: HTMLElement[] = [];
  return {
    update(w: NuclearWorld, paused: boolean, speed: number, m: NuclearMarks) {
      if (pending) {
        on.act(pending);
        pending = null;
      }
      const me = w.leaders[0];
      if (target >= 0 && !alive(w.leaders[target])) target = -1;
      const open = nukesOpen(w);
      // The player's acts: on the chosen leader, or building once the weapons are open
      const acts: [string, Act][] = target > 0 ? [
        ['Lähettiläs', { kind: 'envoy', to: target }],
        ['Propaganda', { kind: 'propaganda', to: target }],
        open ? ['Ohjusisku', { kind: 'missile', to: target }] : ['Hyökkäys', { kind: 'raid', to: target }],
      ] : [];
      if (open) acts.push(['Rakenna ohjus', { kind: 'build', what: 'missile' }], ['Rakenna torjunta', { kind: 'build', what: 'shield' }]);
      const key = JSON.stringify([w.day, Math.round(w.tension), w.leaders, w.log, w.winner, paused, speed, target]);
      if (key !== last) {
        last = key;
        q('.nuclear-day').textContent = w.winner !== null ? `Päivä ${w.day} · sota päättyi` : `Päivä ${w.day}${paused ? ' · tauolla' : ''}`;
        q('.nuclear-pause').textContent = paused ? 'Jatka' : 'Tauko';
        el.querySelectorAll<HTMLInputElement>('input[name="nuclear-speed"]').forEach(i => { i.checked = Number(i.value) === speed; });
        const t = Math.round(w.tension);
        q<HTMLElement>('.nuclear-meter-fill').style.width = `${t}%`;
        q('.nuclear-meter').setAttribute('aria-valuenow', String(t));
        q('.nuclear-tension-value').textContent = open ? `${t} · ohjukset auki` : `${t} / ${NUKES_AT}`;
        q('.nuclear-leaders').replaceChildren(...w.leaders.map(l => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'nuclear-leader';
          b.dataset.leader = String(l.id);
          b.disabled = l.id === 0 || !alive(l) || w.winner !== null;
          b.setAttribute('aria-pressed', String(l.id === target));
          b.style.setProperty('--leader', LEADER_COLORS[l.id % LEADER_COLORS.length]);
          const tie = l.id === 0 ? 'sinä' : `${attitudeWord(l.ties[0])}${l.ally === 0 ? ' · liittolainen' : ''}`;
          const arms = open ? ` · ohjuksia ${l.missiles} · torjuntaa ${l.shields}/${MAX_SHIELDS}` : '';
          b.innerHTML = '<span class="nuclear-dot"></span><span class="nuclear-name"></span><span class="nuclear-people"></span><span class="nuclear-line"></span>';
          b.querySelector('.nuclear-name')!.textContent = l.name;
          b.querySelector('.nuclear-people')!.textContent = alive(l) ? people(l.people) : 'kukistunut';
          b.querySelector('.nuclear-line')!.textContent = alive(l) ? `${tie}${arms}` : '';
          li.appendChild(b);
          return li;
        }));
        const ready = Math.max(0, me.ready - w.day);
        q('.nuclear-ready').textContent = w.winner !== null ? `Voittaja: ${w.winner >= 0 ? w.leaders[w.winner].name : 'ei kukaan'}`
          : !alive(me) ? 'Valtakuntasi on kukistunut.'
          : ready > 0 ? `Seuraava tekosi ${ready} päivän päästä (teko joka ${ACT_DAYS}. päivä).`
          : target > 0 ? `Valitse teko: ${w.leaders[target].name}.` : 'Valitse johtaja, jolle teet seuraavan tekosi.';
        q('.nuclear-buttons').replaceChildren(...acts.map(([label, a]) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `btn ${a.kind === 'missile' ? 'btn-primary' : 'btn-secondary'} nuclear-act`;
          b.dataset.act = JSON.stringify(a);
          b.textContent = label;
          b.disabled = !canAct(w, 0, a);
          return b;
        }));
        q('.nuclear-log').replaceChildren(...w.log.slice(0, 5).map(t => {
          const li = document.createElement('li');
          li.textContent = t;
          return li;
        }));
      }
      // The marks on the globe in every frame: only their position is written
      w.leaders.forEach((l, i) => {
        let c = capitals[i];
        if (!c) {
          c = capitals[i] = document.createElement('div');
          c.className = 'nuclear-capital';
          c.style.setProperty('--leader', LEADER_COLORS[i % LEADER_COLORS.length]);
          marks.appendChild(c);
        }
        const text = `${l.name} · ${alive(l) ? people(l.people) : 'kukistunut'}`;
        if (c.textContent !== text) c.textContent = text;
        const at = m.capitals[i];
        c.hidden = !at;
        if (at) c.style.transform = `translate(${at[0].toFixed(1)}px, ${at[1].toFixed(1)}px) translate(-50%, -50%)`;
      });
      while (dots.length < m.dots.length) {
        const d = document.createElement('div');
        d.className = 'nuclear-realm';
        marks.appendChild(d);
        dots.push(d);
      }
      dots.forEach((d, i) => {
        const x = m.dots[i];
        d.hidden = !x || !alive(w.leaders[x.leader]);
        if (!x || d.hidden) return;
        d.style.background = LEADER_COLORS[x.leader % LEADER_COLORS.length];
        d.style.transform = `translate(${x.at[0].toFixed(1)}px, ${x.at[1].toFixed(1)}px) translate(-50%, -50%)`;
      });
    },
  };
}
