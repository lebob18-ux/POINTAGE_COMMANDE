/* ── RENDER.JS ───────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── SIDEBAR & RECHERCHE ─────────────────────────────────────────────────── */
function renderSidebar() {
  const searchInput = document.getElementById('searchBL');
  const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const allBLs = typeof getBLs === 'function' ? getBLs() : [];
  
  // Gestion de la miniature dynamique à côté de la recherche (Dépôt GitHub partagé)
  const thumbContainer = document.getElementById('searchThumbContainer');
  const thumbImg = document.getElementById('searchThumbImg');
  if (filter.length >= 2 && thumbImg) {
    thumbImg.src = `https://raw.githubusercontent.com/lebob18-ux/MIGNATURE_K1/main/${filter}.jpg`;
    thumbImg.onerror = () => { if (thumbContainer) thumbContainer.style.display = 'none'; };
    thumbImg.onload = () => { if (thumbContainer) thumbContainer.style.display = 'block'; };
  } else {
    if (thumbContainer) thumbContainer.style.display = 'none';
  }

  const bls = filter
    ? allBLs.filter(b =>
        b.bl.toLowerCase().includes(filter) ||
        [...b.dms].some(d => d.toLowerCase().includes(filter)))
    : allBLs;

  // Stats globales
  const total = allBLs.length;
  const done  = allBLs.filter(b => typeof blStatus === 'function' && blStatus(b.bl) === 'ok').length;
  const statsEl = document.getElementById('sidebarStats');
  if (statsEl) {
    statsEl.textContent = total ? `${done}/${total} BL complet${done > 1 ? 's' : ''}` : '';
  }

  const list = document.getElementById('blList');
  if (!list) return;
  list.innerHTML = '';

  if (!bls.length) {
    list.innerHTML = `<div style="color:var(--muted);font-size:.8rem;padding:10px 4px">
      ${filter ? 'Aucun résultat' : 'Aucun BL — importez une liste'}
    </div>`;
    return;
  }

  const badgeMap  = { ok: 'badge-ok', partial: 'badge-partial', new: 'badge-new' };
  const labelMap  = { ok: '✔ Complet', partial: 'En cours', new: 'À réceptionner' };

  bls.forEach(b => {
    const st  = typeof blStatus === 'function' ? blStatus(b.bl) : 'new';
    const div = document.createElement('div');
    div.className = 'bl-item' + (b.bl === activeBL ? ' active' : '');
    div.innerHTML = `
      <div class="bl-num">${esc(b.bl)}</div>
      <div class="bl-meta">
        <span>${b.count} article${b.count > 1 ? 's' : ''}</span>
        <span class="bl-badge ${badgeMap[st] || 'badge-new'}">${labelMap[st] || 'À réceptionner'}</span>
      </div>
      <div class="bl-dms">${[...b.dms].map(esc).join(', ')}</div>
    `;
    div.addEventListener('click', () => selectBL(b.bl));
    list.appendChild(div);
  });
}

/* ── PANEL PRINCIPAL ─────────────────────────────────────────────────────── */
function selectBL(bl) {
  activeBL = bl;
  const emptyState = document.getElementById('emptyState');
  const blPanel = document.getElementById('blPanel');
  if (emptyState) emptyState.style.display = 'none';
  if (blPanel) blPanel.style.display = 'flex';
  renderPanel();
  renderSidebar();
}

function renderPanel() {
  if (!activeBL) return;
  const rows = typeof getRowsForBL === 'function' ? getRowsForBL(activeBL) : [];
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

  /* Coche "tout-sélectionner" dans le thead */
  const cbAll = document.getElementById('cbSelectAll');
  if (cbAll) {
    cbAll.checked         = prg.done === prg.total && prg.total > 0;
    cbAll.indeterminate = prg.done > 0 && prg.done < prg.total;
  }

  const tbody = document.getElementById('blTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.forEach(r => {
    const k       = typeof rowKey === 'function' ? rowKey(r) : r.article;
    const checked = !!(state && state.checks && state.checks[k]);
    const obsVal  = (state && state.obs && state.obs[k]) || '';

    const tr = document.createElement('tr');
    if (checked) tr.classList.add('validated');

    tr.innerHTML = `
      <td class="td-check" style="vertical-align: middle; text-align: center; width: 35px; padding: 4px 2px;">
        <input type="checkbox" data-key="${esc(k)}" ${checked ? 'checked' : ''}>
      </td>
      
      <!-- MINIATURE DEPUIS LE DEPOT GITHUB MIGNATURE_K1 -->
      <td style="width: 55px; padding: 4px 2px; text-align: center; vertical-align: middle;">
        <img src="https://raw.githubusercontent.com/lebob18-ux/MIGNATURE_K1/main/${esc(r.article)}.jpg" alt="" style="width: 120px; height: 90px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); display: block; margin: 0 auto;" onerror="this.style.display='none'">
        <div style="font-size: 0.6rem; font-weight: bold; color: var(--muted); margin-top: 2px;">Qté:${esc(r.quantite)}</div>
      </td>

      <td class="td-dm col-dm" style="font-size: 0.7rem; padding: 4px 2px; word-break: break-all;">${esc(r.dm)}</td>
      <td class="col-ligne" style="font-size: 0.7rem; padding: 4px 2px;">${esc(r.ligne)}</td>
      
      <!-- COLONNE EE (Entreprise) -->
      <td style="text-align: center; font-size: 0.7rem; font-weight: bold; color: var(--warn); padding: 4px 2px;">
        ${esc(r.ee || '—')}
      </td>

      <td style="padding: 4px 4px;">
        <div style="width: 100%; box-sizing: border-box;">
          
          <!-- Ligne 1 : Symbole (Article) collé au Chantier -->
          <div style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; margin-bottom: 2px;">
            <span class="cell-article" style="font-weight: bold;">${esc(r.article)}</span>
            <span class="chantier-badge" style="font-size: 0.65rem; background: var(--surface2); padding: 1px 4px; border-radius: 3px;">${esc(r.chantier || '—')}</span>
          </div>

          <!-- Ligne 2 : Intitulé complet -->
          <div class="cell-intitule" style="font-size: 0.75rem; margin-bottom: 4px; word-break: break-word; line-height: 1.2;">
            ${esc(r.intitule)}
          </div>

          <!-- Ligne 3 : Champ d'observation -->
          <div class="cell-obs-wrap">
            <input class="obs-input" type="text" placeholder="Observation..."
                   data-obskey="${esc(k)}" value="${esc(obsVal)}"
                   style="width: 100%; font-size: 0.7rem; padding: 3px 6px; box-sizing: border-box;">
          </div>

        </div>
      </td>
    `;

    // Clic sur toute la ligne pour cocher/décocher (sauf sur les champs de saisie)
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

  /* Événements sur les éléments interactifs de la table */
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
}

// Écouteur global pour la barre de recherche
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchBL');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderSidebar();
    });
  }
});
