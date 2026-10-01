/* ── STATE ──────────────────────────────────────────────────────────────────
   Les lignes de commande ET le pointage (coche + observation) sont stockés
   dans Supabase (table commandes_lignes).

   state.rows   : [{id, cle, dm, ligne, bl, article, quantite, chantier,
                    dateLivraison, intitule, ee, recu, date_reception, observation}]
   state.checks : { cle: true }      (dérivé de rows[].recu)
   state.obs    : { cle: "texte" }   (dérivé de rows[].observation)

   Le téléphone garde une copie locale (cache + modifications en attente) :
   si le réseau coupe, le pointage continue et part dès le retour du réseau.
──────────────────────────────────────────────────────────────────────────── */
const STORE_KEY   = 'suivi_cmd_v4';
const PENDING_KEY = 'suivi_cmd_pending_v4';
const T_LIGNES    = 'commandes_lignes';
const DB_COLS     = 'id,cle,dm,ligne,bl,article,quantite,chantier,date_livraison,intitule,ee,recu,date_reception,observation';

const state = { rows: [], checks: {}, obs: {} };
let activeBL = null;

let _byCle = {};
let _pending = {};          // { cle: {champs à envoyer} }
let _flushTimer = null;
let _flushing = false;
let _saveTimer = null;
let _netLoaded = false;
let _lastLoad = 0;

/* ── HELPERS ─────────────────────────────────────────────────────────────── */
function sb() { return window.supabaseClient; }
function getCompany() { return (localStorage.getItem('user_company') || '').trim().toUpperCase(); }
function isAdmin() { return getCompany() === 'SNCF'; }
function getUserEmail() { return localStorage.getItem('pelican_user_email') || ''; }

function todayFR() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function rowKey(r) {
  return r.cle || `${r.bl}|${r.dm}|${r.ligne}|${r.article}`;
}

function fromDb(d) {
  return {
    id: d.id, cle: d.cle,
    dm: d.dm || '', ligne: d.ligne || '', bl: d.bl || '', article: d.article || '',
    quantite: d.quantite || '', chantier: d.chantier || '',
    dateLivraison: d.date_livraison || '', intitule: d.intitule || '', ee: d.ee || '',
    recu: !!d.recu, date_reception: d.date_reception || '', observation: d.observation || ''
  };
}

function indexRows() {
  _byCle = {};
  state.checks = {};
  state.obs = {};
  state.rows.forEach(r => {
    _byCle[r.cle] = r;
    if (r.recu) state.checks[r.cle] = true;
    if (r.observation) state.obs[r.cle] = r.observation;
  });
}

function setRows(dbList) {
  state.rows = dbList.map(fromDb);
  indexRows();
}

function applyPending() {
  Object.keys(_pending).forEach(k => {
    const r = _byCle[k];
    if (!r) return;
    const f = _pending[k];
    if ('recu' in f) { r.recu = !!f.recu; if (r.recu) state.checks[k] = true; else delete state.checks[k]; }
    if ('date_reception' in f) r.date_reception = f.date_reception || '';
    if ('observation' in f) { r.observation = f.observation || ''; if (r.observation) state.obs[k] = r.observation; else delete state.obs[k]; }
  });
}

/* ── PERSISTANCE LOCALE (cache + file d'attente) ─────────────────────────── */
function saveState() {                      // différé : évite d'écrire à chaque frappe
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveStateNow, 300);
}
function saveStateNow() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ rows: state.rows })); }
  catch (e) { console.warn('localStorage plein :', e); }
}
function savePending() {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(_pending)); } catch (e) {}
}

function loadState() {
  if (_netLoaded) return;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (Array.isArray(d.rows)) { state.rows = d.rows; indexRows(); }
    }
    const p = localStorage.getItem(PENDING_KEY);
    if (p) _pending = JSON.parse(p) || {};
    applyPending();
  } catch (e) {
    console.warn('Erreur lecture cache :', e);
  }
}

/* ── ENVOI VERS SUPABASE ─────────────────────────────────────────────────── */
function updateSyncBadge() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  const n = Object.keys(_pending).length;
  if (n) {
    el.textContent = '⏳ ' + n;
    el.title = n + ' modification(s) pas encore envoyée(s)';
    el.style.color = 'var(--warn)';
  } else {
    el.textContent = '✓';
    el.title = 'Tout est synchronisé';
    el.style.color = 'var(--ok)';
  }
}

function queuePending(key, fields) {
  _pending[key] = Object.assign(_pending[key] || {}, fields);
  savePending();
  updateSyncBadge();
}

function scheduleFlush(delay) {
  clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flushPending, delay == null ? 600 : delay);
}

async function flushPending() {
  if (!Object.keys(_pending).length) { updateSyncBadge(); return; }
  if (_flushing) { scheduleFlush(1500); return; }
  if (!navigator.onLine || !sb()) { updateSyncBadge(); return; }

  _flushing = true;
  const batch = _pending;
  _pending = {};
  savePending();

  const failed = {};
  const entries = Object.entries(batch);
  for (let i = 0; i < entries.length; i += 10) {
    await Promise.all(entries.slice(i, i + 10).map(async ([cle, fields]) => {
      try {
        const { error } = await sb().from(T_LIGNES).update(fields).eq('cle', cle);
        if (error) throw error;
      } catch (e) {
        failed[cle] = fields;
      }
    }));
  }

  Object.keys(failed).forEach(k => {
    _pending[k] = Object.assign({}, failed[k], _pending[k] || {});   // le plus récent gagne
  });
  savePending();
  _flushing = false;
  updateSyncBadge();

  if (Object.keys(failed).length) {
    if (typeof showToast === 'function') showToast('⚠ Pas de réseau : pointage gardé sur le téléphone');
    scheduleFlush(15000);
  }
}

window.addEventListener('online', () => flushPending());

/* ── POINTAGE ────────────────────────────────────────────────────────────── */
function setCheck(key, val) {
  const r = _byCle[key];
  if (!r) return;
  r.recu = !!val;
  if (val) { state.checks[key] = true; r.date_reception = r.date_reception || todayFR(); }
  else     { delete state.checks[key]; r.date_reception = ''; }
  saveState();
  queuePending(key, {
    recu: r.recu,
    date_reception: r.date_reception,
    pointe_par: getUserEmail() || null,
    pointe_at: new Date().toISOString()
  });
  scheduleFlush();
}

function setObs(key, val) {
  const r = _byCle[key];
  if (!r) return;
  r.observation = val;
  if (val) state.obs[key] = val; else delete state.obs[key];
  saveState();
  queuePending(key, {
    observation: val,
    pointe_par: getUserEmail() || null,
    pointe_at: new Date().toISOString()
  });
  scheduleFlush(900);      // attend la fin de la frappe
}

function validateAll(bl) {
  getRowsForBL(bl).forEach(r => setCheck(rowKey(r), true));
}

/* ── LECTURE DES DONNÉES ─────────────────────────────────────────────────── */
function getAuthorizedRows() {
  if (isAdmin()) return state.rows;
  const c = getCompany();
  return state.rows.filter(r => (r.ee || '').trim().toUpperCase() === c);
}

function getBLs() {
  const map = {};
  getAuthorizedRows().forEach(r => {
    if (!map[r.bl]) map[r.bl] = { bl: r.bl, dms: new Set(), count: 0 };
    map[r.bl].dms.add(r.dm);
    map[r.bl].count++;
  });
  return Object.values(map).filter(b => blStatus(b.bl) !== 'ok');
}

function getRowsForBL(bl) {
  const rows = state.rows.filter(r => r.bl === bl);
  if (isAdmin()) return rows;
  const c = getCompany();
  return rows.filter(r => (r.ee || '').trim().toUpperCase() === c);
}

function blStatus(bl) {
  const rows = getRowsForBL(bl);
  if (!rows.length) return 'new';
  const done = rows.filter(r => state.checks[rowKey(r)]).length;
  if (done === 0) return 'new';
  if (done === rows.length) return 'ok';
  return 'partial';
}

function blProgress(bl) {
  const rows = getRowsForBL(bl);
  const done = rows.filter(r => state.checks[rowKey(r)]).length;
  return { done, total: rows.length, pct: rows.length ? Math.round(100 * done / rows.length) : 0 };
}
