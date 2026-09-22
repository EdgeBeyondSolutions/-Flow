import { state } from '../state.js?v=3';
import { escapeHtml } from '../util.js?v=2';
import { emptyStateHTML } from './taskCard.js?v=2';

export const GROCERY_CATEGORIES = [
  'Produce', 'Dairy', 'Meat & Fish', 'Bakery',
  'Pantry', 'Beverages', 'Cleaning', 'Personal Care', 'Clothing & Footwear', 'Other',
];

function itemRowHTML(item) {
  return `
    <div class="grocery-item ${item.checked ? 'checked' : ''}" data-id="${item.id}">
      <button class="task-checkbox ${item.checked ? 'checked' : ''}" data-action="grocery-toggle" data-id="${item.id}">
        ${item.checked ? '✓' : ''}
      </button>
      <div class="grocery-item-body">
        <span class="grocery-item-name">${escapeHtml(item.name)}</span>
        ${item.quantity ? `<span class="tag tag-context">${escapeHtml(item.quantity)}</span>` : ''}
      </div>
      <button class="icon-btn" data-action="grocery-delete" data-id="${item.id}" title="Remove">✕</button>
    </div>
  `;
}

export function renderGrocery() {
  const items = state.groceryItems;

  const formHTML = `
    <form id="grocery-add-form" class="grocery-add-form">
      <input id="grocery-add-name" type="text" placeholder="Add an item… (e.g. Milk)" autocomplete="off" required />
      <input id="grocery-add-qty" type="text" placeholder="Qty" autocomplete="off" class="grocery-qty-input" />
      <select id="grocery-add-category">
        ${GROCERY_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <button type="submit" class="btn btn-primary">Add</button>
    </form>
  `;

  if (!items.length) {
    return formHTML + emptyStateHTML('🛒', 'Your list is empty', 'Add what you need to buy. It syncs across all your devices.');
  }

  const byCategory = new Map();
  items.filter((i) => !i.checked).forEach((i) => {
    const cat = i.category || 'Other';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(i);
  });
  const checkedItems = items.filter((i) => i.checked);

  const groupsHTML = GROCERY_CATEGORIES
    .filter((cat) => byCategory.has(cat))
    .map((cat) => `
      <div class="grocery-group">
        <div class="grocery-group-title">${cat}</div>
        ${byCategory.get(cat).map(itemRowHTML).join('')}
      </div>
    `).join('');

  const checkedHTML = checkedItems.length ? `
    <div class="grocery-group grocery-group-done">
      <div class="grocery-group-title">
        Checked off (${checkedItems.length})
        <button type="button" class="btn btn-ghost grocery-clear-btn" data-action="grocery-clear-checked">Clear checked</button>
      </div>
      ${checkedItems.map(itemRowHTML).join('')}
    </div>
  ` : '';

  return `
    ${formHTML}
    <div class="grocery-list">
      ${groupsHTML}
      ${checkedHTML}
    </div>
  `;
}
