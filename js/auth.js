/* ================= GESTION DE L'AUTHENTIFICATION & ACCÈS PAR ENTREPRISE ================= */

async function checkSNCF() {
    const emailLocal = localStorage.getItem('pelican_user_email');
    
    if (!emailLocal) {
        alert("Veuillez d'abord valider votre e-mail d'accès à l'application.");
        return;
    }

    if (!window.supabaseClient) {
        alert("Connexion Supabase non disponible.");
        return;
    }

    // Interrogation de la table app_bob pour récupérer l'entreprise de l'utilisateur
    const { data, error } = await window.supabaseClient
        .from('app_bob')
        .select('entreprise, cmd_bl')
        .eq('email', emailLocal)
        .single();

    if (error || !data) {
        alert("Impossible de vérifier vos informations d'entreprise.");
        return;
    }

    // On stocke l'entreprise proprement en local
    if (data.entreprise) {
        localStorage.setItem('user_company', data.entreprise.trim().toUpperCase());
    }

    // On vérifie si l'entreprise est bien SNCF et validée
    if (data.entreprise && data.entreprise.toUpperCase() === 'SNCF' && data.cmd_bl === true) {
        switchTab('admin');
    } else {
        alert("Accès restreint : cette section est réservée au personnel SNCF validé.");
    }
}

// Gestion de l'onglet actif
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-tabs .btn').forEach(el => el.classList.remove('active'));
    
    if (tabId === 'commandes') {
        const tabEl = document.getElementById('tab-commandes');
        if (tabEl) tabEl.style.display = 'block';
        
        const firstBtn = document.querySelector('.nav-tabs .btn');
        if (firstBtn) firstBtn.classList.add('active');
        
    } else if (tabId === 'admin') {
        const adminTabEl = document.getElementById('tab-admin');
        if (adminTabEl) adminTabEl.style.display = 'block';
        
        const adminBtn = document.getElementById('adminTabButton');
        if (adminBtn) {
            adminBtn.style.display = 'inline-block';
            adminBtn.classList.add('active');
        }
    }
}

/* ── GESTION DES AUTORISATIONS SUPABASE ────────────────────────────────────── */

async function initialiserAcces() {
    const emailLocal = localStorage.getItem('pelican_user_email');
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    if (emailLocal) {
        const utilisateur = await recupererInfosUtilisateur(emailLocal);
        if (utilisateur && utilisateur.cmd_bl) {
            overlay.style.display = 'none';
            // Si c'est un utilisateur SNCF, on affiche le bouton d'accès admin
            if (utilisateur.entreprise && utilisateur.entreprise.toUpperCase() === 'SNCF') {
                const adminBtn = document.getElementById('adminTabButton');
                if (adminBtn) adminBtn.style.display = 'inline-block';
            }
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

async function recupererInfosUtilisateur(email) {
    if (!window.supabaseClient) return null;
    
    const { data, error } = await window.supabaseClient
        .from('app_bob')
        .select('cmd_bl, entreprise')
        .eq('email', email);

    if (error || !data || data.length === 0) return null;
    
    const utilisateur = data[0];

    // STOCKAGE AUTOMATIQUE DE L'ENTREPRISE EN LOCAL
    if (utilisateur.entreprise) {
        localStorage.setItem('user_company', utilisateur.entreprise.trim().toUpperCase());
    }

    return utilisateur;
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
        .select('id, cmd_bl, entreprise')
        .eq('email', email);

    const existant = (existantList && existantList.length > 0) ? existantList[0] : null;

    if (existant) {
        localStorage.setItem('pelican_user_email', email);
        if (existant.entreprise) {
            localStorage.setItem('user_company', existant.entreprise.trim().toUpperCase());
        }
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
    const infos = await recupererInfosUtilisateur(email);
    const overlay = document.getElementById('auth-overlay');
    if (infos && infos.cmd_bl) {
        if (overlay) overlay.style.display = 'none';
    } else {
        alert('Accès non validé pour CMD_BL.');
    }
}

// Lancement automatique au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    initialiserAcces();
});
