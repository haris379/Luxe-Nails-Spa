import { useCallback, useEffect, useState } from 'react';
import { api, parseError } from '../lib/api';

export function useFetch(url, params) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const key = JSON.stringify(params || {});

  const load = useCallback(() => {
    if (!url) return () => {};
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: '' }));
    api
      .get(url, { params: JSON.parse(key), signal: controller.signal })
      .then((res) => setState({ data: res.data.data, loading: false, error: '' }))
      .catch((err) => {
        if (err.code === 'ERR_CANCELED') return;
        setState({ data: null, loading: false, error: parseError(err).message });
      });
    return () => controller.abort();
  }, [url, key]);

  useEffect(() => {
    const cancel = load();
    return typeof cancel === 'function' ? cancel : undefined;
  }, [load]);
  return { ...state, reload: load };
}
