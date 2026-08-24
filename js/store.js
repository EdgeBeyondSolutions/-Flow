import {
  db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, writeBatch,
} from './firebase.js';

const DEFAULT_CONTEXTS = [
  { name: '@Home', color: '#0E8A6D' },
  { name: '@Computer', color: '#5B3FE0' },
  { name: '@Calls', color: '#C77D14' },
  { name: '@Errands', color: '#C6402C' },
  { name: '@Agenda', color: '#6B6FA8' },
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
    priority: 'medium', due: '', waitingOn: '',
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
