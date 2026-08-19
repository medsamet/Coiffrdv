import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Chargement de données, sans dépendance externe.
 *
 * Deux détails qui évitent des bugs pénibles : on ignore la réponse d'une
 * requête devenue obsolète (l'utilisateur a changé de jour entre-temps), et on
 * n'écrit jamais dans l'état après démontage.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const runId = useRef(0);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  useEffect(() => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (!mounted.current || id !== runId.current) return;
        setData(result);
      })
      .catch((cause: unknown) => {
        if (!mounted.current || id !== runId.current) return;
        setError(cause instanceof Error ? cause.message : 'Une erreur est survenue.');
      })
      .finally(() => {
        if (!mounted.current || id !== runId.current) return;
        setLoading(false);
      });
    // `loader` change à chaque rendu : on se cale volontairement sur `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  return { data, error, loading, reload };
}
