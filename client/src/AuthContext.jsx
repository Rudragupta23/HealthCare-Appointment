import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!tokenStore.get()) { setLoading(false); return; }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
      setDoctorProfile(data.doctorProfile || null);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const value = useMemo(() => ({
    user,
    doctorProfile,
    loading,
    refresh,
    async login(email, password) {
      const data = await api('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      tokenStore.set(data.token);
      setUser(data.user);
      await refresh();
      return data.user;
    },
    async register(payload) {
      const data = await api('/auth/register', { method: 'POST', body: payload, auth: false });
      tokenStore.set(data.token);
      setUser(data.user);
      return data.user;
    },
    logout() {
      tokenStore.clear();
      setUser(null);
      setDoctorProfile(null);
    },
  }), [user, doctorProfile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
