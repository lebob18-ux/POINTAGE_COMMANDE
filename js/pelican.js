/* ── js/pelican.js ── */
let basePelican = null;

async function loadPelicanData() {
    if (basePelican) return basePelican;
    const response = await fetch('data/pelican.json');
    basePelican = await response.json();
    return basePelican;
}

async function renderPelican() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('pelicanResults');
    
    if (!query) return;

    container.innerHTML = "Chargement et recherche en cours...";
    
    const data = await loadPelicanData();
    
    const results = data.filter(item => 
        item.symbole.toLowerCase().includes(query) || 
        item.intituler.toLowerCase().includes(query)
    ).slice(0, 50);

    if (results.length === 0) {
        container.innerHTML = "Aucun résultat trouvé.";
        return;
    }

    container.innerHTML = results.map(item => `
        <div style="padding: 10px; border-bottom: 1px solid #ccc; display:flex; align-items:center;">
            <img src="image/${item.symbole}.jpg" style="width:50px; height:50px; margin-right:10px;" onerror="this.style.display='none'">
            <div>
                <strong>${item.symbole}</strong><br>
                <small>${item.intituler}</small>
            </div>
        </div>
    `).join('');
}
