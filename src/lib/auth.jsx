import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

/** Role groups mirrored from the server so the UI hides what the API would reject. */
export const GROUPS = {
  ADMINS: ['SuperAdmin', 'Admin'],
  MANAGEMENT: ['SuperAdmin', 'Admin', 'SalesManager'],
  SALES: ['SuperAdmin', 'Admin', 'SalesManager', 'SalesExecutive'],
  MARKETING: ['SuperAdmin', 'Admin', 'MarketingExecutive'],
  SUPPORT: ['SuperAdmin', 'Admin', 'CustomerSupport'],
  FINANCE: ['SuperAdmin', 'Admin', 'Finance'],
  STAFF: ['SuperAdmin', 'Admin', 'SalesManager', 'SalesExecutive', 'MarketingExecutive', 'CustomerSupport', 'Finance'],
};

/**
 * Whether this user loses sight of a record once they hand it to someone else.
 *
 * Someone on a narrow access level who reassigns a record immediately stops
 * being able to see it, so the forms warn before that happens rather than
 * letting it look like the save failed. This reads the level the server sent
 * with the session: it used to be a hardcoded list of role names here, which
 * silently stopped matching the moment an administrator changed a level under
 * Settings → Roles.
 */
export const isNarrowAccess = (user) => ['own', 'team'].includes(user?.accessLevel || 'own');

/** @deprecated Use `isNarrowAccess(user)`; access level is configurable per role. */
export const SCOPED_ROLES = ['SalesExecutive', 'MarketingExecutive'];

export const ROLE_LABEL = {
  SuperAdmin: 'Super Admin',
  Admin: 'Admin',
  SalesManager: 'Sales Manager',
  SalesExecutive: 'Sales Executive',
  MarketingExecutive: 'Marketing Executive',
  CustomerSupport: 'Customer Support',
  Finance: 'Finance',
  Customer: 'Customer',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.user);
  const [loading, setLoading] = useState(!!tokenStore.access);

  // Re-validate the stored session on boot so a revoked account cannot linger.
  useEffect(() => {
    if (!tokenStore.access) { setLoading(false); return; }
    api.get('/auth/me')
      .then((res) => { setUser(res.data); tokenStore.save({ user: res.data }); })
      .catch(() => { tokenStore.clear(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.mfaRequired) return { mfaRequired: true, email: res.data.email };
    tokenStore.save(res.data);
    setUser(res.data.user);
    return { user: res.data.user };
  }, []);

  const verifyMfa = useCallback(async (email, code) => {
    const res = await api.post('/auth/mfa/verify', { email, code, purpose: 'mfa' });
    tokenStore.save(res.data);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  const patchUser = useCallback((partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      tokenStore.save({ user: next });
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    verifyMfa,
    patchUser,
    isAuthenticated: !!user,
    /**
     * Role-level guard: pass an array of allowed role strings.
     * SuperAdmin always passes.
     */
    can: (roles) =>
      !roles || roles.length === 0 || (user && (user.role === 'SuperAdmin' || roles.includes(user.role))),
    /**
     * Permission-level guard driven by the Role matrix stored in the database.
     * Usage:
     *   hasPerm('leads.view')       — dot notation
     *   hasPerm('leads', 'view')    — module + action
     * SuperAdmin always passes (they have every permission seeded).
     * Admins/SuperAdmins are granted access by virtue of having all permissions seeded.
     */
    hasPerm: (moduleOrDot, action) => {
      if (!user) return false;
      if (user.role === 'SuperAdmin' || user.role === 'Admin') return true;
      const perm = action ? `${moduleOrDot}.${action}` : moduleOrDot;
      return Array.isArray(user.permissions) && user.permissions.includes(perm);
    },
  }), [user, loading, login, logout, verifyMfa, patchUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
