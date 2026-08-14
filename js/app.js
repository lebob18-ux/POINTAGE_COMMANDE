/* ── APP ─────────────────────────────────────────────────────────────────── */

/* TOAST */
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* MODALS */
function openModal(id)  { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.querySelectorAll('[data-close]').forEach(btn =>
  btn.addEventListener('click', () => closeModal(btn.dataset.close))
);
document.querySelectorAll('.modal-backdrop').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) closeModal(el.id); })
);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal('shareModal'); });

/* COCHE TOUT SÉLECTIONNER (thead) */
document.getElementById('cbSelectAll').addEventListener('change', e => {
  if (!activeBL) return;
  const cocher = e.target.checked;
  getRowsForBL(activeBL).forEach(r => setCheck(rowKey(r), cocher));
  renderPanel();
  renderSidebar();
  showToast(cocher ? '✔ Toutes les lignes cochées' : 'Toutes les lignes décochées');
});

/* EXPORT */
document.getElementById('btnShare').addEventListener('click', () => openModal('shareModal'));
document.getElementById('expCsv').addEventListener('click',  () => { exportCSV();    closeModal('shareModal'); });
document.getElementById('expXlsx').addEventListener('click', () => { exportXLSX();  closeModal('shareModal'); });
document.getElementById('expPdf').addEventListener('click',  () => { exportPrint(); });

/* UNIQUE BARRE DE RECHERCHE UNIVERSELLE (BL, DM, Article...) */
const inputSearch = document.getElementById('searchBL');
if (inputSearch) {
    // On met à jour le placeholder pour indiquer qu'on peut tout chercher
    inputSearch.placeholder = "Rechercher BL, DM, Article…";
    
    inputSearch.addEventListener('input', (e) => {
        const terme = e.target.value.toLowerCase().trim();
        
        // Si vide, on affiche la liste normale via renderSidebar
        if (!terme) {
            renderSidebar();
            return;
        }

        // Sinon, on cherche les BL qui matchent soit sur le N° de BL, soit sur un DM, soit sur un Article
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
            
            // Affichage dynamique des BL correspondants dans la sidebar
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

/* ACTUALISER depuis GitHub */
document.getElementById('btnReload').addEventListener('click', async () => {
  await chargerListeGitHub();
  renderSidebar();
  if (activeBL && state.rows.some(r => r.bl === activeBL)) {
    renderPanel();
  } else {
    activeBL = null;
    document.getElementById('blPanel').style.display   = 'none';
    document.getElementById('emptyState').style.display = 'flex';
  }
});
// Si besoin d'assurer le focus sur mobile lors de la sélection d'un BL
function selectBLSurMobile(numBl) {
    selectBL(numBl);
    if (window.innerWidth <= 768) {
        document.getElementById('blPanel').scrollIntoView({ behavior: 'smooth' });
    }
}
/* ── INIT ─────────────────────────────────────────────────────────────────── */
loadState();

// Charger la liste depuis GitHub au démarrage SANS pré-sélectionner de BL
chargerListeGitHub().then(() => {
  renderSidebar();
  // On s'assure de rester sur l'écran vide au démarrage
  activeBL = null;
  document.getElementById('blPanel').style.display = 'none';
  document.getElementById('emptyState').style.display = 'flex';
});
