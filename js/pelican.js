/* ── js/pelican.js ── */
let basePelican = null;

async function loadPelicanData() {
    if (basePelican) return basePelican;
    try {
        const response = await fetch('data/pelican.json');
        basePelican = await response.json();
        return basePelican;
    } catch (e) {
        console.error("Erreur de chargement de la base PELICAN :", e);
        return [];
    }
}

async function renderPelican() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('pelicanResults');
    
    if (!query) {
        container.innerHTML = "<div>Veuillez saisir un terme de recherche.</div>";
        return;
    }

    container.innerHTML = "<div>Recherche en cours dans la base...</div>";
    
    const data = await loadPelicanData();
    
    const results = data.filter(item => 
        (item.symbole && item.symbole.toLowerCase().includes(query)) || 
        (item.intituler && item.intituler.toLowerCase().includes(query))
    ).slice(0, 50);

    if (results.length === 0) {
        container.innerHTML = "<div>Aucun résultat trouvé.</div>";
        return;
    }

    container.innerHTML = results.map(item => `
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-bottom: 1px solid #ddd; background: #fff; border-radius: 4px; margin-bottom: 5px;">
            <img src="image/${item.symbole}.jpg" style="width: 50px; height: 50px; object-fit: cover;" onerror="this.style.display='none'">
            <div>
                <div style="font-weight: bold;">${item.symbole}</div>
                <div style="font-size: 0.85rem; color: #555;">${item.intituler}</div>
                <div style="font-size: 0.75rem; color: #888;">Ensemble: ${item.ensemble} | Plan: ${item.plan} | Qté: ${item.qt}</div>
            </div>
        </div>
    `).join('');
}
