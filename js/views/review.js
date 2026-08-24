import { state } from '../state.js';

const STEPS = [
  { id: 'inbox-zero', title: 'Empty your Inbox', desc: 'Clarify every captured item: turn it into a next action, a project, something to delegate, or a someday item.' },
  { id: 'next-actions', title: 'Review your next actions', desc: 'Read through all of them. Cross off what no longer applies, update what changed.' },
  { id: 'waiting', title: 'Review "Waiting for"', desc: 'Do you need to follow up on anything you delegated?' },
  { id: 'projects', title: 'Review your projects', desc: 'Every active project should have at least one defined next action.' },
  { id: 'someday', title: 'Review "Someday / Maybe"', desc: 'Is anything there ready to activate? Anything no longer relevant?' },
  { id: 'calendar', title: 'Review your calendar', desc: 'Last week and the next two weeks: anything to capture?' },
  { id: 'mind-sweep', title: 'Mind sweep', desc: 'Is anything looping in your head that you have not captured yet? Add it to the Inbox now.' },
];

export function renderReview() {
  const completeCount = state.reviewChecked.size;
  return `
    <div class="review-wrap">
      <p class="review-intro">Your weekly GTD review. Go step by step — the goal is "mind like water": everything captured, clarified, and organized. ${completeCount}/${STEPS.length} complete.</p>
      ${STEPS.map((s, i) => {
        const checked = state.reviewChecked.has(s.id);
        return `
          <div class="review-step ${checked ? 'complete' : ''}">
            <div class="review-step-header">
              <div class="review-step-num">${checked ? '✓' : i + 1}</div>
              <div class="review-step-title">${s.title}</div>
            </div>
            <div class="review-step-desc">${s.desc}</div>
            <div class="review-step-content">
              <label class="review-check">
                <input type="checkbox" data-action="review-check" data-id="${s.id}" ${checked ? 'checked' : ''} />
                Completed
              </label>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
