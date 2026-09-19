// Auth coordination for optional cloud accounts. Holds the signed-in user and
// wires Firebase Auth to the persistence layer: on sign-in it merges the
// guest's local data into the cloud (once) and switches the active provider to
// Firestore; on sign-out it switches back to the local guest store.
//
// When Firebase isn't configured, `available` is false and the app stays in
// local-only guest mode — no sign-in UI is shown and nothing throws.

import { create } from 'zustand';
import type { User } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from './persistence/firebase';
import { createCloudProvider } from './persistence/cloudProvider';
import { mergeLocalIntoCloud } from './persistence/sync';
import { localProvider, setActiveProvider } from './db';
import { GAMES } from './registry';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthState {
  /** Whether cloud accounts are available (Firebase configured). */
  available: boolean;
  status: AuthStatus;
  /** True while a local→cloud merge is in progress after sign-in. */
  syncing: boolean;
  user: AuthUser | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL };
}

function humanError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return '';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'That email is already linked to a different sign-in method.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in pop-up. Please allow pop-ups and try again.';
  }
  return 'Sign-in failed. Please try again.';
}

const gameIds = (): string[] => GAMES.map((g) => g.id);

export const useAuth = create<AuthState>((set) => {
  const available = isFirebaseConfigured();

  if (available) {
    // Load the Auth SDK on demand, then subscribe to sign-in state changes.
    void (async () => {
      const [{ onAuthStateChanged }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
      ]);
      onAuthStateChanged(auth, async (u) => {
        if (u) {
          set({ syncing: true });
          const cloud = await createCloudProvider(u.uid);
          try {
            await mergeLocalIntoCloud(localProvider, cloud, gameIds());
          } catch (err) {
            // A merge failure shouldn't block play; continue on the cloud store.
            console.error('Cloud data merge failed', err);
          }
          setActiveProvider(cloud);
          set({ status: 'signed-in', user: toAuthUser(u), syncing: false, error: null });
        } else {
          setActiveProvider(localProvider);
          set({ status: 'signed-out', user: null, syncing: false });
        }
      });
    })();
  }

  const signInWith = async (providerName: 'google' | 'github'): Promise<void> => {
    set({ error: null });
    try {
      const [{ GoogleAuthProvider, GithubAuthProvider, signInWithPopup }, auth] = await Promise.all([
        import('firebase/auth'),
        getFirebaseAuth(),
      ]);
      const provider =
        providerName === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      const message = humanError(err);
      if (message) set({ error: message });
    }
  };

  return {
    available,
    status: available ? 'loading' : 'signed-out',
    syncing: false,
    user: null,
    error: null,
    signInWithGoogle: () => signInWith('google'),
    signInWithGitHub: () => signInWith('github'),
    async signOut() {
      set({ error: null });
      try {
        const [{ signOut }, auth] = await Promise.all([
          import('firebase/auth'),
          getFirebaseAuth(),
        ]);
        await signOut(auth);
      } catch (err) {
        set({ error: humanError(err) || 'Sign-out failed.' });
      }
    },
  };
});
