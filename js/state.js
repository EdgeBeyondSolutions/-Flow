export const state = {
  uid: null,
  tasks: [],
  projects: [],
  contexts: [],
  view: 'inbox',
  boardMode: false,
  search: '',
  selectedProjectId: null,
  calendarCursor: new Date(),
  reviewChecked: new Set(),
  sort: { column: null, dir: 'asc' },
};

const renderListeners = new Set();

export function onStateChange(fn) {
  renderListeners.add(fn);
}

export function notify() {
  renderListeners.forEach((fn) => fn());
}

export function contextById(id) {
  return state.contexts.find((c) => c.id === id);
}

export function projectById(id) {
  return state.projects.find((p) => p.id === id);
}

export function filteredTasks(predicate) {
  const term = state.search.trim().toLowerCase();
  return state.tasks.filter((t) => {
    if (!predicate(t)) return false;
    if (!term) return true;
    return (t.title || '').toLowerCase().includes(term) || (t.notes || '').toLowerCase().includes(term);
  });
}
