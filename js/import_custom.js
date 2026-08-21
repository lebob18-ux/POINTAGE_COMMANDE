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

// --- 5. AFFICHAGE ET INTERACTION ---
function renderCustomList() {
    const query = document.getElementById('searchPelican').value.toLowerCase().trim();
    const container = document.getElementById('customTbody');
    
    if (!customImportData) return;

    const results = query === "" 
        ? customImportData 
        : customImportData.filter(i => String(i.symbole).toLowerCase().includes(query) || String(i.intituler).toLowerCase().includes(query));

    container.innerHTML = results.map(item => `
        <tr onclick="toggleCustomRow(${item.id})" style="background: ${item.checked ? 'rgba(40, 167, 69, 0.08)' : 'transparent'}; cursor: pointer;">
            <td style="text-align: center;" onclick="event.stopPropagation()">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleCustomCheck(${item.id}, this.checked)">
            </td>
            <td style="text-align: center;">
                <img src="image/${item.symbole}.jpg" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'">
            </td>
            <td style="font-weight: bold; font-size: 0.85rem;">${item.symbole}</td>
            <td style="font-size: 0.8rem; color: var(--muted);">${item.plan}</td>
            <td style="font-size: 0.85rem;">${item.intituler} <br><small style="color:var(--muted)">Qté: ${item.qt}</small></td>
            <td onclick="event.stopPropagation()">
                <input type="text" value="${item.observation}" placeholder="Observation..." oninput="updateCustomObs(${item.id}, this.value)" style="width: 90%; padding: 4px; font-size: 0.8rem;">
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
    document.getElementById('customProgBar').style.width = pct + '%';
    document.getElementById('customProgTxt').textContent = `${checked} / ${total} (${pct}%)`;
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
