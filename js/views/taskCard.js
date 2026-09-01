import { escapeHtml, formatDue, isOverdue, priorityLabel } from '../util.js';
import { state, contextById, projectById } from '../state.js';

const PRIORITY_RANK = { critical: 3, high: 2, medium: 1, low: 0 };

function sortValue(task, column) {
  switch (column) {
    case 'name': return (task.title || '').toLowerCase();
    case 'due': return task.due || '';
    case 'priority': return PRIORITY_RANK[task.priority] ?? 1;
    case 'owner': return (task.waitingOn || '').toLowerCase();
    case 'context': return (contextById(task.context)?.name || '').toLowerCase();
    case 'project': return (projectById(task.projectId)?.name || '').toLowerCase();
    default: return '';
  }
}

function sortTasks(tasks, sort) {
  if (!sort.column) return tasks;
  const sorted = [...tasks].sort((a, b) => {
    const va = sortValue(a, sort.column);
    const vb = sortValue(b, sort.column);
    const aEmpty = va === '' || va === null || va === undefined;
    const bEmpty = vb === '' || vb === null || vb === undefined;
    if (aEmpty && !bEmpty) return 1;
    if (bEmpty && !aEmpty) return -1;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  });
  if (sort.dir === 'desc') sorted.reverse();
  return sorted;
}

function sortableColHTML(label, column) {
  const active = state.sort.column === column;
  const arrow = active ? (state.sort.dir === 'asc' ? '▲' : '▼') : '';
  return `<span class="col-sortable ${active ? 'active' : ''}" data-action="sort-column" data-column="${column}">${label}${arrow ? ` <span class="col-sort-arrow">${arrow}</span>` : ''}</span>`;
}

export function taskCardHTML(task) {
  const ctx = task.context ? contextById(task.context) : null;
  const proj = task.projectId ? projectById(task.projectId) : null;
  const overdue = isOverdue(task.due) && task.status !== 'done';
  const done = task.status === 'done';

  const tags = [];
  if (proj) tags.push(`<span class="tag tag-project">🗂 ${escapeHtml(proj.name)}</span>`);
  if (ctx) tags.push(`<span class="tag tag-context" style="color:${ctx.color}">● ${escapeHtml(ctx.name)}</span>`);
  if (task.priority === 'critical') tags.push(`<span class="tag tag-priority-critical">Critical</span>`);
  else if (task.priority === 'high') tags.push(`<span class="tag tag-priority-high">High</span>`);
  if (task.waitingOn) tags.push(`<span class="tag tag-waiting">⏳ ${escapeHtml(task.waitingOn)}</span>`);
  if (task.due) tags.push(`<span class="tag tag-due ${overdue ? 'overdue' : ''}">📅 ${formatDue(task.due)}</span>`);
  if (task.url) tags.push(`<span class="tag tag-url">🔗 Link</span>`);
  if (task.attachments && task.attachments.length) tags.push(`<span class="tag tag-attachments">📎 ${task.attachments.length}</span>`);

  return `
    <div class="task-card ${done ? 'done' : ''}" draggable="true" data-id="${task.id}">
      <div class="task-checkbox ${done ? 'checked' : ''}" data-action="toggle-done" data-id="${task.id}">${done ? '✓' : ''}</div>
      <div class="task-card-body" data-action="open" data-id="${task.id}">
        <div class="task-card-title">${escapeHtml(task.title)}</div>
        ${tags.length ? `<div class="task-card-meta">${tags.join('')}</div>` : ''}
      </div>
    </div>
  `;
}

export function emptyStateHTML(icon, title, desc) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-desc">${desc}</div>
    </div>
  `;
}

export function taskRowHTML(task) {
  const ctx = task.context ? contextById(task.context) : null;
  const proj = task.projectId ? projectById(task.projectId) : null;
  const overdue = isOverdue(task.due) && task.status !== 'done';
  const done = task.status === 'done';

  const extraTags = [];
  if (task.url) extraTags.push(`<span class="tag tag-url">🔗 Link</span>`);
  if (task.attachments && task.attachments.length) extraTags.push(`<span class="tag tag-attachments">📎 ${task.attachments.length}</span>`);

  return `
    <div class="task-row ${done ? 'done' : ''}" draggable="true" data-id="${task.id}">
      <div class="task-row-checkbox ${done ? 'checked' : ''}" data-action="toggle-done" data-id="${task.id}">${done ? '✓' : ''}</div>
      <div class="task-row-main" data-action="open" data-id="${task.id}">
        <div class="task-row-title">${escapeHtml(task.title)}</div>
        <div class="task-row-tags-mobile">
          ${task.due ? `<span class="tag tag-due ${overdue ? 'overdue' : ''}">📅 ${formatDue(task.due)}</span>` : ''}
          <span class="tag tag-priority-${task.priority || 'medium'}">🚩 ${priorityLabel(task.priority)}</span>
          ${task.waitingOn ? `<span class="tag tag-waiting">⏳ ${escapeHtml(task.waitingOn)}</span>` : ''}
          ${ctx ? `<span class="tag tag-context" style="color:${ctx.color}">● ${escapeHtml(ctx.name)}</span>` : ''}
          ${proj ? `<span class="tag tag-project">🗂 ${escapeHtml(proj.name)}</span>` : ''}
          ${extraTags.join('')}
        </div>
      </div>
      <div class="task-row-col task-row-col-due">
        ${task.due ? `<span class="row-due ${overdue ? 'overdue' : ''}">${formatDue(task.due)}</span>` : ''}
      </div>
      <div class="task-row-col task-row-col-priority">
        <span class="row-priority row-priority-${task.priority || 'medium'}">🚩 ${priorityLabel(task.priority)}</span>
      </div>
      <div class="task-row-col task-row-col-owner">
        ${task.waitingOn ? `<span class="tag tag-waiting">⏳ ${escapeHtml(task.waitingOn)}</span>` : ''}
      </div>
      <div class="task-row-col task-row-col-context">
        ${ctx ? `<span class="tag tag-context" style="color:${ctx.color}">● ${escapeHtml(ctx.name)}</span>` : ''}
      </div>
      <div class="task-row-col task-row-col-project">
        ${proj ? `<span class="tag tag-project">🗂 ${escapeHtml(proj.name)}</span>` : ''}
        ${extraTags.join('')}
      </div>
    </div>
  `;
}

export function taskTableHTML(tasks, groupLabel) {
  const sorted = sortTasks(tasks, state.sort);
  return `
    <div class="task-table">
      <div class="task-table-header" data-action="toggle-group">
        <span class="table-toggle-chevron">▾</span>
        <span class="table-group-label">${groupLabel}</span>
        <span class="table-group-count">${tasks.length}</span>
      </div>
      <div class="task-table-body">
        <div class="task-table-columns">
          <span class="col-name">${sortableColHTML('Name', 'name')}</span>
          <span class="col-due">${sortableColHTML('Due date', 'due')}</span>
          <span class="col-priority">${sortableColHTML('Priority', 'priority')}</span>
          <span class="col-owner">${sortableColHTML('Owner', 'owner')}</span>
          <span class="col-context">${sortableColHTML('Context', 'context')}</span>
          <span class="col-project">${sortableColHTML('Project', 'project')}</span>
        </div>
        ${sorted.map(taskRowHTML).join('')}
      </div>
    </div>
  `;
}
