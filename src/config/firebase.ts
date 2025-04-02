import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBvS_x5W1bDne1QPJdq7tv9BBNp2hAaINE",
  authDomain: "easy-retrospective.firebaseapp.com",
  projectId: "easy-retrospective",
  storageBucket: "easy-retrospective.appspot.com",
  messagingSenderId: "179814713063",
  appId: "1:179814713063:web:53cc6ab728383f424b0442",
  measurementId: "179814713063",
  databaseURL: "https://easy-retrospective-default-rtdb.europe-west1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const realtimeDb = getDatabase(app);