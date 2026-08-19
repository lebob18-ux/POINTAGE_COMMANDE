/* ── STATE ──────────────────────────────────────────────────────────────────
   rows     : [{dm, ligne, bl, article, intitule, quantite, ee}]
   checks   : { "bl|dm|ligne|article": true }
   obs      : { "bl|dm|ligne|article": "texte observation" }
   activeBL : string | null
──────────────────────────────────────────────────────────────────────────── */
const STORE_KEY = 'fbm_suivi_v3';

const state = {
  rows: [],
  checks: {},
  obs: {},
};

let activeBL = null;

// Gestion de l'entreprise active (stockée en majuscules pour éviter les bugs)
let currentCompany = (localStorage.getItem('sncf_company') || '').toUpperCase().trim();

function isAdmin() {
  return currentCompany === 'SNCF';
}

function setCompany(name) {
  currentCompany = name.toUpperCase().trim();
  localStorage.setItem('sncf_company', currentCompany);
}

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

// Récupère uniquement les lignes autorisées pour l'utilisateur connecté
function getAuthorizedRows() {
  if (isAdmin()) return state.rows;
  return state.rows.filter(r => (r.ee || '').trim().toUpperCase() === currentCompany);
}

function getBLs() {
  const map = {};
  // On se base sur les lignes autorisées
  getAuthorizedRows().forEach(r => {
    if (!map[r.bl]) map[r.bl] = { bl: r.bl, dms: new Set(), count: 0 };
    map[r.bl].dms.add(r.dm);
    map[r.bl].count++;
  });

  // On transforme l'objet en tableau
  const list = Object.values(map);

  // FILTRE : On ne garde que les BL qui ne sont PAS complètement validés ('ok')
  // (Si vous souhaitez tout de même revoir les terminés, on pourra ajouter un bouton bascule un de ces jours)
  return list.filter(b => blStatus(b.bl) !== 'ok');
}

function getRowsForBL(bl) {
  const rows = state.rows.filter(r => r.bl === bl);
  if (isAdmin()) return rows;
  return rows.filter(r => (r.ee || '').trim().toUpperCase() === currentCompany);
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

/* ── INITIALISATION POPUP ENTREPRISE ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  if (!currentCompany) {
    const modal = document.getElementById('companyModal');
    if (modal) modal.style.display = 'flex';
  }

  const saveBtn = document.getElementById('btnSaveCompany');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const input = document.getElementById('inputCompanyName');
      if (input && input.value.trim()) {
        setCompany(input.value);
        const modal = document.getElementById('companyModal');
        if (modal) modal.style.display = 'none';
        location.reload(); // Recharge pour appliquer l'accès global ou filtré
      }
    });
  }
});
