import { state } from '../state.js';
import { escapeHtml, isoFromDate, todayISO } from '../util.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOUR_HEIGHT = 48;

function toolbarHTML(rangeLabel) {
  return `
    <div class="cal-toolbar">
      <button class="btn btn-ghost cal-today-btn" data-action="cal-today">Today</button>
      <div class="cal-nav">
        <button class="calendar-nav-btn" data-action="cal-prev">‹</button>
        <button class="calendar-nav-btn" data-action="cal-next">›</button>
      </div>
      <div class="cal-range-label">${rangeLabel}</div>
      <select class="cal-view-select" data-action="cal-view-select">
        <option value="day" ${state.calendarViewMode === 'day' ? 'selected' : ''}>Day</option>
        <option value="week" ${state.calendarViewMode === 'week' ? 'selected' : ''}>Week</option>
        <option value="month" ${state.calendarViewMode === 'month' ? 'selected' : ''}>Month</option>
      </select>
      <button class="btn btn-ghost" data-action="open-gcal-modal" style="margin-left:auto;">
        ${state.gcalConnected ? '🔗 Manage calendars' : '🔗 Connect Google Calendar'}
      </button>
    </div>
  `;
}

function getDayItems(iso) {
  const today = todayISO();
  const tasks = state.tasks.filter((t) => t.due === iso && t.status !== 'done');
  const gEvents = state.gcalEventsByDate[iso] || [];
  const allDay = [];
  const timed = [];

  tasks.forEach((t) => {
    if (t.dueTime) {
      const [h, m] = t.dueTime.split(':').map(Number);
      timed.push({
        type: 'task', id: t.id, title: t.title,
        startMinutes: h * 60 + m, durationMinutes: t.durationMinutes || 30,
        overdue: iso < today,
      });
    } else {
      allDay.push({ type: 'task', id: t.id, title: t.title, overdue: iso < today });
    }
  });

  gEvents.forEach((ev) => {
    if (ev.start?.dateTime) {
      const start = new Date(ev.start.dateTime);
      const end = ev.end?.dateTime ? new Date(ev.end.dateTime) : new Date(start.getTime() + 30 * 60000);
      timed.push({
        type: 'gevent', title: ev.summary || '(no title)',
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        durationMinutes: Math.max(15, (end - start) / 60000),
      });
    } else {
      allDay.push({ type: 'gevent', title: ev.summary || '(no title)' });
    }
  });

  return { allDay, timed };
}

function timedItemHTML(item) {
  const top = (item.startMinutes / 60) * HOUR_HEIGHT;
  const height = Math.max(18, (item.durationMinutes / 60) * HOUR_HEIGHT - 2);
  const cls = item.type === 'gevent' ? 'tg-event tg-gevent' : `tg-event ${item.overdue ? 'overdue' : ''}`;
  const action = item.type === 'task' ? `data-action="open" data-id="${item.id}"` : '';
  return `
    <div class="${cls}" style="top:${top}px; height:${height}px;" ${action} title="${escapeHtml(item.title)}">
      ${item.type === 'gevent' ? '📆 ' : ''}${escapeHtml(item.title)}
    </div>
  `;
}

function allDayChipHTML(item) {
  const cls = item.type === 'gevent' ? 'tg-allday-chip tg-gevent' : `tg-allday-chip ${item.overdue ? 'overdue' : ''}`;
  const action = item.type === 'task' ? `data-action="open" data-id="${item.id}"` : '';
  return `<div class="${cls}" ${action} title="${escapeHtml(item.title)}">${item.type === 'gevent' ? '📆 ' : ''}${escapeHtml(item.title)}</div>`;
}

function renderTimeGridView(days) {
  const today = todayISO();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = (nowMinutes / 60) * HOUR_HEIGHT;

  const hourLabels = [];
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? '' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    hourLabels.push(`<div class="tg-hour-label" style="height:${HOUR_HEIGHT}px;">${label}</div>`);
  }

  const dayCols = days.map((d) => {
    const iso = isoFromDate(d);
    const isToday = iso === today;
    const { allDay, timed } = getDayItems(iso);

    const hourCells = [];
    for (let h = 0; h < 24; h++) {
      hourCells.push(`<div class="tg-hour-cell" style="height:${HOUR_HEIGHT}px;" data-action="add-task-on-date" data-date="${iso}" data-hour="${h}"></div>`);
    }

    return `
      <div class="tg-day-col-wrap">
        <div class="tg-allday-cell">${allDay.map(allDayChipHTML).join('')}</div>
        <div class="tg-day-col">
          ${hourCells.join('')}
          ${isToday ? `<div class="tg-now-line" style="top:${nowTop}px;"><span class="tg-now-dot"></span></div>` : ''}
          ${timed.map(timedItemHTML).join('')}
        </div>
      </div>
    `;
  }).join('');

  const headerCols = days.map((d) => {
    const iso = isoFromDate(d);
    const isToday = iso === today;
    return `
      <div class="tg-day-header">
        <div class="tg-day-header-dow">${DOW[d.getDay()]}</div>
        <div class="tg-day-header-num ${isToday ? 'today' : ''}">${d.getDate()}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="timegrid-wrap">
      <div class="timegrid-header">
        <div class="tg-gutter-spacer"></div>
        ${headerCols}
      </div>
      <div class="timegrid-scroll" id="timegrid-scroll">
        <div class="tg-gutter">${hourLabels.join('')}</div>
        ${dayCols}
      </div>
    </div>
  `;
}

function renderMonthView() {
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const today = todayISO();
  const tasksByDate = {};
  state.tasks.forEach((t) => {
    if (!t.due || t.status === 'done') return;
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
          <div class="calendar-task ${iso < today ? 'overdue' : ''}" data-action="open" data-id="${t.id}">${escapeHtml(t.title)}</div>
        `).join('')}
        ${dayTasks.length > 3 ? `<div class="calendar-task">+${dayTasks.length - 3} more</div>` : ''}
      </div>
    `);
  }

  return `
    <div class="calendar-grid">
      ${DOW.map((d) => `<div class="calendar-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
  `;
}

function rangeLabelFor(mode, cursor) {
  if (mode === 'day') {
    return `${DOW_FULL[cursor.getDay()]}, ${MONTHS[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
  }
  if (mode === 'month') {
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }
  // week
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

export function renderCalendar() {
  const mode = state.calendarViewMode;
  const cursor = state.calendarCursor;
  const label = rangeLabelFor(mode, cursor);

  let body;
  if (mode === 'month') {
    body = renderMonthView();
  } else if (mode === 'day') {
    body = renderTimeGridView([new Date(cursor)]);
  } else {
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - cursor.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    body = renderTimeGridView(days);
  }

  return toolbarHTML(label) + body;
}
