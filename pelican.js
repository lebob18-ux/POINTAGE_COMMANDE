/* ── PELICAN.JS ── */
let basePelican = [];

async function loadBasePelican() {
  if (basePelican.length > 0) return;
  const resp = await fetch('data/pelican.csv');
  const raw = await resp.text();
  basePelican = parseCSV(raw); // Assurez-vous que parseCSV est accessible
}

async function renderPelican() {
  await loadBasePelican();
  const query = document.getElementById('searchPelican').value.toLowerCase().trim();
  const container = document.getElementById('pelicanResults');
  
  if (!query) return;
  container.innerHTML = '<div>Recherche en cours...</div>';

  setTimeout(() => {
    const results = basePelican.filter(item => 
      item.symbole.toLowerCase().includes(query) || 
      item.intitule.toLowerCase().includes(query)
    ).slice(0, 50);

    container.innerHTML = results.map(item => `
      <div class="pelican-item">
        <img src="image/${item.symbole}.jpg" onerror="this.style.display='none'">
        <span>${item.symbole} - ${item.intitule}</span>
      </div>
    `).join('');
  }, 100);
}
