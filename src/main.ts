/**
 * GlobeCiv3 — Main entry point
 * Ladataan 3D-globi ja simulaatio-overlay valmiiksi.
 */

// ─── 3D Globe (Three.js) ──────────────────────────
import './globe/main';

// ─── Overlay hallinta ─────────────────────────────
(window as any).closeSimulation = () => {
  const overlay = document.getElementById('sim-overlay');
  if (overlay) overlay.classList.remove('active');
};
