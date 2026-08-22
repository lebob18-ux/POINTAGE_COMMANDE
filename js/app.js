/* ── APP ─────────────────────────────────────────────────────────────────── */

/* TOAST */
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* MODALS */
function openModal(id)  { 
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex'; 
}
function closeModal(id) { 
  const el = document.getElementById(id);
  if (el) el.style.display = 'none'; 
}

document.querySelectorAll('[data-close]').forEach(btn =>
  btn.addEventListener('click', () => closeModal(btn.dataset.close))
);
document.querySelectorAll('.modal-backdrop').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); })
);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal('shareModal'); });

/* COCHE TOUT SÉLECTIONNER (thead) */
const cbSelectAll = document.getElementById('cbSelectAll');
if (cbSelectAll) {
  cbSelectAll.addEventListener('change', e => {
    if (!activeBL) return;
    const cocher = e.target.checked;
    getRowsForBL(activeBL).forEach(r => setCheck(rowKey(r), cocher));
    renderPanel();
    renderSidebar();
    showToast(cocher ? '✔ Toutes les lignes cochées' : 'Toutes les lignes décochées');
  });
}

/* EXPORT */
const btnShare = document.getElementById('btnShare');
if (btnShare) btnShare.addEventListener('click', () => openModal('shareModal'));

const expCsv = document.getElementById('expCsv');
if (expCsv) expCsv.addEventListener('click', () => { exportCSV(); closeModal('shareModal'); });

const expXlsx = document.getElementById('expXlsx');
if (expXlsx) expXlsx.addEventListener('click', () => { exportXLSX(); closeModal('shareModal'); });

const expPdf = document.getElementById('expPdf');
if (expPdf) expPdf.addEventListener('click', () => { exportPrint(); });

/* UNIQUE BARRE DE RECHERCHE UNIVERSELLE (BL, DM, Article...) */
const inputSearch = document.getElementById('searchBL');
if (inputSearch) {
    inputSearch.placeholder = "Rechercher BL, DM, Article…";
    
    inputSearch.addEventListener('input', (e) => {
        const terme = e.target.value.toLowerCase().trim();
        
        if (!terme) {
            renderSidebar();
            return;
        }

        if (typeof state !== 'undefined' && state.rows) {
            let blSet = new Set();
            state.rows.forEach(item => {
                const matchBl = item.bl && String(item.bl).toLowerCase().includes(terme);
                const matchDm = item.dm && String(item.dm).toLowerCase().includes(terme);
                const matchArt = item.article && String(item.article).toLowerCase().includes(terme);
                const matchIntitule = item.intitule && String(item.intitule).toLowerCase().includes(terme);

                if (matchBl || matchDm || matchArt || matchIntitule) {
                    blSet.add(item.bl);
                }
            });
            
            const container = document.getElementById('blList');
            if (container) {
                container.innerHTML = '';
                const listeBl = Array.from(blSet);
                
                if (listeBl.length === 0) {
                    container.innerHTML = '<div style="padding: 10px; color: #888; text-align:center;">Aucun résultat</div>';
                    return;
                }

                listeBl.forEach(numBl => {
                    let div = document.createElement('div');
                    div.className = 'bl-item';
                    if (activeBL === numBl) div.classList.add('active');
                    div.textContent = `BL n° ${numBl}`;
                    div.onclick = () => selectBL(numBl);
                    container.appendChild(div);
                });
            }
        }
    });
}

/* ACTUALISER depuis GitHub (Sécurisé au cas où le bouton n'existe pas) */
const btnReload = document.getElementById('btnReload');
if (btnReload) {
  btnReload.addEventListener('click', async () => {
    await chargerListeGitHub();
    renderSidebar();
    if (activeBL && state.rows.some(r => r.bl === activeBL)) {
      renderPanel();
    } else {
      activeBL = null;
      const blPanel = document.getElementById('blPanel');
      const emptyState = document.getElementById('emptyState');
      if (blPanel) blPanel.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
    }
  });
}

// Si besoin d'assurer le focus sur mobile lors de la sélection d'un BL
function selectBLSurMobile(numBl) {
    selectBL(numBl);
    if (window.innerWidth <= 768) {
        const blPanel = document.getElementById('blPanel');
        if (blPanel) blPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

/* ── INIT ─────────────────────────────────────────────────────────────────── */
if (typeof loadState === 'function') loadState();

// Charger la liste depuis GitHub au démarrage SANS pré-sélectionner de BL
if (typeof chargerListeGitHub === 'function') {
  chargerListeGitHub().then(() => {
    if (typeof renderSidebar === 'function') renderSidebar();
    activeBL = null;
    const blPanel = document.getElementById('blPanel');
    const emptyState = document.getElementById('emptyState');
    if (blPanel) blPanel.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
  });
}
