/* ================= GESTION DE L'AUTHENTIFICATION & POP-UP ================= */

function checkSNCF() {
    // Vérifier si un code ou une entreprise est déjà mémorisé
    const savedCompany = localStorage.getItem('user_company');
    const savedCode = localStorage.getItem('sncf_auth_code');
    
    if (savedCode || savedCompany === 'SNCF') {
        switchTab('admin');
        return;
    }

    // Sinon, on affiche le pop-up de configuration propre
    const modal = document.getElementById('companyModal');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        // Fallback si le modal HTML n'est pas trouvé
        const code = prompt("Veuillez saisir votre identifiant SNCF (7 chiffres + 1 lettre) :");
        if (code && code.length >= 8) {
            localStorage.setItem('sncf_auth_code', code);
            switchTab('admin');
        } else {
            alert("Code invalide.");
        }
    }
}

// Gestion de l'onglet actif
function switchTab(tabId) {
    // Masquer tous les contenus d'onglets
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    
    // Désactiver tous les boutons de la navbar
    document.querySelectorAll('.nav-tabs .btn').forEach(el => el.classList.remove('active'));
    
    // Afficher l'onglet sélectionné et activer le bon bouton
    if (tabId === 'commandes') {
        const tabEl = document.getElementById('tab-commandes');
        if (tabEl) tabEl.style.display = 'block';
        
        // Active le premier bouton de la liste
        const firstBtn = document.querySelector('.nav-tabs .btn');
        if (firstBtn) firstBtn.classList.add('active');
        
    } else if (tabId === 'admin') {
        const adminTabEl = document.getElementById('tab-admin');
        if (adminTabEl) adminTabEl.style.display = 'block';
        
        const adminBtn = document.getElementById('adminTabButton');
        if (adminBtn) {
            adminBtn.style.display = 'inline-block'; // S'assure qu'il est visible
            adminBtn.classList.add('active');
        }
    }
}
/* ── GESTION DES AUTORISATIONS SUPABASE (auth.js) ──────────────────────────── */

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
