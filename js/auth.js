/* ── js/auth.js ── */
function checkSNCF() {
    const cp = prompt("Veuillez saisir votre N°CP (7 chiffres + 1 lettre, ex: 1234567A) :");
    if (!cp) return;

    const regex = /^\d{7}[A-Za-z]$/;
    
    if (regex.test(cp.trim())) {
        localStorage.setItem('user_cp', cp.trim().toUpperCase());
        alert("Authentification réussie !");
        
        const adminBtn = document.getElementById('adminTabButton');
        if (adminBtn) adminBtn.style.display = 'inline-block';
        
        if (typeof switchTab === 'function') {
            switchTab('admin');
        }
    } else {
        alert("N°CP invalide. Le format doit être 7 chiffres suivis d'une lettre (ex: 1234567A).");
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
