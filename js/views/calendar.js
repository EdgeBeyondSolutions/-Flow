import { state } from '../state.js';
import { escapeHtml, isoFromDate, todayISO } from '../util.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function renderCalendar() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const today = todayISO();
  const tasksByDate = {};
  state.tasks.forEach((t) => {
    if (!t.due) return;
    (tasksByDate[t.due] ||= []).push(t);
  });

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const iso = isoFromDate(d);
    const otherMonth = d.getMonth() !== month;
    const isToday = iso === today;
    const dayTasks = tasksByDate[iso] || [];

    const gEvents = state.gcalEventsByDate[iso] || [];

    cells.push(`
      <div class="calendar-cell ${otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${(dayTasks.length || gEvents.length) ? 'has-tasks' : ''}">
        <div class="calendar-cell-top">
          <div class="calendar-date">${d.getDate()}</div>
          <button type="button" class="calendar-add-btn" data-action="add-task-on-date" data-date="${iso}" title="Add task on this date">+</button>
        </div>
        ${gEvents.slice(0, 2).map((e) => `
          <div class="calendar-task calendar-gevent" title="${escapeHtml(e.summary || '')}">📆 ${escapeHtml(e.summary || '(no title)')}</div>
        `).join('')}
        ${dayTasks.slice(0, 3).map((t) => `
          <div class="calendar-task ${iso < today && t.status !== 'done' ? 'overdue' : ''}" data-action="open" data-id="${t.id}">${escapeHtml(t.title)}</div>
        `).join('')}
        ${dayTasks.length > 3 ? `<div class="calendar-task">+${dayTasks.length - 3} more</div>` : ''}
      </div>
    `);
  }

  return `
    <div class="calendar-header">
      <button class="calendar-nav-btn" data-action="cal-prev">‹</button>
      <div class="calendar-month-label">${MONTHS[month]} ${year}</div>
      <button class="calendar-nav-btn" data-action="cal-next">›</button>
      <button class="btn btn-ghost" data-action="cal-today">Today</button>
      <button class="btn btn-ghost" data-action="open-gcal-modal" style="margin-left:auto;">
        ${state.gcalConnected ? '🔗 Manage calendars' : '🔗 Connect Google Calendar'}
      </button>
    </div>
    <div class="calendar-grid">
      ${DOW.map((d) => `<div class="calendar-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
  `;
}
