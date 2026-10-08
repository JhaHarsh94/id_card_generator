import { createContext, useContext } from 'react';

/**
 * Auth context object, kept separate from the provider so that
 * `AuthContext.jsx` exports only a component and fast refresh keeps working.
 */
export const AuthContext = createContext(null);

/**
 * `status` is tri-state on purpose: 'loading' must be distinguishable from
 * 'anonymous', otherwise protected routes would briefly render and then
 * redirect, flashing dashboard content to an unauthenticated visitor.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}