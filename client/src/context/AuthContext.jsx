import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getStoredToken, storeToken } from "../lib/api.js";
import { closeSocket } from "../lib/socket.js";

const AuthContext = createContext(null);
const USER_KEY = "smartdine.user";
const RESTAURANT_KEY = "smartdine.restaurant";

function readStored(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => readStored(USER_KEY));
  const [restaurant, setRestaurant] = useState(() => readStored(RESTAURANT_KEY));
  const [loading, setLoading] = useState(!!getStoredToken());

  const persist = useCallback((nextToken, nextUser, nextRestaurant) => {
    setToken(nextToken || null);
    setUser(nextUser || null);
    setRestaurant(nextRestaurant || null);
    storeToken(nextToken || null);
    try {
      if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      else localStorage.removeItem(USER_KEY);
      if (nextRestaurant) localStorage.setItem(RESTAURANT_KEY, JSON.stringify(nextRestaurant));
      else localStorage.removeItem(RESTAURANT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const existing = getStoredToken();
    if (!existing) {
      setLoading(false);
      return undefined;
    }
    api("/auth/me", { token: existing })
      .then((data) => {
        if (cancelled) return;
        persist(existing, data.user, data.restaurant);
      })
      .catch(() => {
        if (cancelled) return;
        persist(null, null, null);
        closeSocket();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const login = useCallback(
    async (email, password) => {
      const data = await api("/auth/login", { method: "POST", body: { email, password }, token: null });
      persist(data.token, data.user, data.restaurant);
      return data.user;
    },
    [persist]
  );

  const logout = useCallback(() => {
    persist(null, null, null);
    closeSocket();
  }, [persist]);

  const value = useMemo(
    () => ({ token, user, restaurant, loading, login, logout }),
    [token, user, restaurant, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
