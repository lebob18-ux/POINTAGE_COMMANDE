/* ── RENDER.JS ───────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── SIDEBAR & RECHERCHE ─────────────────────────────────────────────────── */
function renderSidebar() {
  const searchInput = document.getElementById('searchBL');
  const filter = searchInput.value.toLowerCase().trim();
  const allBLs = getBLs();
  
  // Gestion de la miniature dynamique à côté de la recherche
  const thumbContainer = document.getElementById('searchThumbContainer');
  const thumbImg = document.getElementById('searchThumbImg');
  if (filter.length >= 2) {
    thumbImg.src = `image/${filter}.jpg`;
    thumbImg.onerror = () => { thumbContainer.style.display = 'none'; };
    thumbImg.onload = () => { thumbContainer.style.display = 'block'; };
  } else {
    thumbContainer.style.display = 'none';
  }

  const bls = filter
    ? allBLs.filter(b =>
        b.bl.toLowerCase().includes(filter) ||
        [...b.dms].some(d => d.toLowerCase().includes(filter)))
    : allBLs;

  // Stats globales
  const total = allBLs.length;
  const done  = allBLs.filter(b => blStatus(b.bl) === 'ok').length;
  document.getElementById('sidebarStats').textContent =
    total ? `${done}/${total} BL complet${done > 1 ? 's' : ''}` : '';

  const list = document.getElementById('blList');
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
    const st  = blStatus(b.bl);
    const div = document.createElement('div');
    div.className = 'bl-item' + (b.bl === activeBL ? ' active' : '');
    div.innerHTML = `
      <div class="bl-num">${esc(b.bl)}</div>
      <div class="bl-meta">
        <span>${b.count} article${b.count > 1 ? 's' : ''}</span>
        <span class="bl-badge ${badgeMap[st]}">${labelMap[st]}</span>
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
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('blPanel').style.display = 'flex';
  renderPanel();
  renderSidebar();
}

function renderPanel() {
  if (!activeBL) return;
  const rows = getRowsForBL(activeBL);
  const prg  = blProgress(activeBL);
  const dms  = [...new Set(rows.map(r => r.dm))].join(', ');

  document.getElementById('panelTitle').textContent = `BL ${activeBL}`;
  document.getElementById('panelSub').textContent    = `DM : ${dms} — ${rows.length} article${rows.length > 1 ? 's' : ''}`;
  document.getElementById('progBar').style.width     = prg.pct + '%';
  document.getElementById('progTxt').textContent     = `${prg.done} / ${prg.total}`;

  /* Coche "tout-sélectionner" dans le thead */
  const cbAll = document.getElementById('cbSelectAll');
  if (cbAll) {
    cbAll.checked        = prg.done === prg.total && prg.total > 0;
    cbAll.indeterminate = prg.done > 0 && prg.done < prg.total;
  }

  const tbody = document.getElementById('blTbody');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const k       = rowKey(r);
    const checked = !!state.checks[k];
    const obsVal  = state.obs[k] || '';

    const tr = document.createElement('tr');
    if (checked) tr.classList.add('validated');

tr.innerHTML = `
      <td class="td-check" style="vertical-align: top; text-align: center; width: 35px; padding: 6px 2px;">
        <input type="checkbox" data-key="${esc(k)}" ${checked ? 'checked' : ''} style="margin-bottom: 4px;">
        <div style="font-size: 0.65rem; font-weight: bold; color: var(--muted);">Qté:${esc(r.quantite)}</div>
      </td>
      <td class="td-dm col-dm" style="font-size: 0.75rem; padding: 6px 4px; word-break: break-all;">${esc(r.dm)}</td>
      <td class="col-ligne" style="font-size: 0.75rem; padding: 6px 4px;">${esc(r.ligne)}</td>
      <td style="padding: 6px 4px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; width: 100%; box-sizing: border-box;">
          
          <!-- BLOC TEXTE FLUIDE (S'adapte à 100% de l'espace restant sans jamais déborder) -->
          <div style="flex: 1; min-width: 0; overflow: hidden;">
            
            <!-- Ligne 1 : Article et Chantier -->
            <div style="display: flex; justify-content: space-between; gap: 4px; font-size: 0.8rem; align-items: baseline;">
              <span class="cell-article" style="font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(r.article)}</span>
              <span class="chantier-badge" style="font-size: 0.65rem; flex-shrink: 0;">${esc(r.chantier || '—')}</span>
            </div>

            <!-- Ligne 2 : Intitulé (Revient à la ligne proprement et gère les mots longs) -->
            <div class="cell-intitule" style="font-size: 0.75rem; margin: 2px 0; word-break: break-word; line-height: 1.2;">
              ${esc(r.intitule)}
            </div>

            <!-- Ligne 3 : Champ d'observation en largeur 100% -->
            <div class="cell-obs-wrap" style="margin-top: 3px;">
              <input class="obs-input" type="text" placeholder="Observation..."
                     data-obskey="${esc(k)}" value="${esc(obsVal)}"
                     style="width: 100%; font-size: 0.7rem; padding: 3px 5px; box-sizing: border-box;">
            </div>

          </div>

          <!-- MINIATURE (Taille proportionnelle en pourcentage max ou fixe compacte pour mobile) -->
          <img src="image/${esc(r.article)}.jpg" alt="" style="width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); flex-shrink: 0;" onerror="this.style.display='none'">

        </div>
      </td>
    `;

    // Clic sur toute la ligne pour cocher/décocher (sauf sur les champs de saisie)
    tr.addEventListener('click', e => {
      if (['input', 'label'].includes(e.target.tagName.toLowerCase())) return;
      const cb = tr.querySelector('input[type=checkbox]');
      cb.checked = !cb.checked;
      setCheck(cb.dataset.key, cb.checked);
      renderPanel();
      renderSidebar();
    });

    tbody.appendChild(tr);
  });

  /* Événements sur les éléments interactifs de la table */
  tbody.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', e => {
      setCheck(e.target.dataset.key, e.target.checked);
      renderPanel();
      renderSidebar();
    });
  });

  tbody.querySelectorAll('.obs-input').forEach(inp => {
    inp.addEventListener('input', e => setObs(e.target.dataset.obskey, e.target.value));
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
