import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, CheckCheck, RefreshCw, X } from "lucide-react";
import {
  notificationDate, notificationError, notificationRequest, type NotificationInbox,
} from "./notifications";
import "./notifications.css";

type Props = { apiBase: string; token: string | null; isMobile: boolean };
type InboxStatus = "unread" | "read";

export function NotificationCenter({ apiBase, token, isMobile }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<InboxStatus>("unread");
  const [unread, setUnread] = useState(0);
  const [inbox, setInbox] = useState<NotificationInbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [error, setError] = useState("");
  const [reading, setReading] = useState<string[]>([]);
  const [readingAll, setReadingAll] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tokenRef = useRef(token);
  const openRef = useRef(open);
  const lastCountRef = useRef<number | null>(null);
  const inboxAbortRef = useRef<AbortController | null>(null);
  const readInFlightRef = useRef(false);
  const countRevisionRef = useRef(0);
  const authenticated = Boolean(token);

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    let busy = false;
    async function refreshCount() {
      if (busy || document.hidden || controller.signal.aborted || readInFlightRef.current) return;
      busy = true;
      const revision = countRevisionRef.current;
      try {
        const result = await notificationRequest<{ unread_count: number }>(
          apiBase, tokenRef.current, "/unread-count", { signal: controller.signal },
        );
        if (controller.signal.aborted || revision !== countRevisionRef.current || readInFlightRef.current) return;
        setUnread(result.unread_count);
        if (lastCountRef.current !== null && lastCountRef.current !== result.unread_count && openRef.current) {
          setRefreshVersion((version) => version + 1);
        }
        lastCountRef.current = result.unread_count;
      } catch {
        // Keep the last known count; opening the inbox exposes errors and a retry.
      } finally {
        busy = false;
      }
    }
    void refreshCount();
    const timer = window.setInterval(() => { void refreshCount(); }, 30_000);
    const refresh = () => { void refreshCount(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("atlas:notifications-sent", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("atlas:notifications-sent", refresh);
    };
  }, [apiBase, authenticated]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    inboxAbortRef.current = controller;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    void notificationRequest<NotificationInbox>(apiBase, tokenRef.current, `?limit=20&status=${status}`, {
      signal: controller.signal,
    }).then((result) => {
      if (controller.signal.aborted) return;
      setInbox(result);
      setUnread(result.unread_count);
      lastCountRef.current = result.unread_count;
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(notificationError(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => {
      controller.abort();
      inboxAbortRef.current?.abort();
    };
  }, [apiBase, open, refreshVersion, status]);

  async function loadMore() {
    if (!inbox || loading || loadingMore || readInFlightRef.current) return;
    const controller = new AbortController();
    inboxAbortRef.current = controller;
    setLoadingMore(true);
    setError("");
    try {
      const query = new URLSearchParams({
        limit: "20", offset: String(inbox.items.length), as_of: inbox.as_of, status,
      });
      const result = await notificationRequest<NotificationInbox>(
        apiBase, tokenRef.current, `?${query}`, { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setInbox((current) => current ? { ...result, items: [...current.items, ...result.items] } : result);
      setUnread(result.unread_count);
    } catch (cause) {
      if (!controller.signal.aborted) setError(notificationError(cause));
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  async function markRead(id: string) {
    if (readInFlightRef.current || loading || loadingMore) return;
    readInFlightRef.current = true;
    countRevisionRef.current += 1;
    setReading((current) => [...current, id]);
    setError("");
    try {
      const result = await notificationRequest<{ read_at: string; unread_count: number }>(
        apiBase, tokenRef.current, `/${id}/read`, { method: "POST" },
      );
      setInbox((current) => current ? {
        ...current, items: current.items.filter((item) => item.id !== id),
        total: Math.max(0, current.total - 1), unread_count: result.unread_count,
      } : current);
      setUnread(result.unread_count);
      lastCountRef.current = result.unread_count;
    } catch (cause) {
      setError(notificationError(cause));
    } finally {
      readInFlightRef.current = false;
      setReading((current) => current.filter((value) => value !== id));
    }
  }

  async function markAllRead() {
    if (!inbox || readInFlightRef.current || loading || loadingMore) return;
    readInFlightRef.current = true;
    countRevisionRef.current += 1;
    setReadingAll(true);
    setError("");
    try {
      const result = await notificationRequest<{ unread_count: number }>(
        apiBase, tokenRef.current, "/read-all", {
          method: "POST", body: JSON.stringify({ through: inbox.as_of }),
        },
      );
      setInbox((current) => current ? {
        ...current, items: [], total: 0, unread_count: result.unread_count,
      } : current);
      setUnread(result.unread_count);
      lastCountRef.current = result.unread_count;
      if (result.unread_count > 0) setRefreshVersion((version) => version + 1);
    } catch (cause) {
      setError(notificationError(cause));
    } finally {
      readInFlightRef.current = false;
      setReadingAll(false);
    }
  }

  function selectStatus(next: InboxStatus) {
    if (next === status || readInFlightRef.current) return;
    setInbox(null);
    setLoading(true);
    setStatus(next);
  }

  return (
    <div className={isMobile ? "notificationCenter notificationCenterMobile" : "notificationCenter"}>
      <button
        type="button"
        className={`notificationBell ${unread > 0 ? "notificationBellUnread" : ""}`}
        onClick={() => { setStatus("unread"); setInbox(null); setLoading(true); setOpen(true); }}
        aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notificações"
      >
        {unread > 0 ? <BellRing size={21} aria-hidden="true" /> : <Bell size={21} aria-hidden="true" />}
        {unread > 0 && <span className="notificationBadge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>
      <span className="notificationSrOnly" role="status">{unread > 0 ? `${unread} notificações não lidas` : "Nenhuma notificação não lida"}</span>
      <dialog
        ref={dialogRef}
        className="notificationDialog"
        aria-labelledby="notificationInboxTitle"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      >
        <div className="notificationInbox">
          <header className="notificationInboxHeader">
            <span className="notificationHeadingIcon"><Bell size={20} aria-hidden="true" /></span>
            <div>
              <h2 id="notificationInboxTitle">Notificações</h2>
              <p>{unread ? `${unread} ${unread === 1 ? "mensagem não lida" : "mensagens não lidas"}` : "Você está em dia"}</p>
            </div>
            <button type="button" className="notificationIconButton" onClick={() => setOpen(false)} aria-label="Fechar notificações">
              <X size={19} aria-hidden="true" />
            </button>
          </header>
          <div className="notificationInboxToolbar">
            <div className="notificationInboxFilters" role="group" aria-label="Filtrar notificações por leitura">
              <button type="button" aria-pressed={status === "unread"} onClick={() => selectStatus("unread")} disabled={readingAll || reading.length > 0}>Não lidas</button>
              <button type="button" aria-pressed={status === "read"} onClick={() => selectStatus("read")} disabled={readingAll || reading.length > 0}>Lidas</button>
            </div>
            {status === "unread" && <button type="button" className="notificationTextButton" onClick={() => void markAllRead()} disabled={!inbox || !unread || readingAll || reading.length > 0 || loading || loadingMore}>
              <CheckCheck size={15} aria-hidden="true" /> {readingAll ? "Salvando..." : "Ler todas"}
            </button>}
          </div>
          <div className="notificationInboxBody" aria-busy={loading}>
            {error && (
              <div className="notificationFeedback notificationFeedbackError" role="alert">
                <span>{error}</span>
                <button type="button" className="notificationTextButton" onClick={() => setRefreshVersion((version) => version + 1)}>
                  <RefreshCw size={14} aria-hidden="true" /> Tentar novamente
                </button>
              </div>
            )}
            {loading && <p className="notificationEmpty" role="status">Carregando notificações...</p>}
            {!loading && !error && !inbox?.items.length && (
              <div className="notificationEmpty">
                {status === "unread" ? <CheckCheck size={30} aria-hidden="true" /> : <Bell size={30} aria-hidden="true" />}
                <strong>{status === "unread" ? "Sem notificações pendentes" : "Nenhuma notificação lida"}</strong>
                <p>{status === "unread" ? "Os novos comunicados aparecerão aqui." : "As mensagens que você marcar como lidas ficarão aqui."}</p>
              </div>
            )}
            {!loading && inbox && inbox.items.map((item) => (
              <article className={`notificationItem ${!item.read_at ? "notificationItemUnread" : ""}`} key={item.id}>
                <div className="notificationItemMeta"><span>{item.sender_name}</span><time dateTime={item.created_at}>{notificationDate(item.created_at)}</time></div>
                <h3>{!item.read_at && <span className="notificationUnreadDot" aria-label="Não lida" />}{item.title}</h3>
                <p className="notificationMessage">{item.message}</p>
                {!item.read_at ? (
                  <button type="button" className="notificationTextButton" onClick={() => void markRead(item.id)} disabled={reading.length > 0 || readingAll || loadingMore}>
                    <Check size={14} aria-hidden="true" /> {reading.includes(item.id) ? "Salvando..." : "Marcar como lida"}
                  </button>
                ) : <span className="notificationReadLabel"><CheckCheck size={14} aria-hidden="true" /> Lida</span>}
              </article>
            ))}
            {!loading && inbox && inbox.items.length < inbox.total && (
              <button type="button" className="notificationMoreButton" disabled={loadingMore || readingAll || reading.length > 0} onClick={() => void loadMore()}>
                {loadingMore ? "Carregando..." : "Carregar mais"}
              </button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
