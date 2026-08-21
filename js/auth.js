/* ── js/auth.js ── */
function checkSNCF() {
    // Vérifier si un code est déjà mémorisé
    const savedCode = localStorage.getItem('sncf_auth_code');
    
    if (savedCode) {
        // Si code présent, on affiche directement l'onglet admin
        switchTab('admin');
        return;
    }

    // Sinon, on demande le code
    const code = prompt("Veuillez saisir votre identifiant SNCF (7 chiffres + 1 lettre) :");
    if (code && code.length >= 8) {
        localStorage.setItem('sncf_auth_code', code); // Mémorisation définitive
        switchTab('admin');
    } else {
        alert("Code invalide.");
    }
}

// Vérification au chargement si un N°CP valide est déjà mémorisé
window.addEventListener('DOMContentLoaded', () => {
    const savedCp = localStorage.getItem('user_cp');
    if (savedCp && /^\d{7}[A-Z]$/.test(savedCp)) {
        const adminBtn = document.getElementById('adminTabButton');
        if (adminBtn) adminBtn.style.display = 'inline-block';
    }
});
