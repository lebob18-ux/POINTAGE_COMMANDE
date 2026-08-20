/* ── js/pelican.js ── */
let basePelican = null;
let customImportData = null; // Stocke la liste importée à la volée

async function loadPelicanData() {
    // Si une liste personnalisée a été importée, on la privilégie ou on l'utilise
    if (customImportData) return customImportData;
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

/**
 * Gère l'importation de fichiers externes (CSV, TXT point-virgule, XLS, XLSX, XLSM)
 */
function handleCustomFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const statusInfo = document.getElementById('importStatusInfo');

    statusInfo.textContent = `Lecture du fichier ${fileName} en cours...`;

    const reader = new FileReader();

    // Si c'est un fichier Excel (.xls, .xlsx, .xlsm)
    if (['xlsx', 'xlsm', 'xls'].includes(fileExtension)) {
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Conversion de la feuille Excel en tableau d'objets JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                processImportedData(jsonData, fileName);
            } catch (err) {
                console.error(err);
                alert("Erreur lors de la lecture du fichier Excel.");
                statusInfo.textContent = "Erreur d'importation.";
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    // Si c'est un fichier Texte ou CSV (.csv, .txt)
    else if (['csv', 'txt'].includes(fileExtension)) {
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                parseCSVorTXT(text, fileName);
            } catch (err) {
                console.error(err);
                alert("Erreur lors de la lecture du fichier texte/CSV.");
                statusInfo.textContent = "Erreur d'importation.";
            }
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        alert("Format de fichier non pris en charge.");
        statusInfo.textContent = "";
    }
}

/**
 * Analyse un texte CSV ou TXT avec séparateur point-virgule (ou tabulation/virgule)
 */
function parseCSVorTXT(text, fileName) {
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return;

    // Détection automatique du séparateur (; ou , ou tabulation)
    const firstLine = lines[0];
    let separator = ';';
    if (firstLine.includes('\t')) separator = '\t';
    else if (firstLine.includes(',')) separator = ',';

    const headers = firstLine.split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));
    const parsedData = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const obj = {};
        headers.forEach((h, index) => {
            obj[h] = values[index] !== undefined ? values[index] : '';
        });
        parsedData.push(obj);
    }

    processImportedData(parsedData, fileName);
}

/**
 * Normalise et injecte les données importées dans la recherche
 */
function processImportedData(dataArray, fileName) {
    if (!dataArray || dataArray.length === 0) {
        alert("Le fichier semble vide.");
        return;
    }

    // Normalisation des clés pour s'adapter à votre affichage (symbole, intituler, plan, ensemble, qt)
    customImportData = dataArray.map(item => {
        // On essaie de mapper intelligemment les colonnes peu importe leur casse
        const keys = Object.keys(item);
        const findKey = (keywords) => keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw))) || '';

        return {
            symbole: item[findKey(['symbole', 'code', 'art', 'ref', 'reference'])] || item[keys[0]] || '',
            intituler: item[findKey(['intituler', 'libelle', 'designation', 'nom', 'description'])] || item[keys[1]] || '',
            plan: item[findKey(['plan', 'dossier', 'feuillet'])] || 'IMP',
            ensemble: item[findKey(['ensemble', 'cat', 'famille'])] || 'IMPORT',
            qt: item[findKey(['qt', 'quantite', 'qte'])] || '1'
        };
    });

    const statusInfo = document.getElementById('importStatusInfo');
    statusInfo.innerHTML = `✅ Fichier <b>${fileName}</b> chargé avec succès (${customImportData.length} lignes disponibles).`;
    
    // Lance un affichage direct ou vide la recherche précédente
    document.getElementById('searchPelican').value = '';
    document.getElementById('pelicanResults').innerHTML = `<div style="padding: 10px; color: var(--muted); text-align: center;">Fichier prêt. Tapez un mot-clé pour lancer la recherche dans ${fileName}.</div>`;
}

async function renderPelican() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('pelicanResults');
    
    if (!query) {
        container.innerHTML = `<div style="padding: 15px; color: var(--muted); text-align: center;">Veuillez saisir un terme de recherche.</div>`;
        return;
    }

    container.innerHTML = `<div style="padding: 15px; color: var(--muted); text-align: center;">Recherche en cours...</div>`;
    
    const data = await loadPelicanData();
    
    // Filtrage optimisé
    const results = data.filter(item => {
        const s = String(item.symbole || '').toLowerCase();
        const i = String(item.intituler || '').toLowerCase();
        const p = String(item.plan || '').toLowerCase();
        return s.includes(query) || i.includes(query) || p.includes(query);
    }).slice(0, 50);

    if (results.length === 0) {
        container.innerHTML = `<div style="padding: 15px; color: var(--muted); text-align: center;">Aucun résultat trouvé pour "${query}"</div>`;
        return;
    }

    // Affichage sous forme de liste type BL avec miniatures
    container.innerHTML = results.map(item => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface2, #1e222d); border: 1px solid var(--border, #2a2f3d); border-radius: var(--radius, 6px); margin-bottom: 6px;">
            <div style="width: 42px; height: 42px; flex-shrink: 0; background: #fff; border-radius: 4px; overflow: hidden; border: 1px solid var(--border);">
                <img src="image/${item.symbole}.jpg" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'100%\' height=\'100%\' fill=\'%23333\'/><text x=\'50%\' y=\'50%\' fill=\'%23aaa\' font-size=\'10\' dominant-baseline=\'middle\' text-anchor=\'middle\'>IMG</text></svg>'">
            </div>
            <div style="flex-grow: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <span style="font-weight: bold; color: var(--text, #fff); font-size: 0.95rem;">${item.symbole}</span>
                    <span style="font-size: 0.75rem; background: rgba(255,165,0,0.15); color: #ffa500; padding: 2px 6px; border-radius: 4px;">Ref: ${item.plan}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--muted, #aaa); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.intituler}</div>
                <div style="font-size: 0.75rem; color: #666; margin-top: 2px;">Groupe : ${item.ensemble} &nbsp;|&nbsp; Qté : ${item.qt}</div>
            </div>
        </div>
    `).join('');
}
