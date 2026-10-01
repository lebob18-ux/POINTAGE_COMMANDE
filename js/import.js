/* ── CHARGEMENT DES DONNÉES DEPUIS SUPABASE ──────────────────────────────────
   Remplace l'ancien chargement du CSV GitHub.
   - admin SNCF : charge toutes les lignes
   - autres entreprises : uniquement les lignes de leur EE
──────────────────────────────────────────────────────────────────────────── */

async function verifierDroits() {
  let company = getCompany();
  const email = getUserEmail();

  if (email && navigator.onLine && typeof recupererInfosUtilisateur === 'function') {
    try {
      const u = await recupererInfosUtilisateur(email);   // met aussi à jour user_company
      if (u) {
        if (!u.cmd_bl) return { ok: false, company: '' };
        return { ok: true, company: getCompany() };
      }
    } catch (e) { /* hors ligne : on garde la valeur locale */ }
  }
  return { ok: !!company, company };
}

async function chargerListe() {
  migrateOldLocal();
  await flushPending();                       // envoie d'abord ce qui est en attente

  const acces = await verifierDroits();
  if (!acces.ok) {
    state.rows = [];
    indexRows();
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    updateSyncBadge();
    return;
  }

  try {
    const all = [];
    const step = 1000;
    let from = 0;
    while (true) {
      let q = sb().from(T_LIGNES).select(DB_COLS)
        .order('id', { ascending: true }).range(from, from + step - 1);
      if (!isAdmin()) q = q.eq('ee', acces.company);
      const { data, error } = await q;
      if (error) throw error;
      all.push(...data);
      if (data.length < step) break;
      from += step;
    }
    setRows(all);
    _netLoaded = true;
    _lastLoad = Date.now();
    applyPending();                           // modifications locales pas encore parties
    saveStateNow();
  } catch (e) {
    console.warn('Chargement Supabase impossible :', e);
    loadState();                              // cache du téléphone
    if (typeof showToast === 'function') showToast('⚠ Hors ligne : données du téléphone');
  }

  updateSyncBadge();
  if (typeof renderAdminSummary === 'function') renderAdminSummary();
}

/* Recharge la liste et réaffiche l'écran */
async function rafraichir() {
  await chargerListe();
  if (typeof renderSidebar === 'function') renderSidebar();
  if (activeBL && state.rows.some(r => r.bl === activeBL)) renderPanel();
}

/* Reprend les pointages déjà saisis sur ce téléphone avec l'ancienne version
   (stockés dans le navigateur) et les envoie à Supabase, une seule fois. */
function migrateOldLocal() {
  try {
    if (localStorage.getItem('suivi_cmd_migrated')) return;
    const raw = localStorage.getItem('fbm_suivi_v3');
    if (raw) {
      const d = JSON.parse(raw);
      const me = getUserEmail() || null;
      Object.keys(d.checks || {}).forEach(k => {
        if (d.checks[k]) queuePending(k, { recu: true, pointe_par: me });
      });
      Object.keys(d.obs || {}).forEach(k => {
        if (d.obs[k]) queuePending(k, { observation: d.obs[k], pointe_par: me });
      });
    }
    localStorage.setItem('suivi_cmd_migrated', '1');
  } catch (e) { console.warn('Migration locale :', e); }
}

/* Recharge quand l'appli revient au premier plan (smartphone) */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && _netLoaded && Date.now() - _lastLoad > 60000) {
    rafraichir();
  }
});
