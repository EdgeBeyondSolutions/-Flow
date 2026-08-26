import { escapeHtml, formatDue, formatDueShort, isOverdue, priorityLabel } from '../util.js';
import { contextById, projectById } from '../state.js';

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
  if (task.waitingOn) extraTags.push(`<span class="tag tag-waiting">⏳ ${escapeHtml(task.waitingOn)}</span>`);
  if (task.url) extraTags.push(`<span class="tag tag-url">🔗 Link</span>`);
  if (task.attachments && task.attachments.length) extraTags.push(`<span class="tag tag-attachments">📎 ${task.attachments.length}</span>`);

  return `
    <div class="task-row ${done ? 'done' : ''}" data-id="${task.id}">
      <div class="task-row-checkbox ${done ? 'checked' : ''}" data-action="toggle-done" data-id="${task.id}">${done ? '✓' : ''}</div>
      <div class="task-row-main" data-action="open" data-id="${task.id}">
        <div class="task-row-title">${escapeHtml(task.title)}</div>
        <div class="task-row-tags-mobile">
          ${proj ? `<span class="tag tag-project">🗂 ${escapeHtml(proj.name)}</span>` : ''}
          ${ctx ? `<span class="tag tag-context" style="color:${ctx.color}">● ${escapeHtml(ctx.name)}</span>` : ''}
          <span class="tag tag-priority-${task.priority || 'medium'}">🚩 ${priorityLabel(task.priority)}</span>
          ${task.due ? `<span class="tag tag-due ${overdue ? 'overdue' : ''}">📅 ${formatDue(task.due)}</span>` : ''}
          ${extraTags.join('')}
        </div>
      </div>
      <div class="task-row-col task-row-col-context">
        ${ctx ? `<span class="tag tag-context" style="color:${ctx.color}">● ${escapeHtml(ctx.name)}</span>` : ''}
        ${proj ? `<span class="tag tag-project">🗂 ${escapeHtml(proj.name)}</span>` : ''}
        ${extraTags.join('')}
      </div>
      <div class="task-row-col task-row-col-due">
        ${task.due ? `<span class="row-due ${overdue ? 'overdue' : ''}">${formatDueShort(task.due)}</span>` : ''}
      </div>
      <div class="task-row-col task-row-col-priority">
        <span class="row-priority row-priority-${task.priority || 'medium'}">🚩 ${priorityLabel(task.priority)}</span>
      </div>
    </div>
  `;
}

export function taskTableHTML(tasks, groupLabel) {
  return `
    <div class="task-table">
      <div class="task-table-header" data-action="toggle-group">
        <span class="table-toggle-chevron">▾</span>
        <span class="table-group-label">${groupLabel}</span>
        <span class="table-group-count">${tasks.length}</span>
      </div>
      <div class="task-table-body">
        <div class="task-table-columns">
          <span class="col-name">Name</span>
          <span class="col-context">Context / Project</span>
          <span class="col-due">Due date</span>
          <span class="col-priority">Priority</span>
        </div>
        ${tasks.map(taskRowHTML).join('')}
      </div>
    </div>
  `;
}
