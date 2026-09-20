import {
  auth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
  googleProvider, signInWithPopup,
} from './firebase.js?v=4';
import {
  setUid, seedDefaultsIfNeeded, subscribeTasks, subscribeProjects, subscribeContexts,
  createTask, updateTask, deleteTask, createProject, updateProject, createContext,
  subscribeCalendarSettings, updateCalendarSettings,
  subscribeGroceryItems, createGroceryItem, updateGroceryItem, deleteGroceryItem, clearCheckedGroceryItems,
  subscribeHabits, createHabit, deleteHabit, setHabitDoneOnDate,
} from './store.js?v=3';
import * as gcal from './gcal.js?v=2';
import { state, notify, onStateChange } from './state.js?v=3';
import { renderInbox, renderToday, renderScheduled, renderNextList, renderNextBoard, renderWaiting, renderSomeday, renderDone } from './views/lists.js?v=2';
import { renderProjectsGrid, renderProjectDetail } from './views/projects.js?v=2';
import { renderCalendar } from './views/calendar.js?v=2';
import { renderReview } from './views/review.js?v=2';
import { renderGrocery } from './views/grocery.js?v=2';
import { renderHabits } from './views/habits.js?v=2';
import { escapeHtml, autoResize, todayISO } from './util.js?v=2';

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

document.getElementById('auth-forgot').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  if (!email) {
    authError.textContent = 'Type your email above first, then click "Forgot your password?" again.';
    authError.hidden = false;
    return;
  }
  authError.hidden = true;
  authError.classList.remove('success');
  authLoading.hidden = false;
  try {
    await sendPasswordResetEmail(auth, email);
    authError.classList.add('success');
    authError.textContent = `Password reset email sent to ${email}. Check your inbox.`;
    authError.hidden = false;
  } catch (err) {
    authError.textContent = translateAuthError(err.code);
    authError.hidden = false;
  } finally {
    authLoading.hidden = true;
  }
});

document.getElementById('auth-google').addEventListener('click', async () => {
  authError.hidden = true;
  authError.classList.remove('success');
  authLoading.hidden = false;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      // user dismissed the popup — no error to show
    } else if (err.code === 'auth/account-exists-with-different-credential') {
      authError.textContent = 'This email already has a -Flow account with a password. Sign in with your password below, then Google sign-in will work for it too.';
      authError.hidden = false;
    } else {
      authError.textContent = translateAuthError(err.code);
      authError.hidden = false;
    }
  } finally {
    authLoading.hidden = true;
  }
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
  unsubscribers.push(subscribeGroceryItems((items) => { state.groceryItems = items; render(); }));
  unsubscribers.push(subscribeHabits((habits) => { state.habits = habits; render(); }));

  // Silent (prompt:'') token requests show no UI by design — they either
  // succeed quietly or fail quietly. Only interactive connects (the
  // Connect/Manage calendars button) should ever show Google's account
  // picker. This restores the Google connection on reload without asking
  // again each time.
  if (localStorage.getItem('gcal_ever_connected') === '1') {
    gcal.connect(false).then(async () => {
      state.gcalConnected = true;
      try {
        const cals = await gcal.listCalendars();
        state.gcalCalendars = cals;
        state.gcalAccountEmail = cals.find((c) => c.primary)?.id || '';
      } catch { /* calendar list is optional here; sync still works without it */ }
      render();
      refreshGcalEvents();
    }).catch(() => {});
  }
}

// ───────────────────────── Navigation ─────────────────────────
const viewTitles = {
  inbox: 'Inbox', today: 'Today', scheduled: 'Scheduled', next: 'Next actions', projects: 'Projects', waiting: 'Waiting for',
  grocery: 'Grocery list', habits: 'Habits',
  calendar: 'Calendar', someday: 'Someday / Maybe', review: 'Weekly review', done: 'Done',
};

document.getElementById('main-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  const enteringCalendar = btn.dataset.view === 'calendar' && state.view !== 'calendar';
  state.view = btn.dataset.view;
  state.selectedProjectId = null;
  closeMobileNav();
  render();
  if (enteringCalendar) refreshGcalEvents();
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
  document.getElementById('count-grocery').textContent = state.groceryItems.filter((i) => !i.checked).length;
  document.getElementById('count-habits').textContent = state.habits.filter((h) => !h.archived).length;

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
    case 'grocery': body.innerHTML = renderGrocery(); break;
    case 'habits': body.innerHTML = renderHabits(); break;
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

function renderTaskFormOptions(targetGcalId) {
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
  const currentGcal = targetGcalId !== undefined ? targetGcalId : gcalSelect.value;
  const syncedCals = state.gcalCalendars.filter((c) => state.gcalSettings.syncedCalendarIds.includes(c.id));
  let options = syncedCals;
  // state.gcalCalendars is only populated after opening "Manage calendars" this
  // session — without this, a task's already-saved calendar choice would have
  // no matching <option> and silently revert to "Use default" on reopen.
  if (currentGcal && !options.some((c) => c.id === currentGcal)) {
    const known = state.gcalCalendars.find((c) => c.id === currentGcal);
    options = [{ id: currentGcal, summary: known ? known.summary : `Selected calendar (${currentGcal})` }, ...options];
  }
  gcalSelect.innerHTML = '<option value="">— Use default —</option>' +
    options.map((c) => `<option value="${c.id}">${escapeHtml(c.summary)}</option>`).join('');
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

  const refreshGcal = e.target.closest('[data-action="cal-refresh-gcal"]');
  if (refreshGcal) { refreshGcalEvents(); showToast('Refreshing Google Calendar…'); return; }

  const groceryToggle = e.target.closest('[data-action="grocery-toggle"]');
  if (groceryToggle) {
    const item = state.groceryItems.find((i) => i.id === groceryToggle.dataset.id);
    if (item) updateGroceryItem(item.id, { checked: !item.checked });
    return;
  }
  const groceryDelete = e.target.closest('[data-action="grocery-delete"]');
  if (groceryDelete) { deleteGroceryItem(groceryDelete.dataset.id); return; }
  const groceryClear = e.target.closest('[data-action="grocery-clear-checked"]');
  if (groceryClear) {
    const ids = state.groceryItems.filter((i) => i.checked).map((i) => i.id);
    if (ids.length) clearCheckedGroceryItems(ids);
    return;
  }

  const habitToggleToday = e.target.closest('[data-action="habit-toggle-today"]');
  if (habitToggleToday) {
    const habit = state.habits.find((h) => h.id === habitToggleToday.dataset.id);
    if (habit) {
      const today = todayISO();
      const done = (habit.completions || []).includes(today);
      setHabitDoneOnDate(habit.id, today, !done);
    }
    return;
  }
  const habitDelete = e.target.closest('[data-action="habit-delete"]');
  if (habitDelete) { deleteHabit(habitDelete.dataset.id); return; }
});

document.getElementById('view-body').addEventListener('submit', (e) => {
  const groceryForm = e.target.closest('#grocery-add-form');
  if (groceryForm) {
    e.preventDefault();
    const nameInput = document.getElementById('grocery-add-name');
    const qtyInput = document.getElementById('grocery-add-qty');
    const categorySelect = document.getElementById('grocery-add-category');
    const name = nameInput.value.trim();
    if (!name) return;
    createGroceryItem({ name, quantity: qtyInput.value.trim(), category: categorySelect.value });
    nameInput.value = '';
    qtyInput.value = '';
    nameInput.focus();
    return;
  }
  const habitForm = e.target.closest('#habit-add-form');
  if (habitForm) {
    e.preventDefault();
    const nameInput = document.getElementById('habit-add-name');
    const name = nameInput.value.trim();
    if (!name) return;
    createHabit({ name });
    nameInput.value = '';
    nameInput.focus();
  }
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
let pendingReminders = [];
const REMINDER_UNIT_MINUTES = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };

function minutesToUnit(minutes) {
  if (minutes % 10080 === 0 && minutes > 0) return { amount: minutes / 10080, unit: 'weeks' };
  if (minutes % 1440 === 0 && minutes > 0) return { amount: minutes / 1440, unit: 'days' };
  if (minutes % 60 === 0 && minutes > 0) return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

function renderReminderList() {
  const el = document.getElementById('reminder-list');
  el.innerHTML = pendingReminders.map((mins, i) => {
    const { amount, unit } = minutesToUnit(mins);
    return `
      <div class="reminder-row">
        <span class="reminder-bell">🔔</span>
        <input type="number" class="reminder-amount" min="1" max="999" value="${amount}" data-index="${i}" />
        <select class="reminder-unit" data-index="${i}">
          <option value="minutes" ${unit === 'minutes' ? 'selected' : ''}>${amount === 1 ? 'minute' : 'minutes'}</option>
          <option value="hours" ${unit === 'hours' ? 'selected' : ''}>${amount === 1 ? 'hour' : 'hours'}</option>
          <option value="days" ${unit === 'days' ? 'selected' : ''}>${amount === 1 ? 'day' : 'days'}</option>
          <option value="weeks" ${unit === 'weeks' ? 'selected' : ''}>${amount === 1 ? 'week' : 'weeks'}</option>
        </select>
        <span class="reminder-before">before</span>
        <button type="button" class="icon-btn reminder-remove" data-index="${i}" title="Remove">✕</button>
      </div>
    `;
  }).join('') || '<div class="reminder-empty">No notifications set for this task.</div>';
}

document.getElementById('add-reminder-btn').addEventListener('click', () => {
  if (pendingReminders.length >= 5) { showToast('Google Calendar allows up to 5 notifications per event'); return; }
  pendingReminders.push(10);
  renderReminderList();
});

document.getElementById('reminder-list').addEventListener('input', (e) => {
  const input = e.target.closest('.reminder-amount');
  if (!input) return;
  const i = Number(input.dataset.index);
  const unit = document.querySelector(`.reminder-unit[data-index="${i}"]`).value;
  const amount = Math.max(1, Number(input.value) || 1);
  pendingReminders[i] = amount * REMINDER_UNIT_MINUTES[unit];
});

document.getElementById('reminder-list').addEventListener('change', (e) => {
  const select = e.target.closest('.reminder-unit');
  if (!select) return;
  const i = Number(select.dataset.index);
  const amount = Number(document.querySelector(`.reminder-amount[data-index="${i}"]`).value) || 1;
  pendingReminders[i] = amount * REMINDER_UNIT_MINUTES[select.value];
});

document.getElementById('reminder-list').addEventListener('click', (e) => {
  const btn = e.target.closest('.reminder-remove');
  if (!btn) return;
  pendingReminders.splice(Number(btn.dataset.index), 1);
  renderReminderList();
});

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
    renderTaskFormOptions(t.gcalCalendarId || '');
    pendingReminders = Array.isArray(t.reminders) ? [...t.reminders] : (t.reminderMinutes ? [t.reminderMinutes] : []);
    renderReminderList();
  } else {
    document.getElementById('task-status').value = defaults.status || 'inbox';
    document.getElementById('task-project').value = defaults.projectId || '';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-due').value = defaults.due || '';
    document.getElementById('task-time').value = defaults.dueTime || '';
    document.getElementById('task-duration').value = 30;
    document.getElementById('task-delete').hidden = true;
    pendingAttachments = [];
    renderTaskFormOptions('');
    pendingReminders = defaults.reminders ? [...defaults.reminders] : [];
    renderReminderList();
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
  document.getElementById('reminder-field-row').hidden = !scheduled;
  document.getElementById('gcal-field-row').hidden = !scheduled || !state.gcalConnected || state.gcalCalendars.length < 2;
  document.getElementById('reminder-hint').textContent = state.gcalAccountEmail
    ? `Sent by email to ${state.gcalAccountEmail}.`
    : 'Sent by email to your Google account — connect it from the Calendar view to confirm which one.';
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
    reminders: (data.reminders && data.reminders.length)
      ? { useDefault: false, overrides: data.reminders.map((m) => ({ method: 'email', minutes: m })) }
      : { useDefault: false, overrides: [] },
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
  };
  const reminders = status === 'scheduled' ? [...pendingReminders] : [];
  const explicitCalendarId = document.getElementById('task-gcal-calendar').value;
  data.reminders = reminders;
  data.gcalCalendarId = status === 'scheduled'
    ? (explicitCalendarId || (reminders.length ? (state.gcalSettings.writeCalendarId || '') : ''))
    : '';
  if (!data.title) return;
  if (status === 'done') data.completedAt = new Date();
  const reminderNeedsConnection = reminders.length > 0 && !data.gcalCalendarId;

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
  showToast(reminderNeedsConnection ? 'Saved — connect Google Calendar (Calendar view) to receive this reminder' : 'Saved');
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
    state.gcalAccountEmail = gcalModalCalendars.find((c) => c.primary)?.id || '';
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
