import { useAuth } from './authStore';
import { GitHubIcon, GoogleIcon } from './ProviderIcons';
import { useShell } from './shellStore';

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
  const openStats = useShell((s) => s.openStats);

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
        <div className="account__actions">
          <button className="btn btn--subtle account__btn" onClick={openStats}>
            Your stats
          </button>
          <button className="btn btn--subtle account__btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="account">
      <span className="muted account__status">Save your progress across devices</span>
      <div className="account__actions">
        <button
          className="account__provider"
          onClick={() => void signInWithGoogle()}
          aria-label="Sign in with Google"
          title="Sign in with Google"
        >
          <GoogleIcon />
        </button>
        <button
          className="account__provider"
          onClick={() => void signInWithGitHub()}
          aria-label="Sign in with GitHub"
          title="Sign in with GitHub"
        >
          <GitHubIcon />
        </button>
      </div>
      {error ? <span className="account__error">{error}</span> : null}
    </div>
  );
}
