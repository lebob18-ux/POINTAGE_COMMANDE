/* ── AUTH.JS ── */
function checkSNCF() {
  const cp = prompt("Veuillez saisir votre N°CP (7 chiffres + 1 lettre, ex: 1234567A):");
  // Regex : 7 chiffres (\d{7}) suivis d'une lettre ([A-Za-z])
  const regex = /^\d{7}[A-Za-z]$/;
  
  if (cp && regex.test(cp)) {
    localStorage.setItem('user_cp', cp);
    alert("Authentification réussie !");
    showAdminTab(); // Fonction à définir dans ui.js
  } else {
    alert("N°CP invalide. Accès refusé.");
  }
}
