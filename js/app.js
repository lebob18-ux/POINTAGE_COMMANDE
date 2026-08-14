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
// Écouteur sur la recherche globale par article
const inputSearchArticle = document.getElementById('searchArticle');

if (inputSearchArticle) {
    inputSearchArticle.addEventListener('input', (e) => {
        const termeRecherche = e.target.value.toLowerCase().trim();
        
        // Si le champ est vide, on réaffiche la liste normale des BL
        if (!termeRecherche) {
            // Appelez ici votre fonction d'affichage normale des BL (ex: renderBlList())
            return;
        }

        // Objet ou tableau global contenant vos données chargées (ex: window.allData ou votre state)
        // On cherche quels BL contiennent cet article
        let blTrouves = [];
        
        // Supposons que vous avez un accès à vos données globales (ex: un tableau regroupant tous les articles de tous les BL)
        // On parcourt les données pour trouver les BL correspondants à l'article
        if (typeof state !== 'undefined' && state.data) {
            // Adaptez selon la structure de votre objet 'state' ou 'allData'
            // Exemple : state.data est un tableau d'objets avec { bl, article, intitule, ... }
            let blSet = new Set();
            state.dataforEach(item => {
                if (item.article && item.article.toLowerCase().includes(termeRecherche)) {
                    blSet.add(item.bl);
                }
            });
            blTrouves = Array.from(blSet);
        }

        // Mettre à jour l'affichage de la liste des BL dans la sidebar avec uniquement les BL trouvés
        afficherBlFiltresParArticle(blTrouves);
    });
}

function afficherBlFiltresParArticle(listeBl) {
    const container = document.getElementById('blList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (listeBl.length === 0) {
        container.innerHTML = '<div class="no-result" style="padding: 10px; color: #888;">Aucun BL trouvé pour cet article</div>';
        return;
    }

    // Afficher les BL trouvés dans la liste latérale
    listeBl.forEach(numBl => {
        let div = document.createElement('div');
        div.className = 'bl-item'; // Utilisez la classe CSS existante pour vos éléments de BL
        div.textContent = `BL n° ${numBl}`;
        div.onclick = () => chargerEtAfficherBl(numBl); // Fonction qui charge le BL au clic
        container.appendChild(div);
    });
}
/* ── INIT ─────────────────────────────────────────────────────────────────── */
loadState();

// Charger la liste depuis GitHub au démarrage
chargerListeGitHub().then(() => {
  renderSidebar();
  if (state.rows.length) {
    selectBL([...new Set(state.rows.map(r => r.bl))][0]);
  }
});
