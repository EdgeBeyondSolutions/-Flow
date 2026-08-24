import { state } from '../state.js';
import { escapeHtml } from '../util.js';
import { taskCardHTML, emptyStateHTML } from './taskCard.js';

export function renderProjectsGrid() {
  const term = state.search.trim().toLowerCase();
  const projects = state.projects.filter((p) =>
    !term || p.name.toLowerCase().includes(term) || (p.outcome || '').toLowerCase().includes(term)
  );

  const cards = projects.map((p) => {
    const tasks = state.tasks.filter((t) => t.projectId === p.id);
    const done = tasks.filter((t) => t.status === 'done').length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return `
      <div class="project-card" data-action="open-project" data-id="${p.id}">
        <div class="project-card-name">${escapeHtml(p.name)}</div>
        <div class="project-card-outcome">${escapeHtml(p.outcome || 'No outcome defined yet.')}</div>
        <div class="project-progress-bar"><div class="project-progress-fill" style="width:${pct}%"></div></div>
        <div class="project-progress-label">${done}/${tasks.length} actions · ${pct}%</div>
      </div>
    `;
  }).join('');

  return `
    <div class="project-grid">
      ${cards}
      <div class="new-project-card" data-action="new-project"><span>+</span> New project</div>
    </div>
    ${projects.length === 0 ? '' : ''}
  `;
}

export function renderProjectDetail(projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return emptyStateHTML('🗂', 'Project not found', '');

  const tasks = state.tasks.filter((t) => t.projectId === projectId);
  const active = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  return `
    <div class="back-link" data-action="back-to-projects">← Projects</div>
    <div class="project-detail-header">
      <div>
        <h2>${escapeHtml(project.name)}</h2>
        <div class="project-detail-outcome">${escapeHtml(project.outcome || '')}</div>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-ghost" data-action="edit-project" data-id="${project.id}">Edit</button>
        <button class="btn btn-primary" data-action="add-task-to-project" data-id="${project.id}">+ Action</button>
      </div>
    </div>
    <div class="section-heading">Active actions (${active.length})</div>
    <div class="task-list">${active.map(taskCardHTML).join('') || emptyStateHTML('⚡', 'No active actions', 'Add the concrete next action to move this project forward.')}</div>
    ${done.length ? `
      <div class="section-heading">Completed (${done.length})</div>
      <div class="task-list">${done.map(taskCardHTML).join('')}</div>
    ` : ''}
  `;
}
