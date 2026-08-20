/* ── UI.JS ── */
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  document.getElementById('tab-' + tabId).style.display = 'block';
}

function showAdminTab() {
  document.getElementById('adminTabButton').style.display = 'block';
}
