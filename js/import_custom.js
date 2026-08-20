/* ── GESTION DE L'IMPORTATION ET DU SUIVI INTERACTIF (MODE BL) ── */
let customImportData = null;

function handleCustomFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const statusInfo = document.getElementById('importStatusInfo');

    statusInfo.textContent = `Lecture de ${fileName} en cours...`;

    const reader = new FileReader();

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
    } else if (['csv', 'txt'].includes(fileExtension)) {
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

    // Normalisation et ajout des états interactifs (checked, observation) pour chaque ligne
    customImportData = dataArray.map((item, index) => {
        const keys = Object.keys(item);
        const findKey = (keywords) => keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw))) || '';

        return {
            id: index,
            symbole: item[findKey(['symbole', 'code', 'art', 'ref', 'reference', 'numero', 'num', 'n°'])] || item[keys[0]] || '',
            intituler: item[findKey(['intituler', 'libelle', 'designation', 'nom', 'description'])] || item[keys[1]] || '',
            plan: item[findKey(['plan', 'dossier', 'feuillet'])] || 'IMP',
            ensemble: item[findKey(['ensemble', 'cat', 'famille'])] || 'IMPORT',
            qt: item[findKey(['qt', 'quantite', 'qte'])] || '1',
            checked: false,
            observation: ''
        };
    });

    const statusInfo = document.getElementById('importStatusInfo');
    statusInfo.innerHTML = `✅ Fichier <b>${fileName}</b> chargé (${customImportData.length} lignes). Prêt pour le suivi terrain.`;
    
    document.getElementById('customToolbar').style.display = 'flex';
    renderCustomList();
}

function renderCustomList() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('customTbody');
    
    if (!customImportData) return;

    const results = query === "" 
        ? customImportData 
        : customImportData.filter(item => {
            const s = String(item.symbole || '').toLowerCase();
            const i = String(item.intituler || '').toLowerCase();
            return s.includes(query) || i.includes(query);
          });

    if (results.length === 0) {
        container.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--muted);">Aucun résultat trouvé.</td></tr>`;
        return;
    }

    // Affichage sous forme de tableau interactif (identique aux BL)
    container.innerHTML = results.map(item => `
        <tr style="background: ${item.checked ? 'rgba(40, 167, 69, 0.08)' : 'transparent'};">
            <td style="text-align: center;">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleCustomCheck(${item.id}, this.checked)">
            </td>
            <td style="text-align: center;">
                <div style="width: 36px; height: 36px; background: #fff; border-radius: 4px; overflow: hidden; margin: 0 auto; border: 1px solid var(--border);">
                    <img src="image/${item.symbole}.jpg" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'30\' height=\'30\'><rect width=\'100%\' height=\'100%\' fill=\'%23333\'/><text x=\'50%\' y=\'50%\' fill=\'%23aaa\' font-size=\'8\' dominant-baseline=\'middle\' text-anchor=\'middle\'></text></svg>'">
                </div>
            </td>
            <td style="font-weight: bold; font-size: 0.85rem;">${item.symbole}</td>
            <td style="font-size: 0.8rem; color: var(--muted);">${item.plan}</td>
            <td style="font-size: 0.85rem;">
                <div>${item.intituler}</div>
                <div style="font-size: 0.75rem; color: var(--muted);">Qté: ${item.qt} | Groupe: ${item.ensemble}</div>
            </td>
            <td>
                <input type="text" value="${item.observation}" placeholder="Ajouter une observation..." oninput="updateCustomObs(${item.id}, this.value)" style="width: 100%; padding: 6px; font-size: 0.8rem; background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 4px;">
            </td>
        </tr>
    `).join('');
    
    updateCustomProgress();
}

function toggleCustomCheck(id, isChecked) {
    const item = customImportData.find(i => i.id === id);
    if (item) {
        item.checked = isChecked;
        renderCustomList();
    }
}

function updateCustomObs(id, val) {
    const item = customImportData.find(i => i.id === id);
    if (item) {
        item.observation = val;
    }
}

function updateCustomProgress() {
    if (!customImportData || customImportData.length === 0) return;
    const checkedCount = customImportData.filter(i => i.checked).length;
    const percent = Math.round((checkedCount / customImportData.length) * 100);
    
    const bar = document.getElementById('customProgBar');
    const txt = document.getElementById('customProgTxt');
    if (bar) bar.style.width = percent + '%';
    if (txt) txt.textContent = `${checkedCount} / ${customImportData.length} (${percent}%)`;
}

// Fonctions d'export pour la liste importée
function exportCustomPdf() {
    window.print();
}

function exportCustomCsv() {
    if (!customImportData) return;
    let csv = "SYMBOLE;PLAN;INTITULER;ENSEMBLE;QT;STATUT;OBSERVATION\n";
    customImportData.forEach(i => {
        csv += `"${i.symbole}";"${i.plan}";"${i.intituler}";"${i.ensemble}";"${i.qt}";"${i.checked ? 'VALIDÉ' : 'EN COURS'}";"${i.observation}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suivi_import_terrain.csv';
    a.click();
}
