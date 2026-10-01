// ===== Liste de suivi terrain stockée sur Supabase =====
const LISTE_TABLE = 'suivi_liste';
let customList = [];

function sbL() { return window.supabaseClient; }

function escH(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setImportStatus(msg) {
  var el = document.getElementById('importStatusInfo');
  if (el) el.textContent = msg || '';
}

// ---------- Chargement depuis Supabase ----------
async function loadCustomList() {
  setImportStatus('Chargement de la liste…');
  var all = [], from = 0, step = 1000;
  while (true) {
    var res = await sbL().from(LISTE_TABLE).select('*')
      .order('id', { ascending: true }).range(from, from + step - 1);
    if (res.error) {
      setImportStatus('Erreur de chargement : ' + res.error.message);
      return;
    }
    all = all.concat(res.data);
    if (res.data.length < step) break;
    from += step;
  }
  customList = all;
  setImportStatus(all.length + ' ligne(s) en base.');
  renderCustomList();
}

// ---------- Lecture du fichier ----------
function findCol(headers, names) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase().trim();
    for (var j = 0; j < names.length; j++) {
      if (h.indexOf(names[j]) !== -1) return i;
    }
  }
  return -1;
}

function rowsToItems(rows) {
  if (!rows.length) return [];
  var headers = rows[0];
  var iSym = findCol(headers, ['symbole', 'réf', 'ref', 'article']);
  var iPlan = findCol(headers, ['plan']);
  var iDes = findCol(headers, ['désignation', 'designation', 'intitulé', 'intitule', 'libellé', 'libelle', 'détail', 'detail']);
  var iObs = findCol(headers, ['observation']);
  if (iSym === -1) iSym = 0;
  if (iDes === -1) iDes = 1;
  var items = [];
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || !row.some(function (c) { return String(c || '').trim() !== ''; })) continue;
    items.push({
      symbole: String(row[iSym] == null ? '' : row[iSym]).trim(),
      plan: iPlan > -1 ? String(row[iPlan] == null ? '' : row[iPlan]).trim() : '',
      designation: String(row[iDes] == null ? '' : row[iDes]).trim(),
      observation: iObs > -1 ? String(row[iObs] == null ? '' : row[iObs]).trim() : '',
      valide: false
    });
  }
  return items;
}

function readFileRows(file) {
  return new Promise(function (resolve, reject) {
    var ext = file.name.split('.').pop().toLowerCase();
    var reader = new FileReader();
    reader.onerror = function () { reject(new Error('Lecture du fichier impossible')); };
    if (ext === 'csv' || ext === 'txt') {
      reader.onload = function (e) {
        var lines = String(e.target.result).split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
        resolve(lines.map(function (l) { return l.split(';').map(function (c) { return c.replace(/^"|"$/g, ''); }); }));
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.onload = function (e) {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }));
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

// ---------- Import = remplace la liste en base ----------
async function handleCustomFileImport(event) {
  var file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    var items = rowsToItems(await readFileRows(file));
    if (!items.length) { alert('Aucune ligne exploitable dans ce fichier.'); return; }
    if (customList.length &&
        !confirm('Remplacer les ' + customList.length + ' lignes en base par les ' + items.length + ' du fichier ?\n(Les validations et observations actuelles seront perdues.)')) return;

    setImportStatus('Envoi vers Supabase…');
    var del = await sbL().from(LISTE_TABLE).delete().neq('id', 0);
    if (del.error) throw del.error;

    for (var i = 0; i < items.length; i += 500) {
      var ins = await sbL().from(LISTE_TABLE).insert(items.slice(i, i + 500));
      if (ins.error) throw ins.error;
    }
    await loadCustomList();
    if (typeof showToast === 'function') showToast('Liste importée : ' + items.length + ' lignes');
  } catch (err) {
    setImportStatus('Erreur : ' + (err.message || err));
    alert('Erreur : ' + (err.message || err));
  }
}

// ---------- Mises à jour d'une ligne ----------
async function updateCustomRow(id, fields) {
  fields.updated_at = new Date().toISOString();
  var res = await sbL().from(LISTE_TABLE).update(fields).eq('id', id);
  if (res.error) alert('Erreur de sauvegarde : ' + res.error.message);
}

function toggleCustomValide(id, checked) {
  var it = customList.find(function (x) { return x.id === id; });
  if (it) it.valide = checked;
  updateCustomRow(id, { valide: checked });
  updateCustomProgress();
  var tr = document.getElementById('crow-' + id);
  if (tr) tr.style.background = checked ? 'rgba(40,167,69,0.18)' : '';
}

function saveCustomObs(id, value) {
  var it = customList.find(function (x) { return x.id === id; });
  if (it) it.observation = value;
  updateCustomRow(id, { observation: value });
}

// ---------- Affichage ----------
function updateCustomProgress() {
  var total = customList.length;
  var done = customList.filter(function (x) { return x.valide; }).length;
  var pct = total ? Math.round(done * 100 / total) : 0;
  var bar = document.getElementById('customProgBar');
  var txt = document.getElementById('customProgTxt');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = done + ' / ' + total + ' (' + pct + '%)';
}

function renderCustomList() {
  var tbody = document.getElementById('customTbody');
  var toolbar = document.getElementById('customToolbar');
  if (!tbody) return;

  if (!customList.length) {
    if (toolbar) toolbar.style.display = 'none';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--muted);">Liste vide. Importez un fichier pour l\'alimenter.</td></tr>';
    return;
  }
  if (toolbar) toolbar.style.display = 'flex';

  var q = (document.getElementById('searchPelican').value || '').toLowerCase().trim();
  var words = q ? q.split(/\s+/) : [];
  var html = '';
  customList.forEach(function (it) {
    var hay = (it.symbole + ' ' + it.plan + ' ' + it.designation + ' ' + it.observation).toLowerCase();
    if (!words.every(function (w) { return hay.indexOf(w) !== -1; })) return;
    html += '<tr id="crow-' + it.id + '" style="border-bottom:1px solid var(--border);' +
      (it.valide ? 'background:rgba(40,167,69,0.18);' : '') + '">' +
      '<td style="text-align:center;padding:8px;"><input type="checkbox" ' + (it.valide ? 'checked' : '') +
      ' onchange="toggleCustomValide(' + it.id + ', this.checked)"></td>' +
      '<td></td>' +
      '<td style="padding:8px;font-weight:bold;">' + escH(it.symbole) + '</td>' +
      '<td style="padding:8px;">' + escH(it.plan) + '</td>' +
      '<td style="padding:8px;">' + escH(it.designation) + '</td>' +
      '<td style="padding:8px;"><input type="text" value="' + escH(it.observation) + '" placeholder="Observation…" ' +
      'style="width:100%;padding:6px;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--text);box-sizing:border-box;" ' +
      'onchange="saveCustomObs(' + it.id + ', this.value)"></td></tr>';
  });
  tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">Aucun résultat.</td></tr>';
  updateCustomProgress();
}

// ---------- Exports ----------
function exportCustomCsv() {
  var lines = ['Valide;Symbole;Plan;Designation;Observation'];
  customList.forEach(function (it) {
    var c = function (v) { return '"' + String(v || '').replace(/"/g, '""') + '"'; };
    lines.push([it.valide ? 'OUI' : 'NON', c(it.symbole), c(it.plan), c(it.designation), c(it.observation)].join(';'));
  });
  var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'liste_suivi.csv';
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
}

function exportCustomPdf() {
  var rows = customList.map(function (it) {
    return '<tr><td>' + (it.valide ? '✔' : '') + '</td><td>' + escH(it.symbole) + '</td><td>' + escH(it.plan) +
      '</td><td>' + escH(it.designation) + '</td><td>' + escH(it.observation) + '</td></tr>';
  }).join('');
  var w = window.open('', '_blank');
  if (!w) { alert('Autorisez les popups pour imprimer.'); return; }
  w.document.write('<html><head><title>Liste de suivi</title><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px}table{width:100%;border-collapse:collapse}' +
    'th,td{border:1px solid #999;padding:4px;text-align:left}th{background:#eee}</style></head><body>' +
    '<h3>Liste de suivi</h3><table><thead><tr><th>✓</th><th>Symbole</th><th>Plan</th><th>Désignation</th><th>Observation</th></tr></thead><tbody>' +
    rows + '</tbody></table></body></html>');
  w.document.close();
  w.focus();
  w.print();
}

// ---------- Chargement automatique ----------
window.addEventListener('load', function () {
  loadCustomList();
});
