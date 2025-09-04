// firebase.js — módulos ESM desde CDN (ideal para GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, updateDoc, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Configuración (de tu proyecto)
const firebaseConfig = {
  apiKey: "AIzaSyCjYwk5u4D3ys6D_NZqQN2u_taEWKoUzKA",
  authDomain: "uragrafica-d0ac3.firebaseapp.com",
  projectId: "uragrafica-d0ac3",
  storageBucket: "uragrafica-d0ac3.appspot.com",
  messagingSenderId: "526922007518",
  appId: "1:526922007518:web:c732ab4a3606a6a1aad34f",
  measurementId: "G-1X2NVCM778"
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);

// Re-export para app.js
export {
  collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, updateDoc, doc, deleteDoc
};

// Log para verificar en consola del navegador
console.log("[firebase.js] Firebase listo:", firebaseConfig.projectId);

