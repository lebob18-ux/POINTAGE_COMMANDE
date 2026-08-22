/* ================= DÉBUT : GESTION IMPORTATION ET SUIVI INTERACTIF ================= */

let customImportData = null;

// --- 1. CHARGEMENT AUTOMATIQUE AU DÉMARRAGE ---
window.addEventListener('load', () => {
    const saved = localStorage.getItem('saved_custom_list');
    if (saved) {
        customImportData = JSON.parse(saved);
        const toolbar = document.getElementById('customToolbar');
        if (toolbar) toolbar.style.display = 'flex';
        renderCustomList();
    }
});

// --- 2. FONCTION DE SAUVEGARDE LOCALE ---
function saveCustomData() {
    if (customImportData) {
        localStorage.setItem('saved_custom_list', JSON.stringify(customImportData));
    }
}

// --- 3. GESTION DU FICHIER (IMPORT) ---
function handleCustomFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const statusInfo = document.getElementById('importStatusInfo');

    statusInfo.textContent = `Lecture de ${fileName}...`;

    const reader = new FileReader();

    if (['xlsx', 'xlsm', 'xls'].includes(fileExtension)) {
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
            processImportedData(jsonData, fileName);
        };
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = function(e) {
            parseCSVorTXT(e.target.result, fileName);
        };
        reader.readAsText(file, 'UTF-8');
    }
}

function parseCSVorTXT(text, fileName) {
    const lines = text.split(/\r\n|\n/);
    const headers = lines[0].split(';').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const parsedData = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(';');
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] ? values[i].trim() : '');
        return obj;
    });
    processImportedData(parsedData, fileName);
}

// --- 4. PRÉPARATION DES DONNÉES ---
function processImportedData(dataArray, fileName) {
    customImportData = dataArray.map((item, index) => {
        const keys = Object.keys(item);
        const findKey = (keywords) => keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw))) || '';

        return {
            id: index,
            symbole: item[findKey(['symbole', 'code', 'art', 'num', 'n°'])] || item[keys[0]] || '',
            intituler: item[findKey(['intituler', 'libelle', 'designation', 'nom'])] || item[keys[1]] || '',
            plan: item[findKey(['plan', 'dossier'])] || 'IMP',
            ensemble: item[findKey(['ensemble', 'famille'])] || 'IMPORT',
            qt: item[findKey(['qt', 'quantite', 'qte'])] || '1',
            checked: false,
            observation: ''
        };
    });

    document.getElementById('importStatusInfo').innerHTML = `✅ Fichier <b>${fileName}</b> chargé.`;
    document.getElementById('customToolbar').style.display = 'flex';
    
    saveCustomData();
    renderCustomList();
}

// --- 5. AFFICHAGE ET INTERACTION (Design BL : Miniature HORIZONTALE 120x90 + Texte empilé) ---
function renderCustomList() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('customTbody');
    
    if (!customImportData) return;

    const results = query === "" 
        ? customImportData 
        : customImportData.filter(i => String(i.symbole).toLowerCase().includes(query) || String(i.intituler).toLowerCase().includes(query));

    container.innerHTML = results.map(item => `
        <tr onclick="toggleCustomRow(${item.id})" style="background: ${item.checked ? 'rgba(40, 167, 69, 0.08)' : 'transparent'}; cursor: pointer;">
            <!-- Case à cocher -->
            <td style="text-align: center; vertical-align: middle;" onclick="event.stopPropagation()">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleCustomCheck(${item.id}, this.checked)">
            </td>
            
            <!-- Miniature au format horizontal 120x90 -->
            <td style="text-align: center; vertical-align: middle; padding: 8px;">
                <div style="width: 120px; height: 90px; background: #fff; border-radius: 6px; overflow: hidden; margin: 0 auto; border: 1px solid var(--border);">
                   
                    
                    <img src="https://raw.githubusercontent.com/lebob18-ux/MIGNATURE_K1/main/${item.symbole}.jpg" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'90\'><rect width=\'100%\' height=\'100%\' fill=\'%23222\'/><text x=\'50%\' y=\'50%\' fill=\'%23777\' font-size=\'11\' dominant-baseline=\'middle\' text-anchor=\'middle\' font-family=\'sans-serif\'>Aucune image</text></svg>'">
                </div>
            </td>
            
            <!-- Informations empilées l'une au-dessus de l'autre -->
            <td colspan="3" style="vertical-align: middle; padding: 10px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: bold; font-size: 1rem; color: var(--text);">${item.symbole}</span>
                        <span style="font-size: 0.75rem; background: var(--border); padding: 2px 6px; border-radius: 4px; color: var(--muted);">Plan : ${item.plan}</span>
                    </div>
                    <div style="font-size: 0.9rem; color: var(--text);">${item.intituler}</div>
                    <div style="font-size: 0.8rem; color: var(--muted);">Qté : <b>${item.qt}</b> &nbsp;|&nbsp; Groupe : ${item.ensemble}</div>
                    
                    <!-- Champ observation intégré proprement en dessous -->
                    <div style="margin-top: 6px;" onclick="event.stopPropagation()">
                        <input type="text" value="${item.observation}" placeholder="Ajouter une observation..." oninput="updateCustomObs(${item.id}, this.value)" style="width: 100%; padding: 6px; font-size: 0.85rem; background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 4px;">
                    </div>
                </div>
            </td>
        </tr>
    `).join('');
    
    updateCustomProgress();
}

function toggleCustomRow(id) {
    const item = customImportData.find(i => i.id === id);
    if (item) {
        item.checked = !item.checked;
        saveCustomData();
        renderCustomList();
    }
}

function toggleCustomCheck(id, isChecked) {
    const item = customImportData.find(i => i.id === id);
    if (item) {
        item.checked = isChecked;
        saveCustomData();
        renderCustomList();
    }
}

function updateCustomObs(id, val) {
    const item = customImportData.find(i => i.id === id);
    if (item) {
        item.observation = val;
        saveCustomData();
    }
}

function updateCustomProgress() {
    const total = customImportData.length;
    const checked = customImportData.filter(i => i.checked).length;
    const pct = total ? Math.round((checked / total) * 100) : 0;
    const bar = document.getElementById('customProgBar');
    const txt = document.getElementById('customProgTxt');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = `${checked} / ${total} (${pct}%)`;
}

// --- 6. EXPORT ---
function exportCustomCsv() {
    let csv = "SYMBOLE;PLAN;INTITULER;STATUT;OBSERVATION\n";
    customImportData.forEach(i => csv += `"${i.symbole}";"${i.plan}";"${i.intituler}";"${i.checked ? 'OK' : '-'}";"${i.observation}"\n`);
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'export_terrain.csv';
    a.click();
}

function exportCustomPdf() {
    window.print();
}

/* ================= FIN : GESTION IMPORTATION ET SUIVI INTERACTIF ================= */
