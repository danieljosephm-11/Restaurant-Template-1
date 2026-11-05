import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

export function useApiQuery(path, { enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) return null;
      const requestId = ++requestRef.current;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await api(path);
        if (mounted.current && requestId === requestRef.current) {
          setData(result);
          return result;
        }
      } catch (err) {
        if (mounted.current && requestId === requestRef.current && err.name !== "AbortError") {
          setError(err);
        }
      } finally {
        if (mounted.current && requestId === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      return null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, enabled, ...deps]
  );

  useEffect(() => {
    setData(null);
    if (enabled) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { data, setData, error, loading, refreshing, refetch: load };
}

export function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · SmartDine`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export function useInterval(callback, delay) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);
  useEffect(() => {
    if (!delay) return undefined;
    const id = window.setInterval(() => saved.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}

export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useNow(interval = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}
