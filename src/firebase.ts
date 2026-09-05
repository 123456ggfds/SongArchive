import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { initializeApp } from 'firebase/app'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
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
const githubProvider = new GithubAuthProvider()

const useNativeAuthentication = Capacitor.isNativePlatform()

async function signInWithNativeGoogle() {
  const result = await FirebaseAuthentication.signInWithGoogle()
  const credential = result.credential
  if (!credential?.idToken && !credential?.accessToken) {
    throw new Error('Google 登入未返回有效憑證')
  }

  return signInWithCredential(
    auth,
    GoogleAuthProvider.credential(credential.idToken, credential.accessToken),
  )
}

async function signInWithNativeGithub() {
  const result = await FirebaseAuthentication.signInWithGithub()
  const accessToken = result.credential?.accessToken
  if (!accessToken) throw new Error('GitHub 登入未返回有效憑證')
  return signInWithCredential(auth, GithubAuthProvider.credential(accessToken))
}

export function signInWithGoogle() {
  return useNativeAuthentication
    ? signInWithNativeGoogle()
    : signInWithPopup(auth, googleProvider)
}

export function signInWithGithub() {
  return useNativeAuthentication
    ? signInWithNativeGithub()
    : signInWithPopup(auth, githubProvider)
}

export async function linkGithubAccount(user: User) {
  if (!useNativeAuthentication) return linkWithPopup(user, githubProvider)

  const result = await FirebaseAuthentication.signInWithGithub()
  const accessToken = result.credential?.accessToken
  if (!accessToken) throw new Error('GitHub 登入未返回有效憑證')
  return linkWithCredential(user, GithubAuthProvider.credential(accessToken))
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
