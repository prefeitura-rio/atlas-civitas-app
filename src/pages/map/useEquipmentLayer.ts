import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "./shared";

type Options<T> = {
  url: string;
  token: string;
  scope: string;
  enabled: boolean;
  normalize: (value: unknown) => T[];
  failureMessage: string;
};

export function useEquipmentLayer<T>({
  url, token, scope, enabled, normalize, failureMessage,
}: Options<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef(token);
  const inFlight = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);
  tokenRef.current = token;

  const reload = useCallback((): Promise<void> => {
    if (!enabled) return Promise.resolve();
    if (inFlight.current) return inFlight.current.promise;

    const controller = new AbortController();
    setLoading(true);
    const promise = (async () => {
      try {
        const result = await fetchJson<unknown>(url, {
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setData(normalize(result));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : failureMessage;
        if (/^(401|403)\b/.test(message)) {
          setData([]);
        } else {
          console.error(error);
          window.alert(message || failureMessage);
        }
      } finally {
        if (inFlight.current?.controller === controller) {
          inFlight.current = null;
          if (!controller.signal.aborted) setLoading(false);
        }
      }
    })();
    inFlight.current = { controller, promise };
    return promise;
  }, [enabled, url, normalize, failureMessage]);

  useEffect(() => {
    let active = true;
    // StrictMode remounts effects immediately; start only the surviving request.
    queueMicrotask(() => {
      if (!active) return;
      setData([]);
      if (enabled) void reload();
      else setLoading(false);
    });
    return () => {
      active = false;
      inFlight.current?.controller.abort();
      inFlight.current = null;
    };
  }, [scope, enabled, reload]);

  return { data, loading, reload };
}
