/**
 * Admin Panel — Render helpers (escHtml, formatDate)
 * 15 lines of admin SPA JS code
 */
export const CODE: string = `
// ===== RENDER =====
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Format date to Armenia timezone (UTC+4)
function formatArmTime(dateStr) {
  if (!dateStr) return '';
  try {
    var d = new Date(dateStr + (dateStr.indexOf('Z') < 0 && dateStr.indexOf('+') < 0 ? 'Z' : ''));
    return d.toLocaleString('ru-RU', { timeZone: 'Asia/Yerevan', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch(e) { return (dateStr || '').substring(0, 16); }
}


`;
