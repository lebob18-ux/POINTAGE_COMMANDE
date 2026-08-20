/* ── GESTION DE L'IMPORTATION DE LISTES EXTERNES ── */
let customImportData = null;

function handleCustomFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const statusInfo = document.getElementById('importStatusInfo');

    statusInfo.textContent = `Lecture de ${fileName} en cours...`;

    const reader = new FileReader();

    // 1. Fichiers Excel (.xlsx, .xlsm, .xls)
    if (['xlsx', 'xlsm', 'xls'].includes(fileExtension)) {
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                processImportedData(jsonData, fileName);
            } catch (err) {
                console.error(err);
                alert("Erreur de lecture du fichier Excel.");
                statusInfo.textContent = "Erreur d'importation.";
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    // 2. Fichiers texte ou CSV (.csv, .txt avec séparateur ;)
    else if (['csv', 'txt'].includes(fileExtension)) {
        reader.onload = function(e) {
            try {
                const text = e.target.result;
                parseCSVorTXT(text, fileName);
            } catch (err) {
                console.error(err);
                alert("Erreur de lecture du fichier texte.");
                statusInfo.textContent = "Erreur d'importation.";
            }
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        alert("Format non pris en charge.");
        statusInfo.textContent = "";
    }
}

function parseCSVorTXT(text, fileName) {
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return;

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

function processImportedData(dataArray, fileName) {
    if (!dataArray || dataArray.length === 0) {
        alert("Le fichier est vide.");
        return;
    }

    // Normalisation intelligente des colonnes (gère "symbole", "code", "numero", "num", "n°", etc.)
    customImportData = dataArray.map(item => {
        const keys = Object.keys(item);
        const findKey = (keywords) => keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw))) || '';

        return {
            symbole: item[findKey(['symbole', 'code', 'art', 'ref', 'reference', 'numero', 'num', 'n°'])] || item[keys[0]] || '',
            intituler: item[findKey(['intituler', 'libelle', 'designation', 'nom', 'description'])] || item[keys[1]] || '',
            plan: item[findKey(['plan', 'dossier', 'feuillet'])] || 'IMP',
            ensemble: item[findKey(['ensemble', 'cat', 'famille'])] || 'IMPORT',
            qt: item[findKey(['qt', 'quantite', 'qte'])] || '1'
        };
    });

    const statusInfo = document.getElementById('importStatusInfo');
    statusInfo.innerHTML = `✅ Fichier <b>${fileName}</b> chargé avec succès (${customImportData.length} lignes).`;
    
    // Affiche immédiatement la liste importée à l'écran
    renderCustomList();
}

function renderCustomList() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('pelicanResults');
    
    if (!customImportData) {
        container.innerHTML = `<div style="padding: 15px; color: var(--muted); text-align: center;">Aucun fichier importé pour le moment.</div>`;
        return;
    }

    // Filtrage ou affichage global si la recherche est vide
    const results = query === "" 
        ? customImportData.slice(0, 50) 
        : customImportData.filter(item => {
            const s = String(item.symbole || '').toLowerCase();
            const i = String(item.intituler || '').toLowerCase();
            return s.includes(query) || i.includes(query);
          }).slice(0, 50);

    if (results.length === 0) {
        container.innerHTML = `<div style="padding: 15px; color: var(--muted); text-align: center;">Aucun résultat trouvé pour "${query}"</div>`;
        return;
    }

    // Affichage sous forme de liste propre avec miniatures
    container.innerHTML = results.map(item => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--surface2, #1e222d); border: 1px solid var(--border, #2a2f3d); border-radius: var(--radius, 6px); margin-bottom: 6px;">
            <div style="width: 42px; height: 42px; flex-shrink: 0; background: #fff; border-radius: 4px; overflow: hidden; border: 1px solid var(--border);">
                <img src="image/${item.symbole}.jpg" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><rect width=\'100%\' height=\'100%\' fill=\'%23333\'/><text x=\'50%\' y=\'50%\' fill=\'%23aaa\' font-size=\'10\' dominant-baseline=\'middle\' text-anchor=\'middle\'>IMG</text></svg>'">
            </div>
            <div style="flex-grow: 1; min-width: 0;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <span style="font-weight: bold; color: var(--text, #fff); font-size: 0.95rem;">${item.symbole}</span>
                    <span style="font-size: 0.75rem; background: rgba(255,165,0,0.15); color: #ffa500; padding: 2px 6px; border-radius: 4px;">Réf : ${item.plan}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--muted, #aaa); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.intituler}</div>
                <div style="font-size: 0.75rem; color: #666; margin-top: 2px;">Groupe : ${item.ensemble} &nbsp;|&nbsp; Qté : ${item.qt}</div>
            </div>
        </div>
    `).join('');
}
