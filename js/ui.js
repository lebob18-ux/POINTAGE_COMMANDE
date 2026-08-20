/* ── js/ui.js ── */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => {
        t.style.display = 'none';
    });
    const target = document.getElementById('tab-' + tabId);
    if (target) {
        target.style.display = 'block';
    }
}
