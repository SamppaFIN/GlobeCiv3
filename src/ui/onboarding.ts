/**
 * onboarding.ts — the game greets and tells what to do (STORY-096; Sami 2026-11-19: the player
 * plays the sim by choosing advisors, and the people carry it out). A welcome card, then the
 * level's three advisors as big cards with "Ohjaan itse" below them, then a short tour of the
 * HUD that can be skipped. The same three-card choice comes with each level that opens. While
 * any of it shows the game stands still (main.ts).
 */

export interface PickView {
  /** The level: "Kaupunki". */
  kicker: string;
  title: string;
  options: { id: string; name: string; does: string }[];
}

export interface Onboarding {
  welcome(): void;
  pick(view: PickView): void;
  /** The tour of the HUD: the goal, the speed and the advisor. */
  tour(): void;
  readonly visible: boolean;
}

/** The tour's steps: what each part of the HUD is for. */
export const TOUR: readonly { target: string; text: string }[] = [
  { target: '.hud-goal', text: 'Tavoite nostaa sinut seuraavalle tasolle. Mittari näyttää, paljonko on jäljellä, ja napautus antaa vihjeen.' },
  { target: '.hud-speed', text: 'Aika kulkee itsestään. Tästä nopeutat, ja vieressä on tauko.' },
  { target: '.hud-advisor', text: 'Neuvonantajan voit vaihtaa milloin tahansa. Ohjaan itse tuo esiin kaikki valikot.' },
];

export function createOnboarding(root: HTMLElement, on: { start(): void; pick(id: string): void; done(): void }): Onboarding {
  const card = document.createElement('section');
  card.className = 'onboard-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-labelledby', 'onboard-title');
  card.hidden = true;
  root.appendChild(card);
  const tip = document.createElement('section');
  tip.className = 'tour-tip';
  tip.setAttribute('role', 'dialog');
  tip.setAttribute('aria-label', 'Opastus');
  tip.hidden = true;
  root.appendChild(tip);

  let step = -1;
  const clearTarget = () => root.querySelectorAll('.tour-target').forEach(e => e.classList.remove('tour-target'));
  const endTour = () => {
    step = -1;
    tip.hidden = true;
    clearTarget();
    on.done();
  };
  const showStep = () => {
    clearTarget();
    const s = TOUR[step];
    const target = root.querySelector<HTMLElement>(s.target);
    const last = step === TOUR.length - 1;
    tip.innerHTML = `
      <span class="tour-count">${step + 1} / ${TOUR.length}</span>
      <p class="tour-text"></p>
      <div class="tour-actions">
        <button class="btn btn-secondary tour-skip" type="button">Ohita</button>
        <button class="btn btn-primary tour-next" type="button">${last ? 'Aloita' : 'Seuraava'}</button>
      </div>`;
    tip.querySelector('.tour-text')!.textContent = s.text;
    tip.querySelector('.tour-skip')!.addEventListener('click', endTour);
    tip.querySelector('.tour-next')!.addEventListener('click', () => {
      if (last) endTour();
      else { step++; showStep(); }
    });
    tip.hidden = false;
    // Under the part it tells of, kept on the screen
    const r = target && !target.hidden ? target.getBoundingClientRect() : null;
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, r ? r.left + r.width / 2 - w / 2 : (window.innerWidth - w) / 2))}px`;
    tip.style.top = `${r ? r.bottom + 10 : window.innerHeight / 3}px`;
    target?.classList.add('tour-target');
    tip.querySelector<HTMLButtonElement>('.tour-next')!.focus();
  };

  return {
    welcome() {
      card.innerHTML = `
        <span class="unlock-kicker">Tervetuloa</span>
        <h2 id="onboard-title" class="unlock-title">Sinä johdat, kansa rakentaa</h2>
        <p class="onboard-text">Et rakenna itse. Valitset jokaiselle tasolle neuvonantajan, ja kansasi toteuttaa sen linjan: rakentaa, kartoittaa ja puolustaa.</p>
        <p class="onboard-text">Kun tason tavoite täyttyy, nouset ylemmäs: kaupungista kaupunkialueelle, sieltä lääniin ja valtioon.</p>
        <button class="btn btn-primary onboard-go" type="button">Valitse neuvonantaja</button>`;
      card.querySelector('.onboard-go')!.addEventListener('click', () => { card.hidden = true; on.start(); });
      card.hidden = false;
      card.querySelector<HTMLButtonElement>('.onboard-go')!.focus();
    },
    pick(v) {
      card.innerHTML = `
        <span class="unlock-kicker"></span>
        <h2 id="onboard-title" class="unlock-title"></h2>
        <div class="onboard-options"></div>
        <button class="btn btn-secondary onboard-own" type="button">Ohjaan itse: kaikki valikot esiin</button>`;
      card.querySelector('.unlock-kicker')!.textContent = v.kicker;
      card.querySelector('.unlock-title')!.textContent = v.title;
      const list = card.querySelector('.onboard-options')!;
      for (const o of v.options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'onboard-option';
        b.innerHTML = '<span class="onboard-option-name"></span><span class="onboard-option-does"></span>';
        b.querySelector('.onboard-option-name')!.textContent = o.name;
        b.querySelector('.onboard-option-does')!.textContent = o.does;
        b.addEventListener('click', () => { card.hidden = true; on.pick(o.id); });
        list.appendChild(b);
      }
      card.querySelector('.onboard-own')!.addEventListener('click', () => { card.hidden = true; on.pick('none'); });
      card.hidden = false;
      card.querySelector<HTMLButtonElement>('.onboard-option')?.focus();
    },
    tour() {
      step = 0;
      showStep();
    },
    get visible() { return !card.hidden || !tip.hidden; },
  };
}
