/* ── RENDER ──────────────────────────────────────────────────────────────── */

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── SIDEBAR ─────────────────────────────────────────────────────────────── */
function renderSidebar() {
  const filter = document.getElementById('searchBL').value.toLowerCase().trim();
  const allBLs = getBLs();
  const bls = filter
    ? allBLs.filter(b =>
        b.bl.toLowerCase().includes(filter) ||
        [...b.dms].some(d => d.toLowerCase().includes(filter)))
    : allBLs;

  // stats globales
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
    const prg = blProgress(b.bl);
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

/* ── PANEL ───────────────────────────────────────────────────────────────── */
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

  /* ── coche tout-sélectionner dans le thead ── */
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

    // On fusionne Article et Intitulé dans une seule cellule avec des classes dédiées (empilé sur mobile)
    tr.innerHTML = `
      <td class="td-check">
        <input type="checkbox" data-key="${esc(k)}" ${checked ? 'checked' : ''}>
      </td>
      <td class="td-dm col-dm">${esc(r.dm)}</td>
      <td class="col-ligne">${esc(r.ligne)}</td>
      <td><span class="chantier-badge">${esc(r.chantier || '—')}</span></td>
      <td colspan="2">
        <span class="cell-article">${esc(r.article)}</span>
        <span class="cell-intitule">${esc(r.intitule)}</span>
      </td>
      <td><span class="qty-badge">${esc(r.quantite)}</span></td>
      <td class="td-obs">
        <input class="obs-input" type="text" placeholder="Observation…"
               data-obskey="${esc(k)}" value="${esc(obsVal)}">
      </td>
    `;

    // ── Rendre toute la ligne cliquable (sauf si on clique sur un input) ──
    tr.addEventListener('click', e => {
      if (e.target.tagName.toLowerCase() !== 'input') {
        const cb = tr.querySelector('input[type=checkbox]');
        cb.checked = !cb.checked;
        setCheck(cb.dataset.key, cb.checked);
        renderPanel();
        renderSidebar();
      }
    });

    tbody.appendChild(tr);
  });

  /* events lignes */
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
