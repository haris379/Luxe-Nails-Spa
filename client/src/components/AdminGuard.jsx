import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api, getToken, setToken } from '../lib/api';

/**
 * Asks the server whether the stored token is a valid admin session.
 * State: 'checking' | 'authed' | 'anon' | 'error' (server unreachable).
 * Having a token in storage is never treated as proof of being an admin.
 */
function useAdminSession() {
  const [state, setState] = useState(getToken() ? 'checking' : 'anon');
  const [attempt, setAttempt] = useState(0);
  const [admin, setAdmin] = useState(null); // { email, role, permissions } exactly as the server reports it

  useEffect(() => {
    if (!getToken()) {
      setState('anon');
      return undefined;
    }
    let live = true;
    setState('checking');
    api
      .get('/admin/me', { skipAuthRedirect: true })
      .then((res) => { if (live) { setAdmin(res.data.data); setState('authed'); } })
      .catch((err) => {
        if (!live) return;
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          setToken(null); // invalid, expired or revoked token
          setState('anon');
        } else {
          setState('error');
        }
      });
    return () => { live = false; };
  }, [attempt]);

  return { state, admin, retry: () => setAttempt((a) => a + 1) };
}

function FullPageSpinner() {
  return (
    <div role="status" className="flex min-h-screen items-center justify-center gap-2 text-ink-soft">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Checking your session…
    </div>
  );
}

/** Wraps admin-only pages. Renders nothing from the dashboard until the server confirms the admin. */
export function RequireAdmin() {
  const { state, admin, retry } = useAdminSession();
  if (state === 'checking') return <FullPageSpinner />;
  if (state === 'anon') return <Navigate to="/admin/login" replace />;
  if (state === 'error') {
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-ink-soft">We could not reach the server to verify your session.</p>
        <button type="button" className="btn btn-outline" onClick={retry}>Try again</button>
      </div>
    );
  }
  // The dashboard learns the role and permissions from here (the server's answer, never from browser storage).
  return <Outlet context={{ admin }} />;
}

/** Wraps the login page: a verified admin is sent straight to the dashboard. */
export function GuestOnly() {
  const { state } = useAdminSession();
  if (state === 'checking') return <FullPageSpinner />;
  if (state === 'authed') return <Navigate to="/admin" replace />;
  return <Outlet />;
}
