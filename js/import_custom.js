/* ================= IMPORT EXCEL / CSV = COMPLÉMENT DE LA BASE (admin SNCF) =================
   - Lignes nouvelles            → ajoutées
   - Lignes déjà en base         → infos de commande mises à jour (pointage conservé)
   - Lignes absentes du fichier  → NON touchées (jamais supprimées)
================================================================================ */

let _importPlan = null;

const IMPORT_COLS = {
  dm:             ['ndm', 'dm', 'numdm'],
  ligne:          ['ligne'],
  bl:             ['nbl', 'bl', 'numbl'],
  article:        ['article', 'symbole'],
  quantite:       ['quantite', 'qte', 'qt'],
  chantier:       ['chantier'],
  date_livraison: ['datelivraison', 'livraison'],
  intitule:       ['intituler', 'intitule', 'designation', 'libelle'],
  ee:             ['ee', 'entreprise'],
  reception:      ['reception', 'datereception']
};
const BASE_FIELDS = ['dm', 'ligne', 'bl', 'article', 'quantite', 'chantier', 'date_livraison', 'intitule', 'ee'];

function setImportStatus(html) {
  const el = document.getElementById('importStatusInfo');
  if (el) el.innerHTML = html || '';
}

function normHeader(h) {
  return String(h == null ? '' : h).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* ── Lecture CSV (séparateur , ; ou tabulation détecté, guillemets gérés) ── */
function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const cnt = { ';': 0, ',': 0, '\t': 0 };
  let q = false;
  for (const ch of first) {
    if (ch === '"') q = !q;
    else if (!q && ch in cnt) cnt[ch]++;
  }
  const delim = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];

  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function readFileRows(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    if (['xlsx', 'xlsm', 'xls'].includes(ext)) {
      reader.onload = e => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }));
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = e => resolve(parseDelimited(String(e.target.result)));
      reader.readAsText(file, 'UTF-8');
    }
  });
}

function cellToStr(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const d = new Date(v.getTime() + 12 * 3600 * 1000);    // évite le décalage de fuseau
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  return String(v).trim();
}

function pad8(s) { return /^\d+$/.test(s) && s.length < 8 ? s.padStart(8, '0') : s; }

function rowsToItems(rows) {
  if (!rows.length) return { items: [], missing: ['en-tête'] };
  const headers = rows[0].map(normHeader);

  const idx = {};
  Object.keys(IMPORT_COLS).forEach(f => {
    let i = headers.findIndex(h => IMPORT_COLS[f].includes(h));
    if (i === -1) i = headers.findIndex(h => h && IMPORT_COLS[f].some(n => n.length >= 5 && h.includes(n)));
    idx[f] = i;
  });

  const missing = ['bl', 'article'].filter(f => idx[f] === -1);
  if (missing.length) return { items: [], missing, headers: rows[0] };

  const get = (row, f) => (idx[f] > -1 ? cellToStr(row[idx[f]]) : '');
  const seen = {};
  const items = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.some(c => cellToStr(c) !== '')) continue;
    const it = {
      dm: get(row, 'dm'), ligne: get(row, 'ligne'),
      bl: pad8(get(row, 'bl')), article: pad8(get(row, 'article')),
      quantite: get(row, 'quantite'), chantier: get(row, 'chantier'),
      date_livraison: get(row, 'date_livraison'), intitule: get(row, 'intitule'),
      ee: get(row, 'ee').toUpperCase(), reception: get(row, 'reception')
    };
    if (!it.bl) continue;
    const base = [it.bl, it.dm, it.ligne, it.article].join('|');
    seen[base] = (seen[base] || 0) + 1;
    it.cle = seen[base] > 1 ? base + '#' + seen[base] : base;
    items.push(it);
  }
  return { items, missing: [] };
}

/* ── Lecture de la base actuelle (toutes les lignes) ── */
async function fetchAllDb() {
  const all = [];
  const step = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb().from(T_LIGNES).select(DB_COLS)
      .order('id', { ascending: true }).range(from, from + step - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

/* ── 1) Choix du fichier : on prépare un aperçu, rien n'est écrit ── */
async function handleCustomFileImport(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!isAdmin()) { alert('Import réservé au personnel SNCF.'); return; }

  _importPlan = null;
  const box = document.getElementById('importPreview');
  if (box) box.innerHTML = '';

  try {
    setImportStatus('Lecture de <b>' + esc(file.name) + '</b>…');
    const { items, missing, headers } = rowsToItems(await readFileRows(file));
    if (missing.length) {
      setImportStatus('❌ Colonnes introuvables : <b>' + missing.join(', ') + '</b>. En-têtes lus : ' + esc((headers || []).join(' | ')));
      return;
    }
    if (!items.length) { setImportStatus('❌ Aucune ligne exploitable dans ce fichier.'); return; }

    setImportStatus('Comparaison avec la base…');
    const db = await fetchAllDb();
    const byCle = {};
    db.forEach(d => { byCle[d.cle] = d; });

    const toInsert = [], toUpdate = [];
    let same = 0;
    items.forEach(it => {
      const d = byCle[it.cle];
      if (!d) {
        toInsert.push({
          cle: it.cle, dm: it.dm, ligne: it.ligne, bl: it.bl, article: it.article,
          quantite: it.quantite, chantier: it.chantier, date_livraison: it.date_livraison,
          intitule: it.intitule, ee: it.ee,
          recu: !!it.reception, date_reception: it.reception || ''
        });
        return;
      }
      const upd = {};
      BASE_FIELDS.forEach(f => { if ((d[f] || '') !== (it[f] || '')) upd[f] = it[f]; });
      if (!d.recu && it.reception) { upd.recu = true; upd.date_reception = it.reception; }
      if (Object.keys(upd).length) toUpdate.push({ cle: it.cle, fields: upd }); else same++;
    });

    _importPlan = { toInsert, toUpdate };
    showImportPreview(file.name, items.length, toInsert, toUpdate, same);
  } catch (err) {
    setImportStatus('❌ Erreur : ' + esc(err.message || String(err)));
  }
}

function showImportPreview(name, total, toInsert, toUpdate, same) {
  setImportStatus('Fichier <b>' + esc(name) + '</b> : ' + total + ' lignes lues.');
  const box = document.getElementById('importPreview');
  if (!box) return;

  const sample = toInsert.slice(0, 8).map(r =>
    '<div style="font-size:.72rem;color:var(--muted);">+ BL ' + esc(r.bl) + ' · ' + esc(r.article) + ' · ' + esc(r.intitule) + ' · ' + esc(r.ee) + '</div>'
  ).join('');

  const nothing = !toInsert.length && !toUpdate.length;
  box.innerHTML =
    '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:14px;">' +
      '<div style="font-weight:bold;margin-bottom:8px;">Aperçu de la mise à jour</div>' +
      '<div style="font-size:.85rem;line-height:1.7;">' +
        '➕ <b>' + toInsert.length + '</b> nouvelle(s) ligne(s)<br>' +
        '✏️ <b>' + toUpdate.length + '</b> ligne(s) mise(s) à jour<br>' +
        '＝ <b>' + same + '</b> inchangée(s)<br>' +
        '<span style="color:var(--muted);font-size:.75rem;">Les pointages et observations déjà saisis sont conservés. Aucune ligne n\'est supprimée.</span>' +
      '</div>' +
      (sample ? '<div style="margin-top:8px;">' + sample + (toInsert.length > 8 ? '<div style="font-size:.72rem;color:var(--muted);">… et ' + (toInsert.length - 8) + ' autres</div>' : '') + '</div>' : '') +
      '<div style="display:flex;gap:8px;margin-top:12px;">' +
        (nothing ? '' : '<button class="btn btn-sm btn-warn" onclick="confirmImport()">✅ Valider la mise à jour</button>') +
        '<button class="btn btn-sm btn-ghost" onclick="cancelImport()">' + (nothing ? 'Fermer' : 'Annuler') + '</button>' +
      '</div>' +
    '</div>';
}

function cancelImport() {
  _importPlan = null;
  const box = document.getElementById('importPreview');
  if (box) box.innerHTML = '';
  setImportStatus('');
}

/* ── 2) Validation : écriture dans Supabase ── */
async function confirmImport() {
  if (!_importPlan || !isAdmin()) return;
  const { toInsert, toUpdate } = _importPlan;
  _importPlan = null;
  const box = document.getElementById('importPreview');
  if (box) box.innerHTML = '';

  try {
    for (let i = 0; i < toInsert.length; i += 500) {
      setImportStatus('Ajout des lignes… ' + Math.min(i + 500, toInsert.length) + ' / ' + toInsert.length);
      const { error } = await sb().from(T_LIGNES).insert(toInsert.slice(i, i + 500));
      if (error) throw error;
    }
    for (let i = 0; i < toUpdate.length; i += 10) {
      setImportStatus('Mise à jour des lignes… ' + Math.min(i + 10, toUpdate.length) + ' / ' + toUpdate.length);
      await Promise.all(toUpdate.slice(i, i + 10).map(async u => {
        const { error } = await sb().from(T_LIGNES).update(u.fields).eq('cle', u.cle);
        if (error) throw error;
      }));
    }
    await rafraichir();
    setImportStatus('✅ Base mise à jour : <b>' + toInsert.length + '</b> ajout(s), <b>' + toUpdate.length + '</b> modification(s).');
    if (typeof showToast === 'function') showToast('✅ Base mise à jour');
  } catch (err) {
    setImportStatus('❌ Erreur pendant l\'import : ' + esc(err.message || String(err)) + ' — relancez le même fichier, il reprendra où il s\'est arrêté.');
  }
}

/* ── Résumé de la base (onglet admin) ── */
function renderAdminSummary() {
  const el = document.getElementById('adminSummary');
  if (!el) return;
  const rows = state.rows;
  if (!rows.length) { el.innerHTML = 'Base vide : importez le fichier de départ.'; return; }
  const recus = rows.filter(r => r.recu).length;
  const bls = new Set(rows.map(r => r.bl)).size;
  const parEE = {};
  rows.forEach(r => { const k = r.ee || '—'; parEE[k] = (parEE[k] || 0) + 1; });
  el.innerHTML =
    '<b>' + rows.length + '</b> lignes · <b>' + bls + '</b> BL · <b>' + recus + '</b> reçues (' + Math.round(100 * recus / rows.length) + '%)<br>' +
    '<span style="color:var(--muted);">' + Object.keys(parEE).sort().map(k => esc(k) + ' : ' + parEE[k]).join(' · ') + '</span>';
}
