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
    
    // Afficher l'onglet sélectionné
    if (tabId === 'commandes') {
        document.getElementById('tab-commandes').style.display = 'block';
        event.target.classList.add('active');
    } else if (tabId === 'admin') {
        document.getElementById('tab-admin').style.display = 'block';
        const adminBtn = document.getElementById('adminTabButton');
        if (adminBtn) adminBtn.classList.add('active');
    }
}
