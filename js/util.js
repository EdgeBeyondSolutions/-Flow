export function escapeHtml(str = '') {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function todayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return isoFromDate(d);
}

export function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isOverdue(dueISO) {
  if (!dueISO) return false;
  return dueISO < todayISO();
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Always renders as DD-Mon-YYYY (e.g. "13-Jun-2026") everywhere in the UI,
// regardless of browser locale, so day/month order is never ambiguous.
export function formatDue(dueISO) {
  if (!dueISO) return '';
  const [y, m, d] = dueISO.split('-').map(Number);
  return `${String(d).padStart(2, '0')}-${MONTH_ABBR[m - 1]}-${y}`;
}

export function priorityLabel(p) {
  return { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }[p] || 'Medium';
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
