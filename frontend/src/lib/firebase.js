import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDEjv9M4CNuQOk9uJ_5eTFk8tKuRDJ_amQ',
  authDomain: 'farmersetu-cc1de.firebaseapp.com',
  projectId: 'farmersetu-cc1de',
  storageBucket: 'farmersetu-cc1de.firebasestorage.app',
  messagingSenderId: '277446331508',
  appId: '1:277446331508:web:75136fee893baaece15521',
  measurementId: 'G-JMKXX73CM8',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
