import { useAuth } from './authStore';

/**
 * Account controls shown on the hub. When signed out it offers Google / GitHub
 * sign-in; when signed in it shows the user and a sign-out button. Renders
 * nothing when cloud accounts aren't configured (local-only guest mode).
 */
export function AccountMenu() {
  const available = useAuth((s) => s.available);
  const status = useAuth((s) => s.status);
  const syncing = useAuth((s) => s.syncing);
  const user = useAuth((s) => s.user);
  const error = useAuth((s) => s.error);
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const signInWithGitHub = useAuth((s) => s.signInWithGitHub);
  const signOut = useAuth((s) => s.signOut);

  if (!available) return null;

  if (status === 'loading') {
    return (
      <div className="account">
        <span className="muted account__status">Checking sign-in…</span>
      </div>
    );
  }

  if (status === 'signed-in' && user) {
    const name = user.displayName ?? user.email ?? 'Signed in';
    return (
      <div className="account">
        <div className="account__user">
          {user.photoURL ? (
            <img className="account__avatar" src={user.photoURL} alt="" width={28} height={28} />
          ) : null}
          <span className="account__name" title={name}>
            {name}
          </span>
        </div>
        {syncing ? <span className="muted account__status">Syncing…</span> : null}
        <button className="btn btn--subtle account__btn" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="account">
      <span className="muted account__status">Save your progress across devices</span>
      <div className="account__actions">
        <button className="btn btn--subtle account__btn" onClick={() => void signInWithGoogle()}>
          Sign in with Google
        </button>
        <button className="btn btn--subtle account__btn" onClick={() => void signInWithGitHub()}>
          Sign in with GitHub
        </button>
      </div>
      {error ? <span className="account__error">{error}</span> : null}
    </div>
  );
}
