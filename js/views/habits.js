import { state } from '../state.js?v=3';
import { escapeHtml, todayISO, isoFromDate } from '../util.js?v=2';
import { emptyStateHTML } from './taskCard.js?v=2';

export function currentStreak(completions) {
  const set = new Set(completions || []);
  const d = new Date();
  if (!set.has(isoFromDate(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(isoFromDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function last7Days() {
  const days = [];
  const d = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(d);
    day.setDate(d.getDate() - i);
    days.push(isoFromDate(day));
  }
  return days;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function habitRowHTML(habit) {
  const today = todayISO();
  const doneToday = (habit.completions || []).includes(today);
  const streak = currentStreak(habit.completions);
  const days = last7Days();
  const set = new Set(habit.completions || []);

  return `
    <div class="habit-row" data-id="${habit.id}">
      <button class="task-checkbox habit-today-check ${doneToday ? 'checked' : ''}" data-action="habit-toggle-today" data-id="${habit.id}" title="Mark today">
        ${doneToday ? '✓' : ''}
      </button>
      <div class="habit-row-body">
        <div class="habit-name">${escapeHtml(habit.name)}</div>
        <div class="habit-dots">
          ${days.map((d) => {
            const dow = new Date(d + 'T00:00:00').getDay();
            return `<span class="habit-dot ${set.has(d) ? 'filled' : ''} ${d === today ? 'is-today' : ''}" title="${d}">${DAY_LETTERS[dow]}</span>`;
          }).join('')}
        </div>
      </div>
      <div class="habit-streak" title="Current streak">🔥 ${streak}</div>
      <button class="icon-btn" data-action="habit-delete" data-id="${habit.id}" title="Delete habit">✕</button>
    </div>
  `;
}

export function renderHabits() {
  const habits = state.habits.filter((h) => !h.archived);

  const formHTML = `
    <form id="habit-add-form" class="habit-add-form">
      <input id="habit-add-name" type="text" placeholder="New habit… (e.g. Meditate 10 min)" autocomplete="off" required />
      <button type="submit" class="btn btn-primary">Add</button>
    </form>
  `;

  if (!habits.length) {
    return formHTML + emptyStateHTML('🔥', 'No habits yet', 'Add a habit and check it off each day to build your streak.');
  }

  return `
    ${formHTML}
    <div class="habit-list">
      ${habits.map(habitRowHTML).join('')}
    </div>
  `;
}
