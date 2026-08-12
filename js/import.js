/* ── CHARGEMENT LISTE DEPUIS GITHUB ──────────────────────────────────────── */
// L'agent ne modifie jamais la liste — seul le gestionnaire met à jour
// data/liste_commandes.csv dans le dépôt GitHub.

const DATA_FILE = 'data/liste_commandes.csv';

async function chargerListeGitHub() {
  setLoadStatus('loading', '⏳ Chargement de la liste…');
  try {
    const resp = await fetch(DATA_FILE + '?v=' + Date.now());
    if (!resp.ok) {
      setLoadStatus('warn', resp.status === 404
        ? '⚠ Fichier data/liste_commandes.csv introuvable dans le dépôt'
        : `⚠ Erreur ${resp.status} lors du chargement`);
      return;
    }
    const raw = await resp.text();
    const rows = parseCSV(raw);
    if (!rows) { setLoadStatus('warn', '⚠ Fichier vide ou format non reconnu'); return; }

    // Remplace la liste — les coches et obs en localStorage sont conservées
    // si la clé (bl|dm|ligne|article) existe encore dans la nouvelle liste.
    state.rows = rows;
    // Purger les coches/obs dont la ligne a disparu
    const keys = new Set(rows.map(rowKey));
    Object.keys(state.checks).forEach(k => { if (!keys.has(k)) delete state.checks[k]; });
    Object.keys(state.obs).forEach(k    => { if (!keys.has(k)) delete state.obs[k]; });
    saveState();

    const h = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    setLoadStatus('ok', `✔ ${rows.length} lignes chargées — ${h}`);
    return rows;
  } catch (e) {
    setLoadStatus('warn', '⚠ Impossible de charger la liste (hors ligne ?)');
  }
}

function setLoadStatus(type, msg) {
  const el = document.getElementById('loadStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = 'load-status load-' + type;
  el.style.display = 'block';
  if (type === 'ok') setTimeout(() => { if (el.textContent === msg) el.style.display = 'none'; }, 4000);
}

/* ── PARSING CSV / TSV ───────────────────────────────────────────────────── */
function detectSeparator(line) {
  if (line.includes('\t')) return '\t';
  if ((line.match(/;/g) || []).length >= 2) return ';';
  return ',';
}

function normalizeHeader(h) {
  return h.trim().toUpperCase().replace(/[°\s\-_]/g, '');
}

function matchColumn(headers) {
  const ALIASES = {
    DM:       ['NDM','DM','NUMDM','NUMERODM'],
    LIGNE:    ['LIGNE','LINE','LIG'],
    BL:       ['NBL','BL','NUMBL'],
    CHANTIER: ['CHANTIER','SITE','AFFAIRE','OPERATION','OTP'],
    ARTICLE:  ['ARTICLE','ART','CODE','CODEART','REFERENCE','REF'],
    INTITULE: ['INTITULE','LIBELLE','DESIGNATION','DESCRIPTION'],
    QUANTITE: ['QUANTITE','QTE','QTY','QUANTITY'],
  };
  const idx = { DM:-1, LIGNE:-1, BL:-1, CHANTIER:-1, ARTICLE:-1, INTITULE:-1, QUANTITE:-1 };
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    Object.keys(idx).forEach(k => {
      if (idx[k] === -1 && ALIASES[k].some(a => norm.includes(a) || a.includes(norm))) idx[k] = i;
    });
  });
  // fallback positionnel
  if (Object.values(idx).filter(v => v === -1).length > 3)
    ['DM','LIGNE','BL','ARTICLE','INTITULE','QUANTITE'].forEach((k, i) => { idx[k] = i; });
  return idx;
}

function parseCSV(raw) {
  const lines = raw.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const sep  = detectSeparator(lines[0]);
  const idx  = matchColumn(lines[0].split(sep));
  const get  = (parts, k) => (parts[idx[k]] || '').trim().replace(/^["']|["']$/g, '');
  const rows = [];
  lines.slice(1).forEach(line => {
    const parts = line.split(sep);
    const bl = get(parts,'BL'), dm = get(parts,'DM');
    if (!bl && !dm) return;
    rows.push({ dm, ligne: get(parts,'LIGNE'), bl, chantier: get(parts,'CHANTIER'), article: get(parts,'ARTICLE'), intitule: get(parts,'INTITULE'), quantite: get(parts,'QUANTITE') });
  });
  return rows.length ? rows : null;
}
