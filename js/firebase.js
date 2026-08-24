import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
  serverTimestamp, setDoc, writeBatch,
};
