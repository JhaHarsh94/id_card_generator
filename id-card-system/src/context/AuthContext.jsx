import { useEffect, useMemo, useState } from 'react';
import { AuthContext } from './auth-context';
import { getSession, onAuthChange, signIn, signOut } from '../services/auth';

/**
 * AuthProvider
 * ---------------------------------------------------------------------------
 * Holds the current session and exposes login/logout to the tree. A failed
 * session lookup resolves to 'anonymous' rather than 'loading', so a backend
 * outage locks the admin area down instead of exposing it.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authed | anonymous

  useEffect(() => {
    let alive = true;

    getSession()
      .then((session) => {
        if (!alive) return;
        setUser(session);
        setStatus(session ? 'authed' : 'anonymous');
      })
      .catch(() => {
        if (!alive) return;
        setUser(null);
        setStatus('anonymous');
      });

    const unsubscribe = onAuthChange((next) => {
      if (!alive) return;
      setUser(next);
      setStatus(next ? 'authed' : 'anonymous');
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authed',
      isLoading: status === 'loading',
      async login(email, password) {
        const result = await signIn(email, password);
        if (result.ok) {
          setUser(result.user);
          setStatus('authed');
        }
        return result;
      },
      async logout() {
        await signOut();
        setUser(null);
        setStatus('anonymous');
      },
    }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}