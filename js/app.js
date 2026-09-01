import {
  auth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
} from './firebase.js';
import {
  setUid, seedDefaultsIfNeeded, subscribeTasks, subscribeProjects, subscribeContexts,
  createTask, updateTask, deleteTask, createProject, updateProject, createContext,
  subscribeCalendarSettings, updateCalendarSettings,
} from './store.js';
import * as gcal from './gcal.js';
import { state, notify, onStateChange } from './state.js';
import { renderInbox, renderToday, renderScheduled, renderNextList, renderNextBoard, renderWaiting, renderSomeday, renderDone } from './views/lists.js';
import { renderProjectsGrid, renderProjectDetail } from './views/projects.js';
import { renderCalendar } from './views/calendar.js';
import { renderReview } from './views/review.js';
import { escapeHtml, autoResize, todayISO } from './util.js';

// ───────────────────────── Theme ─────────────────────────
const THEME_KEY = 'flow-theme';
function applyTheme(t) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.getElementById('theme-toggle').textContent = resolvedIsDark() ? '☀️' : '🌙';
}
function resolvedIsDark() {
  const t = localStorage.getItem(THEME_KEY) || 'system';
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
applyTheme(localStorage.getItem(THEME_KEY) || 'system');
document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = resolvedIsDark() ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ───────────────────────── Sidebar collapse ─────────────────────────
const SIDEBAR_COLLAPSED_KEY = 'flow-sidebar-collapsed';
function applySidebarCollapsed(collapsed) {
  document.getElementById('app').classList.toggle('sidebar-collapsed', collapsed);
  document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
  const btn = document.getElementById('sidebar-collapse-toggle');
  btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
}
applySidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
document.getElementById('sidebar-collapse-toggle').addEventListener('click', () => {
  const collapsed = !document.getElementById('sidebar').classList.contains('collapsed');
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  applySidebarCollapsed(collapsed);
});

// ───────────────────────── Auth ─────────────────────────
const authScreen = document.getElementById('auth-screen');
const appEl = document.getElementById('app');
const authForm = document.getElementById('auth-form');
const authError = document.getElementById('auth-error');
const authLoading = document.getElementById('auth-loading');
const authSubmit = document.getElementById('auth-submit');
const authToggle = document.getElementById('auth-toggle-mode');
let authMode = 'signin';
let unsubscribers = [];

authToggle.addEventListener('click', () => {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  authSubmit.textContent = authMode === 'signin' ? 'Sign in' : 'Create account';
  authToggle.textContent = authMode === 'signin' ? 'First time here? Create an account' : 'Already have an account? Sign in';
  authError.hidden = true;
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.hidden = true;
  authLoading.hidden = false;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  try {
    if (authMode === 'signin') await signInWithEmailAndPassword(auth, email, password);
    else await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    authError.textContent = translateAuthError(err.code);
    authError.hidden = false;
  } finally {
    authLoading.hidden = true;
  }
});

function translateAuthError(code) {
  const map = {
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/user-not-found': 'No account exists with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  if (user) {
    authScreen.hidden = true;
    appEl.hidden = false;
    setUid(user.uid);
    boot();
  } else {
    appEl.hidden = true;
    authScreen.hidden = false;
    state.tasks = []; state.projects = []; state.contexts = [];
  }
});

function boot() {
  let contextsLoaded = false;
  unsubscribers.push(subscribeTasks((tasks) => { state.tasks = tasks; render(); }));
  unsubscribers.push(subscribeProjects((projects) => { state.projects = projects; render(); }));
  unsubscribers.push(subscribeContexts(async (contexts) => {
    state.contexts = contexts;
    if (!contextsLoaded) {
      contextsLoaded = true;
      await seedDefaultsIfNeeded(contexts);
    }
    render();
  }));
  unsubscribers.push(subscribeCalendarSettings((settings) => {
    state.gcalSettings = settings;
    render();
  }));

  // Google's OAuth model has no way to restore a session silently and
  // reliably across a page reload without a backend (which would need the
  // paid Blaze plan). So we never auto-reconnect on boot — that used to
  // pop an unprompted Google sign-in window on every refresh. Instead the
  // user reconnects explicitly via "Manage calendars" when they want
  // Google events synced again.
}

// ───────────────────────── Navigation ─────────────────────────
const viewTitles = {
  inbox: 'Inbox', today: 'Today', scheduled: 'Scheduled', next: 'Next actions', projects: 'Projects', waiting: 'Waiting for',
  calendar: 'Calendar', someday: 'Someday / Maybe', review: 'Weekly review', done: 'Done',
};

document.getElementById('main-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  state.view = btn.dataset.view;
  state.selectedProjectId = null;
  closeMobileNav();
  render();
});

document.getElementById('view-switch').addEventListener('click', (e) => {
  const btn = e.target.closest('.switch-btn');
  if (!btn) return;
  state.boardMode = btn.dataset.mode === 'board';
  render();
});

document.getElementById('search-input').addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});

const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobile-nav-overlay');
document.getElementById('mobile-nav-toggle').addEventListener('click', () => {
  sidebar.classList.add('open');
  mobileOverlay.hidden = false;
});
mobileOverlay.addEventListener('click', closeMobileNav);
function closeMobileNav() { sidebar.classList.remove('open'); mobileOverlay.hidden = true; }

// ───────────────────────── Render ─────────────────────────
function render() {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  document.getElementById('view-title').textContent = state.view === 'projects' && state.selectedProjectId
    ? '' : viewTitles[state.view];

  const today = todayISO();
  document.getElementById('count-inbox').textContent = state.tasks.filter((t) => t.status === 'inbox').length;
  document.getElementById('count-today').textContent = state.tasks.filter((t) => t.status === 'scheduled' && t.due && t.due <= today).length;
  document.getElementById('count-scheduled').textContent = state.tasks.filter((t) => t.status === 'scheduled').length;
  document.getElementById('count-next').textContent = state.tasks.filter((t) => t.status === 'next').length;
  document.getElementById('count-waiting').textContent = state.tasks.filter((t) => t.status === 'waiting').length;
  document.getElementById('count-someday').textContent = state.tasks.filter((t) => t.status === 'someday').length;
  document.getElementById('count-projects').textContent = state.projects.length;

  renderContextNav();
  renderTaskFormOptions();

  const viewSwitch = document.getElementById('view-switch');
  viewSwitch.hidden = state.view !== 'next';
  document.querySelectorAll('.switch-btn').forEach((b) => b.classList.toggle('active', (b.dataset.mode === 'board') === state.boardMode));

  const body = document.getElementById('view-body');
  switch (state.view) {
    case 'inbox': body.innerHTML = renderInbox(); break;
    case 'today': body.innerHTML = renderToday(); break;
    case 'scheduled': body.innerHTML = renderScheduled(); break;
    case 'next': body.innerHTML = state.boardMode ? renderNextBoard() : renderNextList(); break;
    case 'projects':
      body.innerHTML = state.selectedProjectId ? renderProjectDetail(state.selectedProjectId) : renderProjectsGrid();
      break;
    case 'waiting': body.innerHTML = renderWaiting(); break;
    case 'calendar': body.innerHTML = renderCalendar(); break;
    case 'someday': body.innerHTML = renderSomeday(); break;
    case 'review': body.innerHTML = renderReview(); break;
    case 'done': body.innerHTML = renderDone(); break;
  }

  if (state.boardMode && state.view === 'next') attachDragAndDrop();
  const calendarKey = state.view === 'calendar' ? `calendar:${state.calendarViewMode}` : state.view;
  if (state.view === 'calendar' && state.calendarViewMode !== 'month' && calendarKey !== lastRenderedKey) {
    const scroller = document.getElementById('timegrid-scroll');
    if (scroller) scroller.scrollTop = 7 * 48;
  }
  lastRenderedKey = calendarKey;
}
let lastRenderedKey = null;
onStateChange(render);

function renderContextNav() {
  const el = document.getElementById('context-list');
  el.innerHTML = state.contexts.map((c) => `
    <button class="context-pill-nav" data-action="go-context-board" data-id="${c.id}" title="${escapeHtml(c.name)}">
      <span class="context-dot" style="background:${c.color}"></span><span class="nav-label">${escapeHtml(c.name)}</span>
    </button>
  `).join('') + `<button class="context-add-btn nav-label" data-action="open-context-modal">+ New context</button>`;
}

function renderTaskFormOptions() {
  const ctxSelect = document.getElementById('task-context');
  const current = ctxSelect.value;
  ctxSelect.innerHTML = '<option value="">— No context —</option>' +
    state.contexts.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  ctxSelect.value = current;

  const projSelect = document.getElementById('task-project');
  const currentProj = projSelect.value;
  projSelect.innerHTML = '<option value="">— None —</option>' +
    state.projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  projSelect.value = currentProj;

  const gcalSelect = document.getElementById('task-gcal-calendar');
  const currentGcal = gcalSelect.value;
  const syncedCals = state.gcalCalendars.filter((c) => state.gcalSettings.syncedCalendarIds.includes(c.id));
  gcalSelect.innerHTML = '<option value="">— Don\'t sync —</option>' +
    syncedCals.map((c) => `<option value="${c.id}">${escapeHtml(c.summary)}</option>`).join('');
  gcalSelect.value = currentGcal;
}

// ───────────────────────── Body click delegation ─────────────────────────
document.getElementById('view-body').addEventListener('click', (e) => {
  const toggleGroup = e.target.closest('[data-action="toggle-group"]');
  if (toggleGroup) { toggleGroup.closest('.task-table').classList.toggle('collapsed'); return; }

  const sortCol = e.target.closest('[data-action="sort-column"]');
  if (sortCol) {
    const col = sortCol.dataset.column;
    if (state.sort.column === col) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
    else { state.sort.column = col; state.sort.dir = 'asc'; }
    render();
    return;
  }

  const toggle = e.target.closest('[data-action="toggle-done"]');
  if (toggle) {
    const task = state.tasks.find((t) => t.id === toggle.dataset.id);
    if (task) toggleDone(task);
    return;
  }
  const open = e.target.closest('[data-action="open"]');
  if (open) { openTaskDrawer(open.dataset.id); return; }

  const openProject = e.target.closest('[data-action="open-project"]');
  if (openProject) { state.selectedProjectId = openProject.dataset.id; render(); return; }

  const backProjects = e.target.closest('[data-action="back-to-projects"]');
  if (backProjects) { state.selectedProjectId = null; render(); return; }

  const newProject = e.target.closest('[data-action="new-project"]');
  if (newProject) { openProjectModal(); return; }

  const editProject = e.target.closest('[data-action="edit-project"]');
  if (editProject) { openProjectModal(state.projects.find((p) => p.id === editProject.dataset.id)); return; }

  const addTaskToProject = e.target.closest('[data-action="add-task-to-project"]');
  if (addTaskToProject) { openTaskDrawer(null, { projectId: addTaskToProject.dataset.id, status: 'next' }); return; }

  const addOnDate = e.target.closest('[data-action="add-task-on-date"]');
  if (addOnDate) {
    const hour = addOnDate.dataset.hour;
    const dueTime = hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : '';
    openTaskDrawer(null, { status: 'scheduled', due: addOnDate.dataset.date, dueTime });
    return;
  }

  const calPrev = e.target.closest('[data-action="cal-prev"]');
  if (calPrev) { stepCalendar(-1); render(); refreshGcalEvents(); return; }
  const calNext = e.target.closest('[data-action="cal-next"]');
  if (calNext) { stepCalendar(1); render(); refreshGcalEvents(); return; }
  const calToday = e.target.closest('[data-action="cal-today"]');
  if (calToday) { state.calendarCursor = new Date(); render(); refreshGcalEvents(); return; }

  const openGcalModal = e.target.closest('[data-action="open-gcal-modal"]');
  if (openGcalModal) { openGcalSettingsModal(); return; }
});

document.getElementById('view-body').addEventListener('change', (e) => {
  const check = e.target.closest('[data-action="review-check"]');
  if (check) {
    if (check.checked) state.reviewChecked.add(check.dataset.id);
    else state.reviewChecked.delete(check.dataset.id);
    render();
    return;
  }
  const viewSelect = e.target.closest('[data-action="cal-view-select"]');
  if (viewSelect) {
    state.calendarViewMode = viewSelect.value;
    render();
    refreshGcalEvents();
  }
});

document.getElementById('context-list').addEventListener('click', (e) => {
  if (e.target.closest('[data-action="open-context-modal"]')) { openContextModal(); return; }
  const pill = e.target.closest('[data-action="go-context-board"]');
  if (pill) {
    state.view = 'next';
    state.boardMode = true;
    state.selectedProjectId = null;
    closeMobileNav();
    render();
    setTimeout(() => {
      const col = document.querySelector(`.board-column-body[data-context="${pill.dataset.id}"]`);
      col?.closest('.board-column')?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }, 30);
  }
});

async function toggleDone(task) {
  const done = task.status !== 'done';
  await updateTask(task.id, { status: done ? 'done' : 'next', completedAt: done ? new Date() : null });
  showToast(done ? 'Task completed ✓' : 'Marked as pending');
}

// ───────────────────────── Task drawer ─────────────────────────
const drawer = document.getElementById('task-drawer');
const taskForm = document.getElementById('task-form');
const titleInput = document.getElementById('task-title');
const MAX_ATTACHMENT_BYTES = 700 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 900 * 1024;
let pendingAttachments = [];

function openTaskDrawer(id, defaults = {}) {
  taskForm.reset();
  document.getElementById('task-id').value = id || '';
  if (id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    titleInput.value = t.title || '';
    document.getElementById('task-status').value = t.status || 'inbox';
    document.getElementById('task-context').value = t.context || '';
    document.getElementById('task-project').value = t.projectId || '';
    document.getElementById('task-priority').value = t.priority || 'medium';
    document.getElementById('task-due').value = t.due || '';
    document.getElementById('task-time').value = t.dueTime || '';
    document.getElementById('task-duration').value = t.durationMinutes || 30;
    document.getElementById('task-waiting-on').value = t.waitingOn || '';
    document.getElementById('task-url').value = t.url || '';
    document.getElementById('task-notes').value = t.notes || '';
    document.getElementById('task-delete').hidden = false;
    pendingAttachments = Array.isArray(t.attachments) ? [...t.attachments] : [];
    renderTaskFormOptions();
    document.getElementById('task-gcal-calendar').value = t.gcalCalendarId || '';
  } else {
    document.getElementById('task-status').value = defaults.status || 'inbox';
    document.getElementById('task-project').value = defaults.projectId || '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-due').value = defaults.due || '';
    document.getElementById('task-time').value = defaults.dueTime || '';
    document.getElementById('task-duration').value = 30;
    document.getElementById('task-delete').hidden = true;
    pendingAttachments = [];
    renderTaskFormOptions();
    document.getElementById('task-gcal-calendar').value = state.gcalSettings.writeCalendarId || '';
  }
  renderAttachmentList();
  toggleConditionalFields();
  drawer.hidden = false;
  setTimeout(() => { titleInput.focus(); autoResize(titleInput); }, 30);
}

function fileIcon(type) {
  if (type.startsWith('image/')) return '🖼';
  if (type === 'application/pdf') return '📄';
  return '📎';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return Math.round(bytes / 1024) + ' KB';
}

function renderAttachmentList() {
  const el = document.getElementById('attachment-list');
  el.innerHTML = pendingAttachments.map((a, i) => `
    <div class="attachment-item">
      ${a.type.startsWith('image/')
        ? `<img class="attachment-thumb" src="${a.data}" alt="" />`
        : `<div class="attachment-thumb">${fileIcon(a.type)}</div>`}
      <div class="attachment-info">
        <div class="attachment-name">${escapeHtml(a.name)}</div>
        <div class="attachment-size">${formatBytes(a.size)}</div>
      </div>
      <div class="attachment-actions">
        <a class="icon-btn" href="${a.data}" download="${escapeHtml(a.name)}" title="Download">⬇</a>
        <button type="button" class="icon-btn" data-action="remove-attachment" data-index="${i}" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('attach-file-btn').addEventListener('click', () => {
  document.getElementById('task-file-input').click();
});

document.getElementById('task-file-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  e.target.value = '';
  const statusEl = document.getElementById('attachment-upload-status');
  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      showToast(`${file.name} is too large (max ~${Math.round(MAX_ATTACHMENT_BYTES / 1024)}KB)`);
      continue;
    }
    const currentTotal = pendingAttachments.reduce((sum, a) => sum + a.size, 0);
    if (currentTotal + file.size > MAX_TOTAL_ATTACHMENT_BYTES) {
      showToast('Attachment size limit reached for this task');
      break;
    }
    statusEl.hidden = false;
    statusEl.textContent = `Reading ${file.name}…`;
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    pendingAttachments.push({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data });
  }
  statusEl.hidden = true;
  renderAttachmentList();
});

document.getElementById('attachment-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="remove-attachment"]');
  if (!btn) return;
  pendingAttachments.splice(Number(btn.dataset.index), 1);
  renderAttachmentList();
});

function closeDrawer() { drawer.hidden = true; }
document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
document.getElementById('task-cancel').addEventListener('click', closeDrawer);
titleInput.addEventListener('input', () => autoResize(titleInput));

document.getElementById('task-status').addEventListener('change', toggleConditionalFields);
function toggleConditionalFields() {
  const status = document.getElementById('task-status').value;
  document.getElementById('project-field-row').hidden = status === 'inbox';
  const scheduled = status === 'scheduled';
  document.getElementById('time-field-row').hidden = !scheduled;
  document.getElementById('duration-field-row').hidden = !scheduled;
  document.getElementById('gcal-field-row').hidden = !scheduled || !state.gcalConnected;
}

function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findConflicts(taskId, due, dueTime, durationMinutes) {
  if (!due || !dueTime) return [];
  const start = new Date(`${due}T${dueTime}:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const conflicts = [];

  state.tasks.forEach((t) => {
    if (t.id === taskId || t.status !== 'scheduled' || t.due !== due || !t.dueTime) return;
    const tStart = new Date(`${t.due}T${t.dueTime}:00`);
    const tEnd = new Date(tStart.getTime() + (t.durationMinutes || 30) * 60000);
    if (timeRangesOverlap(start, end, tStart, tEnd)) conflicts.push(t.title);
  });

  (state.gcalEventsByDate[due] || []).forEach((ev) => {
    const evStart = ev.start?.dateTime ? new Date(ev.start.dateTime) : null;
    const evEnd = ev.end?.dateTime ? new Date(ev.end.dateTime) : null;
    if (evStart && evEnd && timeRangesOverlap(start, end, evStart, evEnd)) conflicts.push(ev.summary || '(no title)');
  });

  return conflicts;
}

async function syncTaskToGoogleCalendar(taskId, data, previous) {
  const wantsSync = data.status === 'scheduled' && data.dueTime && data.gcalCalendarId;
  const hadEvent = previous?.gcalEventId && previous?.gcalCalendarId;

  if (!wantsSync) {
    if (hadEvent) await gcal.deleteEvent(previous.gcalCalendarId, previous.gcalEventId);
    return { gcalEventId: '', gcalCalendarId: '' };
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startDate = new Date(`${data.due}T${data.dueTime}:00`);
  const endDate = new Date(startDate.getTime() + data.durationMinutes * 60000);
  const event = {
    summary: data.title,
    description: data.notes || '',
    start: { dateTime: startDate.toISOString(), timeZone: tz },
    end: { dateTime: endDate.toISOString(), timeZone: tz },
  };

  if (hadEvent && previous.gcalCalendarId === data.gcalCalendarId) {
    await gcal.updateEvent(data.gcalCalendarId, previous.gcalEventId, event);
    return { gcalEventId: previous.gcalEventId, gcalCalendarId: data.gcalCalendarId };
  }
  if (hadEvent) await gcal.deleteEvent(previous.gcalCalendarId, previous.gcalEventId);
  const created = await gcal.createEvent(data.gcalCalendarId, event);
  return { gcalEventId: created.id, gcalCalendarId: data.gcalCalendarId };
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const status = document.getElementById('task-status').value;
  const dueTime = status === 'scheduled' ? document.getElementById('task-time').value : '';
  const durationMinutes = Number(document.getElementById('task-duration').value) || 30;
  const data = {
    title: titleInput.value.trim(),
    status,
    context: document.getElementById('task-context').value,
    projectId: status === 'inbox' ? '' : document.getElementById('task-project').value,
    priority: document.getElementById('task-priority').value,
    due: document.getElementById('task-due').value,
    dueTime,
    durationMinutes,
    waitingOn: document.getElementById('task-waiting-on').value.trim(),
    url: document.getElementById('task-url').value.trim(),
    notes: document.getElementById('task-notes').value,
    attachments: pendingAttachments,
    gcalCalendarId: status === 'scheduled' ? document.getElementById('task-gcal-calendar').value : '',
  };
  if (!data.title) return;
  if (status === 'done') data.completedAt = new Date();

  if (dueTime) {
    const conflicts = findConflicts(id, data.due, dueTime, durationMinutes);
    if (conflicts.length && !confirm(`This overlaps with: ${conflicts.join(', ')}. Save anyway?`)) return;
  }

  const previous = id ? state.tasks.find((t) => t.id === id) : null;

  try {
    const gcalResult = await syncTaskToGoogleCalendar(id, data, previous);
    Object.assign(data, gcalResult);
  } catch (err) {
    showToast('Google Calendar sync failed — saved locally only');
  }

  if (id) await updateTask(id, data);
  else await createTask(data);
  closeDrawer();
  showToast('Saved');
});

document.getElementById('task-delete').addEventListener('click', async () => {
  const id = document.getElementById('task-id').value;
  if (!id) return;
  if (!confirm('Delete this task? This cannot be undone.')) return;
  const t = state.tasks.find((x) => x.id === id);
  if (t?.gcalEventId && t?.gcalCalendarId) await gcal.deleteEvent(t.gcalCalendarId, t.gcalEventId);
  await deleteTask(id);
  closeDrawer();
  showToast('Task deleted');
});

// ───────────────────────── Project modal ─────────────────────────
const projectModal = document.getElementById('project-modal');
function openProjectModal(project) {
  document.getElementById('project-form').reset();
  document.getElementById('project-id').value = project?.id || '';
  document.getElementById('project-name').value = project?.name || '';
  document.getElementById('project-outcome').value = project?.outcome || '';
  document.getElementById('project-modal').querySelector('h2').textContent = project ? 'Edit project' : 'New project';
  projectModal.hidden = false;
  setTimeout(() => document.getElementById('project-name').focus(), 30);
}
function closeProjectModal() { projectModal.hidden = true; }
document.getElementById('project-modal-backdrop').addEventListener('click', closeProjectModal);
document.getElementById('project-cancel').addEventListener('click', closeProjectModal);
document.getElementById('project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('project-id').value;
  const data = {
    name: document.getElementById('project-name').value.trim(),
    outcome: document.getElementById('project-outcome').value.trim(),
  };
  if (!data.name) return;
  if (id) await updateProject(id, data);
  else await createProject(data);
  closeProjectModal();
  showToast('Project saved');
});

// ───────────────────────── Context modal ─────────────────────────
const contextModal = document.getElementById('context-modal');
const PALETTE = ['#0E8A6D', '#5B3FE0', '#C77D14', '#C6402C', '#6B6FA8', '#0E7490', '#BE185D', '#4D7C0F'];
let selectedColor = PALETTE[0];
function openContextModal() {
  document.getElementById('context-form').reset();
  selectedColor = PALETTE[0];
  const sw = document.getElementById('color-swatches');
  sw.innerHTML = PALETTE.map((c) => `<div class="color-swatch ${c === selectedColor ? 'selected' : ''}" style="background:${c}" data-color="${c}"></div>`).join('');
  contextModal.hidden = false;
  setTimeout(() => document.getElementById('context-name').focus(), 30);
}
function closeContextModal() { contextModal.hidden = true; }
document.getElementById('context-modal-backdrop').addEventListener('click', closeContextModal);
document.getElementById('context-cancel').addEventListener('click', closeContextModal);
document.getElementById('color-swatches').addEventListener('click', (e) => {
  const sw = e.target.closest('.color-swatch');
  if (!sw) return;
  selectedColor = sw.dataset.color;
  document.querySelectorAll('.color-swatch').forEach((s) => s.classList.toggle('selected', s === sw));
});
document.getElementById('context-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('context-name').value.trim();
  if (!name) return;
  await createContext({ name, color: selectedColor, order: state.contexts.length });
  closeContextModal();
  showToast('Context created');
});

// ───────────────────────── Quick capture ─────────────────────────
const captureModal = document.getElementById('capture-modal');
const captureInput = document.getElementById('capture-input');
const captureStatus = document.getElementById('capture-status');
function openCapture() {
  captureInput.value = '';
  captureStatus.value = 'inbox';
  captureModal.hidden = false;
  setTimeout(() => captureInput.focus(), 30);
}
function closeCapture() { captureModal.hidden = true; }
document.getElementById('capture-btn').addEventListener('click', openCapture);
document.getElementById('capture-modal-backdrop').addEventListener('click', closeCapture);
document.getElementById('capture-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = captureInput.value.trim();
  if (!title) { closeCapture(); return; }
  const status = captureStatus.value;
  await createTask({ title, status });
  showToast(status === 'inbox' ? 'Captured to Inbox' : `Captured to ${viewTitles[status] || status}`);
  captureInput.value = '';
  captureInput.focus();
});

// ───────────────────────── Keyboard shortcuts ─────────────────────────
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') {
    closeDrawer(); closeProjectModal(); closeContextModal(); closeCapture(); closeMobileNav(); closeGcalModal();
    return;
  }
  if (typing) return;
  if (e.key === 'c' || e.key === 'C') { e.preventDefault(); openCapture(); }
  if (e.key === '/') { e.preventDefault(); document.getElementById('search-input').focus(); }
});

// ───────────────────────── Drag & drop (board mode) ─────────────────────────
// ───────────────────────── Drag tasks onto sidebar to change status ─────────────────────────
document.getElementById('view-body').addEventListener('dragstart', (e) => {
  const row = e.target.closest('.task-row, .task-card');
  if (!row) return;
  row.classList.add('dragging');
});
document.getElementById('view-body').addEventListener('dragend', (e) => {
  const row = e.target.closest('.task-row, .task-card');
  if (row) row.classList.remove('dragging');
});

const STATUS_BY_NAV_VIEW = { inbox: 'inbox', next: 'next', scheduled: 'scheduled', waiting: 'waiting', someday: 'someday', done: 'done' };
document.getElementById('main-nav').addEventListener('dragover', (e) => {
  const item = e.target.closest('.nav-item');
  if (!item || !(STATUS_BY_NAV_VIEW[item.dataset.view] || item.dataset.view === 'today')) return;
  e.preventDefault();
  item.classList.add('nav-drop-target');
});
document.getElementById('main-nav').addEventListener('dragleave', (e) => {
  const item = e.target.closest('.nav-item');
  if (item) item.classList.remove('nav-drop-target');
});
document.getElementById('main-nav').addEventListener('drop', async (e) => {
  const item = e.target.closest('.nav-item');
  if (!item) return;
  const view = item.dataset.view;
  if (!(STATUS_BY_NAV_VIEW[view] || view === 'today')) return;
  e.preventDefault();
  item.classList.remove('nav-drop-target');
  const dragging = document.querySelector('.task-row.dragging, .task-card.dragging');
  if (!dragging) return;
  const id = dragging.dataset.id;
  const updates = {};
  if (view === 'today') { updates.status = 'scheduled'; updates.due = todayISO(); }
  else {
    updates.status = STATUS_BY_NAV_VIEW[view];
    if (view === 'done') updates.completedAt = new Date();
  }
  await updateTask(id, updates);
  showToast('Moved to ' + (item.querySelector('.nav-label')?.textContent.trim() || view));
});

function attachDragAndDrop() {
  document.querySelectorAll('.task-card').forEach((card) => {
    card.addEventListener('dragstart', () => card.classList.add('dragging'));
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  document.querySelectorAll('.board-column-body').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const dragging = document.querySelector('.task-card.dragging');
      if (!dragging) return;
      const id = dragging.dataset.id;
      const context = col.dataset.context || '';
      await updateTask(id, { context });
    });
  });
}

// ───────────────────────── Calendar navigation ─────────────────────────
function stepCalendar(dir) {
  const c = state.calendarCursor;
  const mode = state.calendarViewMode;
  if (mode === 'day') state.calendarCursor = new Date(c.getFullYear(), c.getMonth(), c.getDate() + dir);
  else if (mode === 'week') state.calendarCursor = new Date(c.getFullYear(), c.getMonth(), c.getDate() + dir * 7);
  else state.calendarCursor = new Date(c.getFullYear(), c.getMonth() + dir, 1);
}

// ───────────────────────── Google Calendar ─────────────────────────
async function refreshGcalEvents() {
  if (!state.gcalConnected || !state.gcalSettings.syncedCalendarIds?.length) {
    state.gcalEventsByDate = {};
    if (state.view === 'calendar') render();
    return;
  }
  const cursor = state.calendarCursor;
  const rangeStart = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
  const rangeEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0);
  try {
    const events = await gcal.listEventsFromCalendars(
      state.gcalSettings.syncedCalendarIds, rangeStart.toISOString(), rangeEnd.toISOString()
    );
    const byDate = {};
    events.forEach((ev) => {
      const dateStr = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
      if (!dateStr) return;
      (byDate[dateStr] ||= []).push(ev);
    });
    state.gcalEventsByDate = byDate;
  } catch {
    // token likely expired; user will need to reconnect via the modal
  }
  if (state.view === 'calendar') render();
}

const gcalModal = document.getElementById('gcal-modal');
let gcalModalCalendars = [];
let gcalModalSelected = new Set();
let gcalModalWriteId = '';

async function openGcalSettingsModal() {
  gcalModal.hidden = false;
  const body = document.getElementById('gcal-modal-body');
  const saveBtn = document.getElementById('gcal-save');
  saveBtn.hidden = true;
  body.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);">Connecting…</p>';

  try {
    if (!state.gcalConnected) {
      await gcal.connect(true);
      state.gcalConnected = true;
      localStorage.setItem('gcal_ever_connected', '1');
    }
    gcalModalCalendars = await gcal.listCalendars();
    state.gcalCalendars = gcalModalCalendars;
    gcalModalSelected = new Set(state.gcalSettings.syncedCalendarIds || []);
    gcalModalWriteId = state.gcalSettings.writeCalendarId || '';

    body.innerHTML = `
      <p style="font-size:12.5px;color:var(--text-secondary);margin-bottom:12px;">
        Pick which calendars Flow should read from, and which one new Scheduled tasks with a time get written to.
      </p>
      ${gcalModalCalendars.map((c) => `
        <div class="gcal-cal-item">
          <input type="checkbox" data-action="gcal-toggle-sync" data-id="${c.id}" ${gcalModalSelected.has(c.id) ? 'checked' : ''} />
          <span class="gcal-cal-name">${escapeHtml(c.summary)}</span>
          <label class="gcal-write-radio" style="font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:4px;">
            <input type="radio" name="gcal-write" data-action="gcal-set-write" data-id="${c.id}" ${gcalModalWriteId === c.id ? 'checked' : ''} /> write
          </label>
        </div>
      `).join('')}
    `;
    saveBtn.hidden = false;
    refreshGcalEvents();
  } catch (err) {
    body.innerHTML = `<p style="font-size:13px;color:var(--danger);">Could not connect to Google Calendar. Try again.</p>`;
  }
}

document.getElementById('gcal-modal-body').addEventListener('change', (e) => {
  const toggle = e.target.closest('[data-action="gcal-toggle-sync"]');
  if (toggle) {
    if (toggle.checked) gcalModalSelected.add(toggle.dataset.id);
    else gcalModalSelected.delete(toggle.dataset.id);
    return;
  }
  const writeRadio = e.target.closest('[data-action="gcal-set-write"]');
  if (writeRadio) gcalModalWriteId = writeRadio.dataset.id;
});

document.getElementById('gcal-save').addEventListener('click', async () => {
  const syncedCalendarIds = [...gcalModalSelected];
  const writeCalendarId = syncedCalendarIds.includes(gcalModalWriteId) ? gcalModalWriteId : (syncedCalendarIds[0] || '');
  await updateCalendarSettings({ syncedCalendarIds, writeCalendarId });
  gcalModal.hidden = true;
  showToast('Google Calendar settings saved');
});

function closeGcalModal() { gcalModal.hidden = true; }
document.getElementById('gcal-modal-backdrop').addEventListener('click', closeGcalModal);
document.getElementById('gcal-cancel').addEventListener('click', closeGcalModal);

// ───────────────────────── Toast ─────────────────────────
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}
