import {
  db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, writeBatch, setDoc, arrayUnion, arrayRemove,
} from './firebase.js?v=4';

const DEFAULT_CONTEXTS = [
  { name: '@Calls', color: '#C77D14' },
  { name: '@Computer', color: '#5B3FE0' },
  { name: '@Errands', color: '#C6402C' },
  { name: '@Home', color: '#0E8A6D' },
  { name: '@Office', color: '#0E7490' },
  { name: '@Agenda', color: '#6B6FA8' },
  { name: '@Read/Review', color: '#BE185D' },
  { name: '@Anywhere', color: '#4D7C0F' },
];

let uid = null;
const listeners = [];

export function setUid(id) { uid = id; }

function col(name) { return collection(db, 'users', uid, name); }

export async function seedDefaultsIfNeeded(contexts) {
  if (contexts.length > 0) return;
  const batch = writeBatch(db);
  DEFAULT_CONTEXTS.forEach((c, i) => {
    const ref = doc(col('contexts'));
    batch.set(ref, { ...c, order: i, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

export function subscribeTasks(cb) {
  const q = query(col('tasks'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeProjects(cb) {
  const q = query(col('projects'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeContexts(cb) {
  const q = query(col('contexts'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function createTask(data) {
  return addDoc(col('tasks'), {
    title: '', notes: '', status: 'inbox', context: '', projectId: '',
    priority: 'medium', due: '', dueTime: '', durationMinutes: 30,
    waitingOn: '', url: '', attachments: [],
    gcalEventId: '', gcalCalendarId: '', reminders: [],
    createdAt: serverTimestamp(), completedAt: null,
    ...data,
  });
}

export function updateTask(id, data) {
  return updateDoc(doc(col('tasks'), id), data);
}

export function deleteTask(id) {
  return deleteDoc(doc(col('tasks'), id));
}

export function createProject(data) {
  return addDoc(col('projects'), {
    name: '', outcome: '', archived: false, createdAt: serverTimestamp(), ...data,
  });
}

export function updateProject(id, data) {
  return updateDoc(doc(col('projects'), id), data);
}

export function deleteProject(id) {
  return deleteDoc(doc(col('projects'), id));
}

export function createContext(data) {
  return addDoc(col('contexts'), { name: '', color: '#5B3FE0', order: 99, createdAt: serverTimestamp(), ...data });
}

export function deleteContext(id) {
  return deleteDoc(doc(col('contexts'), id));
}

// ───────────────────────── Grocery list ─────────────────────────
export function subscribeGroceryItems(cb) {
  const q = query(col('groceryItems'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function createGroceryItem(data) {
  return addDoc(col('groceryItems'), {
    name: '', category: 'Other', quantity: '', checked: false,
    createdAt: serverTimestamp(), ...data,
  });
}

export function updateGroceryItem(id, data) {
  return updateDoc(doc(col('groceryItems'), id), data);
}

export function deleteGroceryItem(id) {
  return deleteDoc(doc(col('groceryItems'), id));
}

export function clearCheckedGroceryItems(ids) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(col('groceryItems'), id)));
  return batch.commit();
}

// ───────────────────────── Habits ─────────────────────────
export function subscribeHabits(cb) {
  const q = query(col('habits'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function createHabit(data) {
  return addDoc(col('habits'), {
    name: '', color: '#5B3FE0', archived: false, completions: [],
    createdAt: serverTimestamp(), ...data,
  });
}

export function updateHabit(id, data) {
  return updateDoc(doc(col('habits'), id), data);
}

export function deleteHabit(id) {
  return deleteDoc(doc(col('habits'), id));
}

export function setHabitDoneOnDate(id, dateISO, done) {
  return updateDoc(doc(col('habits'), id), {
    completions: done ? arrayUnion(dateISO) : arrayRemove(dateISO),
  });
}

function settingsDoc() { return doc(db, 'users', uid, 'settings', 'googleCalendar'); }

export function subscribeCalendarSettings(cb) {
  return onSnapshot(settingsDoc(), (snap) => {
    cb(snap.exists() ? snap.data() : { syncedCalendarIds: [], writeCalendarId: '' });
  });
}

export function updateCalendarSettings(data) {
  return setDoc(settingsDoc(), data, { merge: true });
}
