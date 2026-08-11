/* ── STATE ──────────────────────────────────────────────────────────────────
   rows    : [{dm, ligne, bl, article, intitule, quantite}]
   checks  : { "bl|dm|ligne|article": true }
   obs     : { "bl|dm|ligne|article": "texte observation" }
   activeBL: string | null
──────────────────────────────────────────────────────────────────────────── */
const STORE_KEY = 'fbm_suivi_v2';

const state = {
  rows: [],
  checks: {},
  obs: {},
};

let activeBL = null;

/* ── PERSISTENCE ─────────────────────────────────────────────────────────── */
function saveState() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      rows: state.rows,
      checks: state.checks,
      obs: state.obs,
    }));
  } catch (e) {
    console.warn('localStorage plein :', e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.rows))   state.rows   = d.rows;
    if (d.checks && typeof d.checks === 'object') state.checks = d.checks;
    if (d.obs    && typeof d.obs    === 'object') state.obs    = d.obs;
  } catch (e) {
    console.warn('Erreur lecture état :', e);
  }
}

/* ── HELPERS ─────────────────────────────────────────────────────────────── */
function rowKey(r) {
  return `${r.bl}|${r.dm}|${r.ligne}|${r.article}`;
}

function getBLs() {
  const map = {};
  state.rows.forEach(r => {
    if (!map[r.bl]) map[r.bl] = { bl: r.bl, dms: new Set(), count: 0 };
    map[r.bl].dms.add(r.dm);
    map[r.bl].count++;
  });
  return Object.values(map);
}

function getRowsForBL(bl) {
  return state.rows.filter(r => r.bl === bl);
}

function blStatus(bl) {
  const rows = getRowsForBL(bl);
  if (!rows.length) return 'new';
  const done = rows.filter(r => state.checks[rowKey(r)]).length;
  if (done === 0)          return 'new';
  if (done === rows.length) return 'ok';
  return 'partial';
}

function blProgress(bl) {
  const rows = getRowsForBL(bl);
  const done = rows.filter(r => state.checks[rowKey(r)]).length;
  return { done, total: rows.length, pct: rows.length ? Math.round(100 * done / rows.length) : 0 };
}

function deleteBL(bl) {
  state.rows = state.rows.filter(r => r.bl !== bl);
  // nettoyer checks et obs
  Object.keys(state.checks).forEach(k => { if (k.startsWith(bl + '|')) delete state.checks[k]; });
  Object.keys(state.obs).forEach(k    => { if (k.startsWith(bl + '|')) delete state.obs[k]; });
  saveState();
}

function setCheck(key, val) {
  state.checks[key] = val;
  saveState();
}

function setObs(key, val) {
  state.obs[key] = val;
  saveState();
}

function validateAll(bl) {
  getRowsForBL(bl).forEach(r => { state.checks[rowKey(r)] = true; });
  saveState();
}

function addRow(row) {
  state.rows.push(row);
  saveState();
}

function addRows(rows) {
  state.rows.push(...rows);
  saveState();
}
