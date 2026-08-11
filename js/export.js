/* ── EXPORT ──────────────────────────────────────────────────────────────── */

function dlBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
}

function xmlEsc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */
function exportCSV() {
  if (!activeBL) return;
  const rows = getRowsForBL(activeBL);
  const header = 'N°DM;LIGNE;N°BL;ARTICLE;INTITULE;QUANTITE;VALIDE;OBSERVATION';

  const lines = rows.map(r => {
    const k = rowKey(r);
    return [
      r.dm, r.ligne, r.bl, r.article,
      `"${(r.intitule || '').replace(/"/g, '""')}"`,
      r.quantite,
      state.checks[k] ? 'OUI' : 'NON',
      `"${(state.obs[k] || '').replace(/"/g, '""')}"`,
    ].join(';');
  });

  const content = '\uFEFF' + [header, ...lines].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  dlBlob(blob, `Suivi_BL_${activeBL}.csv`);
  showToast('📄 CSV exporté');
}

/* ── EXCEL (SpreadsheetML) ────────────────────────────────────────────────── */
function exportXLSX() {
  if (!activeBL) return;
  const rows = getRowsForBL(activeBL);
  const { done, total } = blProgress(activeBL);
  const dms = [...new Set(rows.map(r => r.dm))].join(', ');
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const hcell  = v => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
  const scell  = (v, style) => `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`;
  const ncell  = (v, style) => {
    const n = parseFloat(String(v).replace(',','.'));
    return isNaN(n)
      ? scell(v, style)
      : `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="Number">${n}</Data></Cell>`;
  };

  const headers = ['N°DM','LIGNE','N°BL','ARTICLE','INTITULÉ','QUANTITÉ','VALIDÉ','OBSERVATION'];
  let dataRows = `<Row>${headers.map(hcell).join('')}</Row>`;

  rows.forEach(r => {
    const k      = rowKey(r);
    const ok     = !!state.checks[k];
    const style  = ok ? 'ok' : undefined;
    const valide = ok ? 'OUI' : 'NON';
    const obs    = state.obs[k] || '';

    dataRows += `<Row>
      ${scell(r.dm,       style)}
      ${scell(r.ligne,    style)}
      ${scell(r.bl,       style)}
      ${scell(r.article,  style)}
      ${scell(r.intitule, style)}
      ${ncell(r.quantite, style)}
      ${scell(valide,     ok ? 'valide' : style)}
      ${scell(obs,        style)}
    </Row>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Suivi BL ${xmlEsc(activeBL)}</Title>
  <Author>Suivi Commandes SNCF Réseau</Author>
  <Created>${new Date().toISOString()}</Created>
</DocumentProperties>
<Styles>
  <Style ss:ID="hdr">
    <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="9"/>
    <Interior ss:Color="#1F3864" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="ok">
    <Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="valide">
    <Font ss:Bold="1" ss:Color="#276221"/>
    <Interior ss:Color="#C6EFCE" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
</Styles>
<Worksheet ss:Name="Réception ${xmlEsc(activeBL)}">
<Table ss:DefaultColumnWidth="90">
  <Column ss:Width="90"/>
  <Column ss:Width="45"/>
  <Column ss:Width="100"/>
  <Column ss:Width="95"/>
  <Column ss:Width="200"/>
  <Column ss:Width="55"/>
  <Column ss:Width="60"/>
  <Column ss:Width="180"/>
  ${dataRows}
</Table>
</Worksheet>
<Worksheet ss:Name="Récapitulatif">
<Table>
  <Row><Cell><Data ss:Type="String">BL</Data></Cell><Cell><Data ss:Type="String">${xmlEsc(activeBL)}</Data></Cell></Row>
  <Row><Cell><Data ss:Type="String">DM</Data></Cell><Cell><Data ss:Type="String">${xmlEsc(dms)}</Data></Cell></Row>
  <Row><Cell><Data ss:Type="String">Date export</Data></Cell><Cell><Data ss:Type="String">${dateStr}</Data></Cell></Row>
  <Row><Cell><Data ss:Type="String">Articles validés</Data></Cell><Cell><Data ss:Type="Number">${done}</Data></Cell></Row>
  <Row><Cell><Data ss:Type="String">Total articles</Data></Cell><Cell><Data ss:Type="Number">${total}</Data></Cell></Row>
</Table>
</Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  dlBlob(blob, `Suivi_BL_${activeBL}.xls`);
  showToast('📊 Excel exporté');
}

/* ── IMPRESSION / PDF ────────────────────────────────────────────────────── */
function exportPrint() {
  if (!activeBL) return;
  const rows   = getRowsForBL(activeBL);
  const { done, total } = blProgress(activeBL);
  const dms    = [...new Set(rows.map(r => r.dm))].join(', ');
  const dateStr = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });

  const htmlEsc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const trs = rows.map(r => {
    const k      = rowKey(r);
    const ok     = !!state.checks[k];
    const obs    = state.obs[k] || '';
    return `<tr class="${ok ? 'ok' : ''}">
      <td style="text-align:center;font-size:14pt">${ok ? '✔' : '☐'}</td>
      <td>${htmlEsc(r.dm)}</td>
      <td>${htmlEsc(r.ligne)}</td>
      <td style="font-family:monospace;font-size:9pt">${htmlEsc(r.article)}</td>
      <td>${htmlEsc(r.intitule)}</td>
      <td style="text-align:center;font-weight:700">${htmlEsc(r.quantite)}</td>
      <td style="color:#555;font-style:${obs ? 'normal' : 'italic'}">${obs ? htmlEsc(obs) : '—'}</td>
    </tr>`;
  }).join('');

  const pct = total ? Math.round(100 * done / total) : 0;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche Réception — BL ${htmlEsc(activeBL)}</title>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    body  { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; margin: 0; color: #111; }
    .head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 2px solid #1F3864; padding-bottom: 8px; }
    .head-left h1 { font-size: 13pt; margin: 0 0 3px; color: #1F3864; }
    .head-left .meta { font-size: 8.5pt; color: #555; }
    .head-right { text-align: right; font-size: 8.5pt; color: #555; }
    .badge { display: inline-block; padding: 2px 9px; border-radius: 20px; font-size: 8pt; font-weight: 700; }
    .badge-ok  { background: #C6EFCE; color: #276221; }
    .badge-en  { background: #FFEB9C; color: #9C6500; }
    .badge-no  { background: #f0f0f0; color: #555; }
    .progress  { margin: 10px 0; }
    .prog-bar  { height: 6px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }
    .prog-fill { height: 100%; background: #276221; border-radius: 10px; width: ${pct}%; }
    .prog-txt  { font-size: 8pt; color: #555; margin-top: 3px; }
    table      { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    thead th   { background: #1F3864; color: #fff; padding: 5px 7px; text-align: left; font-weight: 700; font-size: 8pt; }
    tbody td   { padding: 5px 7px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
    tr.ok      { background: #f0faf4; }
    tr.ok td:first-child { color: #276221; }
    .footer    { margin-top: 18px; font-size: 7.5pt; color: #aaa; border-top: 1px solid #e0e0e0; padding-top: 6px; display: flex; justify-content: space-between; }
    .sign-zone { margin-top: 22px; display: flex; gap: 30px; }
    .sign-box  { flex: 1; border-top: 1px solid #bbb; padding-top: 4px; font-size: 8pt; color: #555; }
    @media print { .noprint { display: none; } }
  </style>
</head>
<body>

<div class="head">
  <div class="head-left">
    <h1>📦 Fiche de Réception — BL ${htmlEsc(activeBL)}</h1>
    <div class="meta">DM : ${htmlEsc(dms)}</div>
  </div>
  <div class="head-right">
    <div>${dateStr} &nbsp;${timeStr}</div>
    <div style="margin-top:4px">
      <span class="badge ${done===total && total>0 ? 'badge-ok' : done>0 ? 'badge-en' : 'badge-no'}">
        ${done===total && total>0 ? '✔ Réception complète' : done>0 ? 'En cours' : 'À réceptionner'}
      </span>
    </div>
  </div>
</div>

<div class="progress">
  <div class="prog-bar"><div class="prog-fill"></div></div>
  <div class="prog-txt">${done} / ${total} article${total>1?'s':''} validé${done>1?'s':''} (${pct} %)</div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:28px">✔</th>
      <th>N° DM</th>
      <th style="width:36px">Ligne</th>
      <th>Article</th>
      <th>Intitulé</th>
      <th style="width:36px;text-align:center">Qté</th>
      <th>Observation</th>
    </tr>
  </thead>
  <tbody>${trs}</tbody>
</table>

<div class="sign-zone">
  <div class="sign-box">Agent réceptionnaire :<br><br><br></div>
  <div class="sign-box">Signature :<br><br><br></div>
  <div class="sign-box">Visa responsable :<br><br><br></div>
</div>

<div class="footer">
  <span>Suivi Commandes — SNCF Réseau / FBM</span>
  <span>Export : ${dateStr} ${timeStr}</span>
</div>

<script>window.addEventListener('load', () => window.print());<\/script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) { showToast('⚠ Autorisez les popups pour imprimer'); return; }
  w.document.write(html);
  w.document.close();
}
