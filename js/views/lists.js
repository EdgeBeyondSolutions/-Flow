import { state, filteredTasks } from '../state.js';
import { taskCardHTML, emptyStateHTML } from './taskCard.js';
import { todayISO } from '../util.js';

export function renderToday() {
  const today = todayISO();
  const tasks = filteredTasks((t) => t.due === today && t.status !== 'done');
  if (!tasks.length) {
    return emptyStateHTML('☀️', 'Nothing due today', 'Tasks with a due date of today will show up here.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}

export function renderScheduled() {
  const tasks = filteredTasks((t) => !!t.due && t.status !== 'done')
    .sort((a, b) => a.due.localeCompare(b.due));
  if (!tasks.length) {
    return emptyStateHTML('🗓', 'Nothing scheduled', 'Any task with a due date will show up here, soonest first.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}

export function renderInbox() {
  const tasks = filteredTasks((t) => t.status === 'inbox');
  if (!tasks.length) {
    return emptyStateHTML('📥', 'Your inbox is empty', 'Capture whatever is on your mind with the "Capture" button (or the C key). Then clarify it: turn it into a next action, a project, or a someday item.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}

export function renderNextList() {
  const tasks = filteredTasks((t) => t.status === 'next' && !t.due);
  if (!tasks.length) {
    return emptyStateHTML('⚡', 'No next actions yet', 'Clarify tasks from your Inbox so they show up here, ready to execute. Tasks with a due date live in Scheduled instead.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}

export function renderNextBoard() {
  const tasks = filteredTasks((t) => t.status === 'next' && !t.due);
  const noContext = tasks.filter((t) => !t.context);
  const columns = state.contexts.map((ctx) => ({
    id: ctx.id, name: ctx.name, color: ctx.color,
    tasks: tasks.filter((t) => t.context === ctx.id),
  }));
  if (noContext.length) columns.unshift({ id: '', name: 'No context', color: '#9C9A90', tasks: noContext });

  return `
    <div class="board">
      ${columns.map((col) => `
        <div class="board-column">
          <div class="board-column-header">
            <span class="context-dot" style="background:${col.color}"></span>
            <span class="board-column-title">${col.name}</span>
            <span class="board-column-count">${col.tasks.length}</span>
          </div>
          <div class="board-column-body" data-context="${col.id}">
            ${col.tasks.map(taskCardHTML).join('') || ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderWaiting() {
  const tasks = filteredTasks((t) => t.status === 'waiting');
  if (!tasks.length) {
    return emptyStateHTML('⏳', 'Nothing waiting on others', 'Tasks you delegated or that depend on someone else go here.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}

export function renderSomeday() {
  const tasks = filteredTasks((t) => t.status === 'someday');
  if (!tasks.length) {
    return emptyStateHTML('💭', 'No ideas saved yet', 'Anything that is not urgent but worth remembering someday goes here, off your daily radar.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}

export function renderDone() {
  const tasks = filteredTasks((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
    .slice(0, 100);
  if (!tasks.length) {
    return emptyStateHTML('✅', 'Nothing completed yet', 'Tasks you mark as done will show up here.');
  }
  return `<div class="task-list">${tasks.map(taskCardHTML).join('')}</div>`;
}
