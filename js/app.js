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
document.getElementById('expCsv').addEventListener('click',  () => { exportCSV();   closeModal('shareModal'); });
document.getElementById('expXlsx').addEventListener('click', () => { exportXLSX();  closeModal('shareModal'); });
document.getElementById('expPdf').addEventListener('click',  () => { exportPrint(); });

/* RECHERCHE */
document.getElementById('searchBL').addEventListener('input', renderSidebar);

/* ACTUALISER depuis GitHub */
document.getElementById('btnReload').addEventListener('click', async () => {
  const rows = await chargerListeGitHub();
  renderSidebar();
  // Si le BL actif existe encore, on le ré-affiche ; sinon on revient à l'écran vide
  if (activeBL && state.rows.some(r => r.bl === activeBL)) {
    renderPanel();
  } else {
    activeBL = null;
    document.getElementById('blPanel').style.display   = 'none';
    document.getElementById('emptyState').style.display = 'flex';
    // Sélectionner le premier BL dispo
    if (state.rows.length) selectBL([...new Set(state.rows.map(r => r.bl))][0]);
  }
});

/* ── INIT ─────────────────────────────────────────────────────────────────── */
loadState();

// Charger la liste depuis GitHub au démarrage
chargerListeGitHub().then(() => {
  renderSidebar();
  if (state.rows.length) {
    selectBL([...new Set(state.rows.map(r => r.bl))][0]);
  }
});
