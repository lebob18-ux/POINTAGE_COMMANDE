/* ── RENDER.JS ───────────────────────────────────────────────────────────── */

// Configuration du bucket Supabase pour les miniatures
const SUPABASE_BUCKET_MINIATURES = "MIGNATURE_K1";

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── SIDEBAR & RECHERCHE ─────────────────────────────────────────────────── */
function renderSidebar() {
  const searchInput = document.getElementById('searchBL');
  const filter = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const allBLs = typeof getBLs === 'function' ? getBLs() : [];
  
  // Gestion de la miniature dynamique à côté de la recherche via Supabase (8 chiffres)
  const thumbContainer = document.getElementById('searchThumbContainer');
  const thumbImg = document.getElementById('searchThumbImg');
  
  if (filter.length >= 2 && thumbImg) {
    const plan8 = filter.padStart(8, '0');
    if (window.supabaseClient) {
      window.supabaseClient.storage.from(SUPABASE_BUCKET_MINIATURES).createSignedUrl(`${plan8}.jpg`, 60)
        .then(({ data, error }) => {
          if (data && !error) {
            thumbImg.src = data.signedUrl;
            if (thumbContainer) thumbContainer.style.display = 'block';
          } else {
            window.supabaseClient.storage.from(SUPABASE_BUCKET_MINIATURES).createSignedUrl('manquante.png', 60)
              .then(({ data: fallback }) => {
                if (fallback) thumbImg.src = fallback.signedUrl;
                if (thumbContainer) thumbContainer.style.display = 'block';
              });
          }
        });
    }
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
    
    let chantierNom = '';
    const rowsForThisBL = typeof getRowsForBL === 'function' ? getRowsForBL(b.bl) : [];
    if (rowsForThisBL && rowsForThisBL.length > 0 && rowsForThisBL[0].chantier) {
      chantierNom = rowsForThisBL[0].chantier;
    }

    const div = document.createElement('div');
    div.className = 'bl-item' + (b.bl === activeBL ? ' active' : '');
    div.innerHTML = `
      <div class="bl-num">BL n° ${esc(b.bl)}${chantierNom ? ` — ${esc(chantierNom)}` : ''}</div>
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

  const cbAll = document.getElementById('cbSelectAll');
  if (cbAll) {
    cbAll.checked         = prg.done === prg.total && prg.total > 0;
    cbAll.indeterminate = prg.done > 0 && prg.done < prg.total;
  }

  const tbody = document.getElementById('blTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.forEach(r => {
    const k        = typeof rowKey === 'function' ? rowKey(r) : r.article;
    const checked = !!(state && state.checks && state.checks[k]);
    const obsVal  = (state && state.obs && state.obs[k]) || '';
    
    // Génération d'un ID unique pour charger l'image de cet article via Supabase Storage
    const imgId = `img_article_${Math.random().toString(36).substr(2, 9)}`;
    // Format à 8 chiffres pour correspondre à vos fichiers (ex: 00000123.jpg)
    const plan8 = String(r.article).trim().padStart(8, '0');

    const tr = document.createElement('tr');
    if (checked) tr.classList.add('validated');

    tr.innerHTML = `
      <td class="td-check" style="vertical-align: middle; text-align: center; width: 35px; padding: 4px 2px;">
        <input type="checkbox" data-key="${esc(k)}" ${checked ? 'checked' : ''}>
      </td>
      
      <!-- MINIATURE DEPUIS SUPABASE STORAGE (MIGNATURE_K1) -->
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

    // Appel asynchrone Supabase pour récupérer l'URL signée de la miniature à 8 chiffres
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
}

/* ── GESTION DES AUTORISATIONS SUPABASE ──────────────────────────────────── */

async function initialiserAcces() {
    const emailLocal = localStorage.getItem('pelican_user_email');
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    if (emailLocal) {
        const valide = await verifierValidationEmail(emailLocal);
        if (valide) {
            overlay.style.display = 'none';
            return;
        }
        overlay.style.display = 'flex';
        const formDemande = document.getElementById('form-demande');
        const attenteVal = document.getElementById('attente-validation');
        const authMsg = document.getElementById('auth-message');
        if (formDemande) formDemande.style.display = 'none';
        if (attenteVal) attenteVal.style.display = 'block';
        if (authMsg) authMsg.textContent = 'Votre accès à CMD_BL est en attente de validation.';
        return;
    }

    overlay.style.display = 'flex';
    const formDemande = document.getElementById('form-demande');
    const attenteVal = document.getElementById('attente-validation');
    if (formDemande) formDemande.style.display = 'block';
    if (attenteVal) attenteVal.style.display = 'none';
}

async function verifierValidationEmail(email) {
    if (!window.supabaseClient) return false;
    
    const { data, error } = await window.supabaseClient
        .from('app_bob')
        .select('cmd_bl')
        .eq('email', email);

    if (error || !data || data.length === 0) return false;
    
    return data[0].cmd_bl === true;
}

async function envoyerDemandeAcces() {
    const prenomEl = document.getElementById('req-prenom');
    const nomEl = document.getElementById('req-nom');
    const emailEl = document.getElementById('req-email');

    const prenom = prenomEl ? prenomEl.value.trim() : '';
    const nom = nomEl ? nomEl.value.trim() : '';
    const email = emailEl ? emailEl.value.trim() : '';

    if (!prenom || !nom || !email) {
        alert('Veuillez remplir tous les champs.');
        return;
    }
    if (!window.supabaseClient) {
        alert('Connexion Supabase non disponible.');
        return;
    }

    const { data: existantList } = await window.supabaseClient
        .from('app_bob')
        .select('id, cmd_bl')
        .eq('email', email);

    const existant = (existantList && existantList.length > 0) ? existantList[0] : null;

    if (existant) {
        localStorage.setItem('pelican_user_email', email);
        if (existant.cmd_bl) {
            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.style.display = 'none';
            return;
        }
        const formDemande = document.getElementById('form-demande');
        const attenteVal = document.getElementById('attente-validation');
        const authMsg = document.getElementById('auth-message');
        if (formDemande) formDemande.style.display = 'none';
        if (attenteVal) attenteVal.style.display = 'block';
        if (authMsg) authMsg.textContent = 'Votre e-mail existe déjà, en attente de validation de l\'accès.';
        return;
    }

    const { error } = await window.supabaseClient
        .from('app_bob')
        .insert([{ prenom, nom, email, cmd_bl: false }]);

    if (error) {
        alert('Erreur lors de l\'envoi de la demande : ' + error.message);
        return;
    }

    localStorage.setItem('pelican_user_email', email);
    const formDemande = document.getElementById('form-demande');
    const attenteVal = document.getElementById('attente-validation');
    const authMsg = document.getElementById('auth-message');
    if (formDemande) formDemande.style.display = 'none';
    if (attenteVal) attenteVal.style.display = 'block';
    if (authMsg) authMsg.textContent = 'Demande envoyée ! En attente de validation par l\'administrateur.';
}

async function verifierAcces() {
    const email = localStorage.getItem('pelican_user_email');
    if (!email) return;
    const valide = await verifierValidationEmail(email);
    const overlay = document.getElementById('auth-overlay');
    if (valide) {
        if (overlay) overlay.style.display = 'none';
    } else {
        alert('Accès non validé pour CMD_BL.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initialiserAcces === 'function') {
    initialiserAcces();
  }

  const searchInput = document.getElementById('searchBL');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderSidebar();
    });
  }
  
  if (typeof renderSidebar === 'function') {
    renderSidebar();
  }
});
