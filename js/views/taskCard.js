import { escapeHtml, formatDue, isOverdue } from '../util.js';
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
