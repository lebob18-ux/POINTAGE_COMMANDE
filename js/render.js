/* ── RENDER.JS ───────────────────────────────────────────────────────────── */

// Configuration du bucket Supabase pour les miniatures
const SUPABASE_BUCKET_MINIATURES = "MIGNATURE_K1";

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ══════════════════════════════════════════════════════════════════════════
   MOTEUR DE RECHERCHE
   - insensible à la casse et aux accents
   - plusieurs mots = TOUS doivent correspondre sur une même ligne
     (ex : "griffe 12345" ou "12345 tsu")
   - cherche dans : BL, DM, ligne, symbole (article), intitulé, chantier, EE
   - ignore les zéros de début sur les symboles (12345 trouve 00012345)
   - index mis en cache : reconstruit seulement si les données changent
   ══════════════════════════════════════════════════════════════════════════ */
function normTxt(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseQuery(raw) {
  return normTxt(raw).split(/\s+/).filter(Boolean);
}

function stripZeros(s) {
  return String(s ?? '').trim().replace(/^0+/, '');
}

function termIn(hay, t) {
  if (hay.includes(t)) return true;
  const t2 = t.replace(/^0+/, '');
  return t2.length >= 2 && t2 !== t && hay.includes(t2);
}

function rowItemHay(r) {
  const art = String(r.article ?? '').trim();
  return normTxt(art + ' ' + stripZeros(art) + ' ' + (r.intitule ?? ''));
}

function rowAllHay(r) {
  const art = String(r.article ?? '').trim();
  return normTxt([r.bl, r.dm, r.ligne, art, stripZeros(art), r.intitule, r.chantier, r.ee].join(' '));
}

function rowQty(r) {
  return parseFloat(String(r.quantite ?? '').replace(',', '.')) || 0;
}

function rowMatches(r, terms, itemTerms) {
  if (!itemTerms.length) return false;
  const all = rowAllHay(r);
  if (!terms.every(t => termIn(all, t))) return false;
  const item = rowItemHay(r);
  return itemTerms.some(t => termIn(item, t));
}

function currentTerms() {
  const input = document.getElementById('searchBL');
  return parseQuery(input ? input.value : '');
}

/* Index : Map bl -> { bl, blN, dms, count, chantier, rows:[...] } */
let _idx = { ref: null, len: -1, ee: null, map: new Map() };

function invalidateSearchIndex() { _idx.ref = null; }

function getSearchIndex() {
  if (typeof state === 'undefined' || !Array.isArray(state.rows)) return new Map();

  const monEntreprise = (localStorage.getItem('user_company') || '').trim().toUpperCase();
  if (_idx.ref === state.rows && _idx.len === state.rows.length && _idx.ee === monEntreprise) {
    return _idx.map;
  }

  const rows = (monEntreprise && monEntreprise !== 'SNCF')
    ? state.rows.filter(r => String(r.ee || '').trim().toUpperCase() === monEntreprise)
    : state.rows;

  const map = new Map();
  rows.forEach(r => {
    const blNum = String(r.bl || '').trim();
    if (!blNum) return;
    if (!map.has(blNum)) {
      map.set(blNum, { bl: blNum, blN: normTxt(blNum), dms: new Set(), count: 0, chantier: '', rows: [] });
    }
    const b = map.get(blNum);
    b.count++;
    if (r.dm) b.dms.add(String(r.dm).trim());
    if (!b.chantier && r.chantier) b.chantier = r.chantier;
    b.rows.push({
      art: String(r.article ?? '').trim(),
      intit: String(r.intitule ?? '').trim(),
      qty: rowQty(r),
      hayItem: rowItemHay(r),
      hayAll: rowAllHay(r)
    });
  });

  _idx = { ref: state.rows, len: state.rows.length, ee: monEntreprise, map };
  return map;
}

/* Renvoie [{ b, matched:[entrées], score }] triés par pertinence */
function searchBLs(allBLs, terms) {
  const itemTerms = terms.filter(t => t.length >= 2);
  const out = [];

  allBLs.forEach((b, order) => {
    const matched = [];
    let ok = false;
    for (const e of b.rows) {
      if (terms.every(t => termIn(e.hayAll, t))) {
        ok = true;
        if (itemTerms.some(t => termIn(e.hayItem, t))) matched.push(e);
      }
    }
    if (!ok) return;

    let score = 0;
    terms.forEach(t => {
      if (b.blN === t) score = Math.max(score, 100);
      else if (b.blN.startsWith(t)) score = Math.max(score, 80);
      else if (b.blN.includes(t)) score = Math.max(score, 60);
    });
    if (matched.length) {
      const exact = matched.some(e => terms.some(t => normTxt(e.art) === t || stripZeros(normTxt(e.art)) === stripZeros(t)));
      score = Math.max(score, exact ? 50 : 30);
    }
    out.push({ b, matched, score, order });
  });

  out.sort((x, y) => (y.score - x.score) || (x.order - y.order));
  return out;
}

function aggregateMatched(matched) {
  const m = new Map();
  matched.forEach(e => {
    const o = m.get(e.art) || { art: e.art, intit: e.intit, qty: 0 };
    o.qty += e.qty;
    m.set(e.art, o);
  });
  return [...m.values()];
}

let _lastResults = [];

/* ── MINIATURE DANS LA BARRE DE RECHERCHE ────────────────────────────────── */
let _thumbTimer = null;
let _thumbLast = '';

function updateSearchThumb(raw) {
  const thumbContainer = document.getElementById('searchThumbContainer');
  const thumbImg = document.getElementById('searchThumbImg');
  if (!thumbImg) return;

  if (!/^\d{2,8}$/.test(raw)) {
    _thumbLast = '';
    clearTimeout(_thumbTimer);
    if (thumbContainer) thumbContainer.style.display = 'none';
    return;
  }
  if (raw === _thumbLast) return;
  _thumbLast = raw;
  clearTimeout(_thumbTimer);

  _thumbTimer = setTimeout(() => {
    if (!window.supabaseClient) return;
    const plan8 = raw.padStart(8, '0');
    const bucket = window.supabaseClient.storage.from(SUPABASE_BUCKET_MINIATURES);
    bucket.createSignedUrl(`${plan8}.jpg`, 60).then(({ data, error }) => {
      if (raw !== _thumbLast) return;
      if (data && !error) {
        thumbImg.src = data.signedUrl;
        if (thumbContainer) thumbContainer.style.display = 'block';
      } else {
        bucket.createSignedUrl('manquante.png', 60).then(({ data: fallback }) => {
          if (raw !== _thumbLast) return;
          if (fallback) thumbImg.src = fallback.signedUrl;
          if (thumbContainer) thumbContainer.style.display = 'block';
        });
      }
    });
  }, 250);
}

/* ── SIDEBAR & RECHERCHE ─────────────────────────────────────────────────── */
function renderSidebar() {
  const searchInput = document.getElementById('searchBL');
  const rawFilter = searchInput ? searchInput.value : '';
  const terms = parseQuery(rawFilter);
  const hasFilter = terms.length > 0;

  const clearBtn = document.getElementById('clearSearch');
  if (clearBtn) clearBtn.style.display = hasFilter ? 'block' : 'none';

  updateSearchThumb(rawFilter.trim());

  const index = getSearchIndex();
  const allBLs = Array.from(index.values());

  const results = hasFilter
    ? searchBLs(allBLs, terms)
    : allBLs.map((b, order) => ({ b, matched: [], score: 0, order }));
  _lastResults = results;

  const total = allBLs.length;
  const statsEl = document.getElementById('sidebarStats');
  if (statsEl) {
    if (hasFilter) {
      const nbLignes = results.reduce((n, x) => n + x.matched.length, 0);
      statsEl.textContent = `${results.length} BL trouvé${results.length > 1 ? 's' : ''} sur ${total}` +
        (nbLignes ? ` · ${nbLignes} ligne${nbLignes > 1 ? 's' : ''}` : '');
    } else {
      const done = allBLs.filter(b => typeof blStatus === 'function' && blStatus(b.bl) === 'ok').length;
      statsEl.textContent = total ? `${done}/${total} BL complet${done > 1 ? 's' : ''}` : '';
    }
  }

  const list = document.getElementById('blList');
  if (!list) return;
  list.innerHTML = '';

  if (!results.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:.8rem;padding:10px 4px">
      ${hasFilter ? 'Aucun résultat' : 'Aucun BL à afficher'}
    </div>`;
    return;
  }

  const badgeMap = { ok: 'badge-ok', partial: 'badge-partial', new: 'badge-new' };
  const labelMap = { ok: '✔ Complet', partial: 'En cours', new: 'À réceptionner' };

  const frag = document.createDocumentFragment();

  results.forEach(({ b, matched }) => {
    const st = typeof blStatus === 'function' ? blStatus(b.bl) : 'new';

    let hitsHtml = '';
    if (matched.length) {
      const agg = aggregateMatched(matched);
      hitsHtml = `<div class="bl-hits">` +
        agg.slice(0, 4).map(a =>
          `<div class="bl-hit"><b>${esc(a.art)}</b> ${esc(a.intit)} <span class="bl-hit-q">Qté ${esc(a.qty)}</span></div>`
        ).join('') +
        (agg.length > 4 ? `<div class="bl-hit more">+ ${agg.length - 4} autre${agg.length - 4 > 1 ? 's' : ''}</div>` : '') +
        `</div>`;
    }

    const div = document.createElement('div');
    div.className = 'bl-item' + (b.bl === activeBL ? ' active' : '');
    div.innerHTML = `
      <div class="bl-num">BL n° ${esc(b.bl)}${b.chantier ? ` — ${esc(b.chantier)}` : ''}</div>
      <div class="bl-meta">
        <span>${b.count} article${b.count > 1 ? 's' : ''}</span>
        <span class="bl-badge ${badgeMap[st] || 'badge-new'}">${labelMap[st] || 'À réceptionner'}</span>
      </div>
      <div class="bl-dms">${[...b.dms].map(esc).join(', ')}</div>
      ${hitsHtml}
    `;
    div.addEventListener('click', () => selectBL(b.bl));
    frag.appendChild(div);
  });

  list.appendChild(frag);
}

/* ── PANEL PRINCIPAL ─────────────────────────────────────────────────────── */
let panelRows = [];

function selectBL(bl) {
  activeBL = bl;
  const emptyState = document.getElementById('emptyState');
  const blPanel = document.getElementById('blPanel');
  if (emptyState) emptyState.style.display = 'none';
  if (blPanel) blPanel.style.display = 'flex';
  renderPanel();
  renderSidebar();
  // Défile jusqu'à la première ligne trouvée
  setTimeout(() => {
    const first = document.querySelector('#blTbody tr.sym-match');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 60);
}

/* Met à jour surlignage + masquage sans recharger les miniatures */
function refreshPanelHighlight() {
  const tbody = document.getElementById('blTbody');
  if (!tbody) return;
  const terms = currentTerms();
  const itemTerms = terms.filter(t => t.length >= 2);
  const onlyEl = document.getElementById('onlyMatch');
  const only = !!(onlyEl && onlyEl.checked);

  const trs = Array.from(tbody.querySelectorAll('tr[data-i]'));
  const flags = trs.map(tr => {
    const r = panelRows[Number(tr.dataset.i)];
    return !!r && rowMatches(r, terms, itemTerms);
  });
  const any = flags.some(Boolean);

  trs.forEach((tr, i) => {
    tr.classList.toggle('sym-match', flags[i]);
    tr.classList.toggle('sym-hidden', only && any && !flags[i]);
  });
}

function renderPanel() {
  if (!activeBL) return;

  const monEntreprise = (localStorage.getItem('user_company') || '').trim().toUpperCase();

  // Récupération sécurisée et filtrée des lignes associées au BL actif et à l'entreprise
  let rows = [];
  if (typeof state !== 'undefined' && state.rows && Array.isArray(state.rows)) {
    rows = state.rows.filter(r => {
      const matchBL = String(r.bl || '').trim() === String(activeBL).trim();
      const matchEE = (monEntreprise === 'SNCF' || !monEntreprise)
        ? true
        : String(r.ee || '').trim().toUpperCase() === monEntreprise;
      return matchBL && matchEE;
    });
  } else {
    rows = typeof getRowsForBL === 'function' ? getRowsForBL(activeBL) : [];
    if (monEntreprise && monEntreprise !== 'SNCF') {
      rows = rows.filter(r => String(r.ee || '').trim().toUpperCase() === monEntreprise);
    }
  }
  panelRows = rows;

  const prg  = typeof blProgress === 'function' ? blProgress(activeBL) : { done: 0, total: rows.length, pct: 0 };
  const dms  = [...new Set(rows.map(r => r.dm))].join(', ');

  const panelTitle = document.getElementById('panelTitle');
  const panelSub = document.getElementById('panelSub');
  const progBar = document.getElementById('progBar');
  const progTxt = document.getElementById('progTxt');

  if (panelTitle) panelTitle.textContent = `BL ${activeBL}`;
  if (panelSub) panelSub.textContent    = `DM : ${dms} — ${rows.length} article${rows.length > 1 ? 's' : ''}`;
  if (progBar) progBar.style.width      = prg.pct + '%';
  if (progTxt) progTxt.textContent      = `${prg.done} / ${prg.total}`;

  const cbAll = document.getElementById('cbSelectAll');
  if (cbAll) {
    cbAll.checked       = prg.done === prg.total && prg.total > 0;
    cbAll.indeterminate = prg.done > 0 && prg.done < prg.total;
  }

  const tbody = document.getElementById('blTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--muted);">Aucun article disponible pour cette entreprise dans ce BL.</td></tr>`;
    return;
  }

  rows.forEach((r, idx) => {
    const k       = typeof rowKey === 'function' ? rowKey(r) : r.article;
    const checked = !!(state && state.checks && state.checks[k]);
    const obsVal  = (state && state.obs && state.obs[k]) || '';

    // ID unique et format à 8 chiffres pour Supabase
    const imgId = `img_article_${Math.random().toString(36).substr(2, 9)}`;
    const plan8 = String(r.article).trim().padStart(8, '0');

    const tr = document.createElement('tr');
    tr.dataset.i = idx;
    if (checked) tr.classList.add('validated');

    tr.innerHTML = `
      <td class="td-check" style="vertical-align: middle; text-align: center; width: 35px; padding: 4px 2px;">
        <input type="checkbox" data-key="${esc(k)}" ${checked ? 'checked' : ''}>
      </td>

      <!-- MINIATURE ARTICLE DEPUIS SUPABASE STORAGE (MIGNATURE_K1) -->
      <td style="width: 55px; padding: 4px 2px; text-align: center; vertical-align: middle;">
        <img id="${esc(imgId)}" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2290%22%3E%3Crect width=%22120%22 height=%2290%22 fill=%22%23eee%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2211%22 fill=%22%23aaa%22%3ELoading...%3C/text%3E%3C/svg%3E" alt="" style="width: 120px; height: 90px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); display: block; margin: 0 auto;">
        <div style="font-size: 0.6rem; font-weight: bold; color: var(--muted); margin-top: 2px;">Qté:${esc(r.quantite)}</div>
      </td>

      <td class="td-dm col-dm" style="font-size: 0.7rem; padding: 4px 2px; word-break: break-all;">${esc(r.dm)}</td>
      <td class="col-ligne" style="font-size: 0.7rem; padding: 4px 2px;">${esc(r.ligne)}</td>

      <td style="text-align: center; font-size: 0.7rem; font-weight: bold; color: var(--warn); padding: 4px 2px;">
        ${esc(r.ee || '—')}
      </td>

      <td style="padding: 4px 4px;">
        <div style="width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; margin-bottom: 2px;">
            <span class="cell-article" style="font-weight: bold;">${esc(r.article)}</span>
            <span class="chantier-badge" style="font-size: 0.65rem; background: var(--surface2); padding: 1px 4px; border-radius: 3px;">${esc(r.chantier || '—')}</span>
          </div>
          <div style="font-size: 0.75rem; margin-bottom: 4px; word-break: break-word; line-height: 1.2;">
            ${esc(r.intitule)}
          </div>
          <div class="cell-obs-wrap">
            <input class="obs-input" type="text" placeholder="Observation..."
                   data-obskey="${esc(k)}" value="${esc(obsVal)}"
                   style="width: 100%; font-size: 0.7rem; padding: 3px 6px; box-sizing: border-box;">
          </div>
        </div>
      </td>
    `;

    // Chargement dynamique de la miniature de l'article depuis Supabase
    if (window.supabaseClient) {
      window.supabaseClient.storage.from(SUPABASE_BUCKET_MINIATURES).createSignedUrl(`${plan8}.jpg`, 60)
        .then(({ data, error }) => {
          const elImg = document.getElementById(imgId);
          if (elImg && data && !error) {
            elImg.src = data.signedUrl;
          } else if (elImg) {
            window.supabaseClient.storage.from(SUPABASE_BUCKET_MINIATURES).createSignedUrl('manquante.png', 60)
              .then(({ data: fallback }) => {
                if (fallback) elImg.src = fallback.signedUrl;
              });
          }
        })
        .catch(() => {
          const elImg = document.getElementById(imgId);
          if (elImg) {
            window.supabaseClient.storage.from(SUPABASE_BUCKET_MINIATURES).createSignedUrl('manquante.png', 60)
              .then(({ data: fallback }) => {
                if (fallback) elImg.src = fallback.signedUrl;
              });
          }
        });
    }

    tr.addEventListener('click', e => {
      if (['input', 'label'].includes(e.target.tagName.toLowerCase())) return;
      const cb = tr.querySelector('input[type=checkbox]');
      if (cb) {
        cb.checked = !cb.checked;
        if (typeof setCheck === 'function') setCheck(cb.dataset.key, cb.checked);
        renderPanel();
        renderSidebar();
      }
    });

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', e => {
      if (typeof setCheck === 'function') setCheck(e.target.dataset.key, e.target.checked);
      renderPanel();
      renderSidebar();
    });
  });

  tbody.querySelectorAll('.obs-input').forEach(inp => {
    inp.addEventListener('input', e => {
      if (typeof setObs === 'function') setObs(e.target.dataset.obskey, e.target.value);
    });
  });

  refreshPanelHighlight();
}

/* ── INITIALISATION ──────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchBL');
  const clearBtn = document.getElementById('clearSearch');
  const onlyMatch = document.getElementById('onlyMatch');

  if (searchInput) {
    let timer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        renderSidebar();
        refreshPanelHighlight();
      }, 120);
    });

    // Entrée : ouvre le premier résultat et ferme le clavier
    searchInput.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      renderSidebar();
      if (_lastResults.length) {
        selectBL(_lastResults[0].b.bl);
        searchInput.blur();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      renderSidebar();
      refreshPanelHighlight();
    });
  }

  if (onlyMatch) {
    onlyMatch.addEventListener('change', refreshPanelHighlight);
  }

  if (typeof renderSidebar === 'function') {
    renderSidebar();
  }
});
