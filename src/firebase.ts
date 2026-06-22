import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBMpAF1uAEm1XqrbOVB6XxExrfJUajM38o',
  authDomain: 'songarchive-da81e.firebaseapp.com',
  projectId: 'songarchive-da81e',
  storageBucket: 'songarchive-da81e.firebasestorage.app',
  messagingSenderId: '638884319921',
  appId: '1:638884319921:web:4d1f06bd807d5f6135c890',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
const db = getFirestore(app)
const googleProvider = new GoogleAuthProvider()

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function signOutUser() {
  return signOut(auth)
}

export async function loadCloudArchive(user: User): Promise<unknown | null> {
  const snapshot = await getDoc(doc(db, 'users', user.uid, 'archive', 'main'))
  return snapshot.exists() ? snapshot.data() : null
}

export function saveCloudArchive(user: User, data: object) {
  return setDoc(doc(db, 'users', user.uid, 'archive', 'main'), data)
}
