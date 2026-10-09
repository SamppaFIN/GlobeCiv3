# Handoff: GlobeCiv3 — "Kartografi" UI

## Overview
Browser/phone civilization game on a seamlessly zoomable planet (planet → state → province → city area → hex tiles). This package covers the visual direction "Kartografi": unmapped world = dark fog with ink hatch and a hinted coastline; mapped world = painted terrain bordered by a hand-drawn ink line. Primary platform: phone (390 × 844 frames, Galaxy S23 Ultra); desktop (1440) not designed yet.

## About the design files
The `.dc.html` files are **design references built in HTML** (open them directly in a browser; `support.js` is the runtime). They are not production code. Recreate them in the game's own stack (3D world + HUD overlay) using its patterns. Terrain/fog/border rendering in the mocks is done with SVG/Canvas only to show the look; in the game this belongs in the shader.

## Fidelity
High-fidelity for UI (HUD, sheets, cards, detail screens): colors, type, spacing and copy are final-ish. **Sprites (isometric units/buildings) and icons are sketches**: final art should be redrawn to the same angle (2:1 isometric, light from top-left, right faces darker) and silhouettes.

## Files
- `Aloitusnäyttö.dc.html` — start screen, two directions (1a Kartografi = chosen, 1b Luotain).
- `Kartografi - näkymät.dc.html` — sections: 2a fly-in storyboard, 2b city-area main view (interactive), 3 first sprite set, 4a discovery card, 5a unlock notice, 6a province view, 7a state view, 8a city card.
- `Kartografi – yksiköt ja detailit.dc.html` — 5a units (8), 5b city buildings (12), 5c resources + resource buildings (18), 6a–6f detail screens.
- `tokens.css` — all game tokens (terrain, fog, borders, yields). `_ds/…/styles.css` — Nocturne UI design system (Inter 500, outlined buttons, `.seg`, `.tag`, `.card`).
All geometry/data lives in each file's `<script data-dc-script>` class: `terrain()`, `regions()` (hex super-tiling), `isoB()` buildings, `unit()`/`person()`/`horse()`/`boat()` sprites, `RI` resource icon paths (24-grid), `RES` resource table.

## Hex model
Pointy-top axial (q,r). Pixel: `x = s·√3·(q + r/2)`, `y = 1.5·s·r`. City area = hex of radius 4 (61 tiles); lattice v1=(5,4), v2=(-4,9). Province = 7 areas, state = 7 provinces (same radius-1 super-tiling on area/province indices, v1=(2,1), v2=(-1,3)). See `superOf()`/`regions()`.

## Screens
**1 Start** — planet silhouette on stars, compass ring (P/I/E/L ticks), title "GlobeCiv" 46px/500, subtitle "Kartta, joka piirtyy", full-width outlined "Uusi peli" (52px), "Kartoitettu 0 %". Planet rotates (80 s/turn).
**2 Fly-in** — 3 s: planet (accent target ring) → state (borders draw: state 3px, province dashed, city 1px; target area accent glow) → city area (landing tile + 6 neighbours mapped, units appear, HUD slides in). Reduced motion: hard cut + 200 ms fade.
**3 City area (main)** — full-bleed map. Top HUD (≈85px, 8px inset, `--c-hud` + blur): pause/play 44, speed seg 1×/2×/4× (44 each), "Päivä N" + speed/paused label; meter row "Lääni [bar with tick at 60 %] 23 / 60 %" (fill = ink). Bottom HUD (≈90px): unit name + status; scouts: seg Tutki/Kerää/Puolusta + flag tool (44, accent outline); settler: "Perusta kaupunki tähän" + "Vaihda paikka". Units are tapped on the map (44px hit area, accent ellipse ring at feet). Settler path = accent dashed line to dashed-circle "Kaupungin paikka". Scout trails = ink dotted. Day ticks every 1.5 s / speed.
**4 Discovery** — game pauses ("Peli pysähtyi · Päivä 21" chip), discovered tile gets accent ring, bottom sheet (surface 94 %, radius 14): kicker, title, body, two 64px choice buttons (icon in ink circle + title + effect), note "Valitsematta jäänyt löytö katoaa."
**5 Unlock** — meter 60/60 with glowing tick; centered card: "Uusi taso avautui" / "Lääni kartoitettu, zoomaa ulos", animated pinch hint (two dots converging, 1.8 s loop), desktop hint (wheel / −), "Zoomaa ulos" + "Myöhemmin".
**6 Province** — 7 area chips (96×44, centered on area); selected = accent ring + glow; bottom panel: area name + mapped %, seg Tutki/Asuta/Ohita, "Lähetä retkikunta …".
**7 State** — 7 province chips; target = accent; bottom panel: "Valtion linja" seg Laajentuminen/Tutkimus/Puolustus, target row + "Vaihda".
**8 City card** — sheet: kicker, name, close 44; size + growth bar; 3 yield tiles (icon, +N, label); "Rakentaa …" + "Vaihda".
**Detail screens (6a–6f)** — common shell: header (back 44, kicker in accent-300 uppercase 11px, title 20px/500, right meta), 3-tab `.seg` (44px), sections with 11px uppercase labels, rows 56px min (44px hex thumbnail, title 14, sub 12 muted, right meta 12). Locked rows at 55 % opacity with "Vaatii X".
- City: Yleiskuva (yields, growth, queue with progress, built tags, worked tiles) / Rakenna (buildings + units) / Ruudut.
- City area: Rakenna (resource → building pairs) / Tutki / Yksiköt.
- Province: Kauppa (routes, caravans, research tags) / Rakenna / Tutki.
- State: Kulttuuri / Usko (faith card with 7-segment spread, doctrine choice, state buildings) / Linja.
- Planet: Diplomatia (civ cards: initial badge, relation shown as colour + diamond + text, treaty tags; proposal buttons) / Ihmeet / Tutki.
Level matrix (what is researched/built where) is the table at the top of section 6.

## Interactions & motion
Unit walk: legs ±24° @0.55 s, body bob 1.3px; idle bob 2.6 s. Boat: float ±2° 2.2 s. Flags skew 1.6 s, fire flicker 0.9 s, smoke rise 2.4 s, oil pump nod 2.4 s. All motion off under `prefers-reduced-motion`.

## Constraints
44×44 touch targets; WCAG AA text; info never by colour alone (terrain glyphs, resource icons, text labels); HUD ≤ ~¼ of screen on phone (province/state panels slightly exceed — can collapse); leave horizontal slack for font differences; no Civilization names/icons/look.

## Assets
No bitmaps. Icons are inline SVG (Phosphor for UI; custom 24-grid stroke icons for resources/yields in `RI` / `Y`). Final icon set (64×64, names in brief: terrain-*, resource-*, unit-*, city, city-capital, flag-explore, yield-*) still to be produced; file names are shown under each sprite/card.

## Not done yet
Desktop 1440 layouts; final SVG icon files.
