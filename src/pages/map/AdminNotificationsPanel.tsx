import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bell, Building2, CheckCheck, RefreshCw, Search, Send, Users, X } from "lucide-react";
import { fetchJson, normalizeSearchText } from "./shared";
import { showAppAlert } from "./alerts";
import { AdminButton } from "./AdminButton";
import {
  notificationDate, notificationError, notificationRequest,
  type NotificationHistory, type NotificationUser, type NotificationUserPage, type SentNotification,
} from "./notifications";
import "./notifications.css";

type Organization = { id: string; name: string; acronym: string };
type Props = { apiBase: string; token: string | null; isMobile: boolean };
type NotificationTab = "send" | "sent";
const HISTORY_PAGE_SIZE = 50;
const NOTIFICATION_TABS: Array<{ key: NotificationTab; label: string }> = [
  { key: "send", label: "Enviar Notificação" },
  { key: "sent", label: "Notificações Enviadas" },
];

export function AdminNotificationsPanel({ apiBase, token, isMobile }: Props) {
  const [activeTab, setActiveTab] = useState<NotificationTab>("send");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sendToAll, setSendToAll] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [users, setUsers] = useState<NotificationUserPage>({ items: [], total: 0 });
  const [usersLoading, setUsersLoading] = useState(true);
  const [userQuery, setUserQuery] = useState("");
  const [userOffset, setUserOffset] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<NotificationUser[]>([]);
  const [history, setHistory] = useState<NotificationHistory>({ items: [], total: 0 });
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [organizationError, setOrganizationError] = useState("");
  const [userError, setUserError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const tokenRef = useRef(token);
  const historyListRef = useRef<HTMLDivElement>(null);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { historyListRef.current?.scrollTo(0, 0); }, [historyOffset, historyQuery]);

  useEffect(() => {
    const controller = new AbortController();
    setOrganizationsLoading(true);
    setOrganizationError("");
    void fetchJson<Organization[]>(`${apiBase}/organizations`, {
      headers: { Authorization: `Bearer ${tokenRef.current}` }, signal: controller.signal,
    }).then((result) => {
      if (!controller.signal.aborted) setOrganizations(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setOrganizationError(notificationError(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setOrganizationsLoading(false);
    });
    return () => controller.abort();
  }, [apiBase, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setUsersLoading(true);
    setUserError("");
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ query: userQuery.trim(), limit: "50", offset: String(userOffset) });
      void notificationRequest<NotificationUserPage>(apiBase, tokenRef.current, `/recipients?${query}`, {
        signal: controller.signal,
      }).then((result) => {
        if (!controller.signal.aborted) setUsers(result);
      }).catch((cause: unknown) => {
        if (!controller.signal.aborted) setUserError(notificationError(cause));
      }).finally(() => {
        if (!controller.signal.aborted) setUsersLoading(false);
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [apiBase, userQuery, userOffset, reload]);

  useEffect(() => {
    if (activeTab !== "sent") return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistoryError("");
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({
        query: historyQuery.trim(), limit: String(HISTORY_PAGE_SIZE), offset: String(historyOffset),
      });
      void notificationRequest<NotificationHistory>(apiBase, tokenRef.current, `/sent?${query}`, {
        signal: controller.signal,
      }).then((result) => {
        if (!controller.signal.aborted) setHistory(result);
      }).catch((cause: unknown) => {
        if (!controller.signal.aborted) setHistoryError(notificationError(cause));
      }).finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [apiBase, activeTab, historyOffset, historyQuery, reload]);

  const visibleOrganizations = useMemo(() => {
    const query = normalizeSearchText(organizationQuery);
    return organizations.filter((organization) => normalizeSearchText(`${organization.name} ${organization.acronym}`).includes(query));
  }, [organizations, organizationQuery]);
  const selectedUserIds = useMemo(() => new Set(selectedUsers.map((user) => user.id)), [selectedUsers]);
  const hasRecipients = sendToAll || selectedOrganizations.length > 0 || selectedUsers.length > 0;

  function toggleOrganization(id: string) {
    setSuccess("");
    setSelectedOrganizations((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function toggleUser(user: NotificationUser) {
    setSuccess("");
    setSelectedUsers((current) => current.some((item) => item.id === user.id)
      ? current.filter((item) => item.id !== user.id) : [...current, user]);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || confirming) return;
    setError("");
    setSuccess("");
    if (!hasRecipients) { setError("Selecione pelo menos uma organização ou um usuário."); return; }
    setConfirming(true);
    try {
      const recipients = sendToAll
        ? "todos os usuários ativos do sistema com acesso válido"
        : [
            selectedOrganizations.length > 0
              ? `${selectedOrganizations.length} ${selectedOrganizations.length === 1 ? "organização selecionada" : "organizações selecionadas"}`
              : "",
            selectedUsers.length > 0
              ? `${selectedUsers.length} ${selectedUsers.length === 1 ? "usuário selecionado" : "usuários selecionados"}`
              : "",
          ].filter(Boolean).join(" e ");
      const confirmation = await showAppAlert({
        icon: sendToAll ? "warning" : "question",
        title: "Enviar notificação?",
        text: `Deseja enviar a notificação “${title.trim()}” para ${recipients}?`,
        showCancelButton: true,
        confirmButtonText: "Sim, enviar",
        cancelButtonText: "Cancelar",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!confirmation.isConfirmed) return;
      const finalConfirmation = await showAppAlert({
        icon: "warning",
        title: "Tem certeza?",
        text: `A notificação “${title.trim()}” será enviada para ${recipients}. Confirma o envio?`,
        showCancelButton: true,
        confirmButtonText: "Tenho certeza, enviar",
        cancelButtonText: "Cancelar",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!finalConfirmation.isConfirmed) return;
      setConfirming(false);
      setSending(true);
      const result = await notificationRequest<SentNotification>(apiBase, tokenRef.current, "", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(), message: message.trim(), send_to_all: sendToAll,
          organization_ids: sendToAll ? [] : selectedOrganizations,
          user_ids: sendToAll ? [] : selectedUsers.map((user) => user.id),
        }),
      });
      setSuccess(`Notificação enviada para ${result.recipient_count} ${result.recipient_count === 1 ? "usuário" : "usuários"}.`);
      setTitle("");
      setMessage("");
      setSendToAll(false);
      setSelectedOrganizations([]);
      setSelectedUsers([]);
      setHistoryOffset(0);
      setReload((version) => version + 1);
      window.dispatchEvent(new Event("atlas:notifications-sent"));
    } catch (cause) {
      setError(notificationError(cause));
    } finally {
      setConfirming(false);
      setSending(false);
    }
  }

  const tabs = NOTIFICATION_TABS.map((option) => (
    <button
      key={option.key}
      type="button"
      className={`subTab ${activeTab === option.key ? "subTabActive" : ""}`}
      onClick={() => setActiveTab(option.key)}
      aria-pressed={activeTab === option.key}
      aria-controls={activeTab === option.key ? `notification-${option.key}-section` : undefined}
    >
      {option.label}
    </button>
  ));

  return (
    <div className={`notificationsAdmin ${activeTab === "send" ? "notificationsAdminSend" : "notificationsAdminSent"}`}>
      {isMobile ? (
        <nav className="notificationModeMobile" aria-label="Seções de notificações">
          <span className="notificationModeLabel">MODO</span>
          <div className="notificationModeButtons">{tabs}</div>
        </nav>
      ) : (
        <nav className="tabsRail tabsRailSection tabsRailCompact" aria-label="Seções de notificações">
          {tabs}
        </nav>
      )}
      {activeTab === "send" && (
      <section id="notification-send-section" className="adminCard notificationComposer" aria-labelledby="notificationComposerTitle">
        <div className="notificationSectionHeading">
          <span className="notificationHeadingIcon"><Send size={21} aria-hidden="true" /></span>
          <div><h2 id="notificationComposerTitle">Enviar notificação</h2><p>Envie comunicados para organizações e pessoas da sua escolha.</p></div>
        </div>
        <form onSubmit={(event) => void send(event)}>
          <fieldset disabled={sending || confirming} className="notificationFormFields">
            <label className={`notificationBroadcast ${sendToAll ? "notificationBroadcastActive" : ""}`}>
              <input type="checkbox" checked={sendToAll} onChange={(event) => { setSendToAll(event.target.checked); setSuccess(""); }} />
              <span><strong>Enviar para todos</strong><small>Todos os usuários ativos do sistema com acesso válido.</small></span>
            </label>
            <div className="notificationComposeBody">
            <label className="notificationField notificationTitleField">
              <span>Título</span>
              <input value={title} onChange={(event) => { setTitle(event.target.value); setSuccess(""); }} maxLength={120} required placeholder="Ex.: Atualização das câmeras" />
            </label>
            <label className="notificationField notificationMessageField">
              <span>Mensagem <small>{message.length}/4000</small></span>
              <textarea value={message} onChange={(event) => { setMessage(event.target.value); setSuccess(""); }} maxLength={4000} required rows={5} placeholder="Escreva o comunicado que os destinatários receberão." />
            </label>
            <div className="notificationRecipientsGrid">
              {sendToAll ? (
                <div className="notificationAllRecipients" role="status">
                  <span className="notificationHeadingIcon"><Users size={24} aria-hidden="true" /></span>
                  <h3>Todos os usuários</h3>
                  <p>O comunicado será entregue aos usuários de todas as organizações e aos usuários sem organização.</p>
                </div>
              ) : (
              <>
              <section className="notificationRecipientPicker" aria-labelledby="notificationOrganizationsTitle">
                <h3 id="notificationOrganizationsTitle"><Building2 size={17} aria-hidden="true" /> Organizações <span>{selectedOrganizations.length}</span></h3>
                <p>Todos os usuários ativos das organizações selecionadas.</p>
                <label className="notificationSearch"><Search size={16} aria-hidden="true" /><input value={organizationQuery} onChange={(event) => setOrganizationQuery(event.target.value)} placeholder="Buscar organização" aria-label="Buscar organização" /></label>
                {organizationError && <p className="notificationInlineError" role="alert">{organizationError} <button type="button" className="notificationTextButton" onClick={() => setReload((version) => version + 1)}>Tentar novamente</button></p>}
                <div className="notificationChoices" aria-busy={organizationsLoading}>
                  {organizationsLoading ? <p className="notificationPickerEmpty">Carregando organizações...</p> : visibleOrganizations.map((organization) => (
                    <label className={`notificationChoice ${selectedOrganizations.includes(organization.id) ? "notificationChoiceSelected" : ""}`} key={organization.id}>
                      <input type="checkbox" checked={selectedOrganizations.includes(organization.id)} onChange={() => toggleOrganization(organization.id)} />
                      <span><strong>{organization.name}</strong><small>{organization.acronym}</small></span>
                    </label>
                  ))}
                  {!organizationsLoading && !organizationError && !visibleOrganizations.length && <p className="notificationPickerEmpty">Nenhuma organização encontrada.</p>}
                </div>
              </section>
              <section className="notificationRecipientPicker" aria-labelledby="notificationUsersTitle">
                <h3 id="notificationUsersTitle"><Users size={17} aria-hidden="true" /> Usuários <span>{selectedUsers.length}</span></h3>
                <p>Selecione pessoas para receber o comunicado diretamente.</p>
                <label className="notificationSearch"><Search size={16} aria-hidden="true" /><input value={userQuery} onChange={(event) => { setUserQuery(event.target.value); setUserOffset(0); }} maxLength={150} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuários por nome ou e-mail" /></label>
                {userError && <p className="notificationInlineError" role="alert">{userError} <button type="button" className="notificationTextButton" onClick={() => setReload((version) => version + 1)}>Tentar novamente</button></p>}
                <div className="notificationChoices" aria-busy={usersLoading}>
                  {usersLoading ? <p className="notificationPickerEmpty">Carregando usuários...</p> : users.items.map((user) => (
                    <label className={`notificationChoice ${selectedUserIds.has(user.id) ? "notificationChoiceSelected" : ""}`} key={user.id}>
                      <input type="checkbox" checked={selectedUserIds.has(user.id)} onChange={() => toggleUser(user)} />
                      <span><strong>{user.full_name || user.email}</strong><small>{user.email}</small>{user.organization_name && <small>{user.organization_name}</small>}</span>
                    </label>
                  ))}
                  {!usersLoading && !userError && !users.items.length && <p className="notificationPickerEmpty">Nenhum usuário encontrado.</p>}
                </div>
                {users.total > 50 && <div className="notificationPagination">
                  <button type="button" className="notificationTextButton" disabled={userOffset === 0 || usersLoading} onClick={() => setUserOffset((offset) => Math.max(0, offset - 50))}>Anterior</button>
                  <span>{userOffset + 1}–{Math.min(userOffset + 50, users.total)} de {users.total}</span>
                  <button type="button" className="notificationTextButton" disabled={userOffset + 50 >= users.total || usersLoading} onClick={() => setUserOffset((offset) => offset + 50)}>Próxima</button>
                </div>}
              </section>
              </>
              )}
            </div>
            {!sendToAll && hasRecipients && <div className="notificationSelectedRecipients" aria-label="Destinatários selecionados">
              {organizations.filter((organization) => selectedOrganizations.includes(organization.id)).map((organization) => (
                <button type="button" className="notificationRecipientChip" key={organization.id} onClick={() => toggleOrganization(organization.id)} aria-label={`Remover organização ${organization.name}`}>
                  <Building2 size={13} aria-hidden="true" /><span>{organization.name}</span><X size={13} aria-hidden="true" />
                </button>
              ))}
              {selectedUsers.map((user) => (
                <button type="button" className="notificationRecipientChip" key={user.id} onClick={() => toggleUser(user)} aria-label={`Remover usuário ${user.full_name || user.email}`}>
                  <Users size={13} aria-hidden="true" /><span>{user.full_name || user.email}</span><X size={13} aria-hidden="true" />
                </button>
              ))}
            </div>}
            </div>
            <div className="notificationSendFooter">
              <p>{sendToAll ? "Cada usuário receberá uma única notificação." : "Quem estiver em mais de uma seleção receberá uma única notificação."}</p>
              <AdminButton type="submit" variant="primary" icon={Send} loading={sending} disabled={!hasRecipients || !title.trim() || !message.trim() || confirming}>
                {sending ? "Enviando..." : confirming ? "Confirmando..." : "Enviar notificação"}
              </AdminButton>
            </div>
          </fieldset>
        </form>
        {error && <div className="notificationFeedback notificationFeedbackError" role="alert">{error}</div>}
        {success && <div className="notificationFeedback notificationFeedbackSuccess" role="status"><CheckCheck size={18} aria-hidden="true" />{success}</div>}
      </section>
      )}

      {activeTab === "sent" && (
      <section id="notification-sent-section" className="adminCard notificationSent" aria-labelledby="notificationSentTitle">
        <div className="notificationSectionHeading"><span className="notificationHeadingIcon"><Bell size={21} aria-hidden="true" /></span><div><h2 id="notificationSentTitle">Notificações enviadas</h2><p>Histórico dos comunicados da administração.</p></div></div>
        <div className="notificationHistoryToolbar">
          <label className="notificationSearch">
            <Search size={16} aria-hidden="true" />
            <input
              value={historyQuery}
              onChange={(event) => { setHistoryQuery(event.target.value); setHistoryOffset(0); }}
              maxLength={150}
              placeholder="Filtrar por título, mensagem ou remetente"
              aria-label="Filtrar notificações enviadas por título, mensagem ou remetente"
            />
            {historyQuery && (
              <button type="button" className="notificationIconButton" onClick={() => { setHistoryQuery(""); setHistoryOffset(0); }} aria-label="Limpar filtro de notificações">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
          <AdminButton size="icon" icon={RefreshCw} loading={historyLoading} onClick={() => setReload((version) => version + 1)} aria-label="Atualizar notificações enviadas" title="Atualizar notificações enviadas" />
          <span className="notificationHistoryCount" role="status">
            {historyLoading ? "Buscando..." : `${history.total} ${history.total === 1 ? "notificação" : "notificações"}`}
          </span>
        </div>
        <div className="notificationHistoryList" ref={historyListRef} aria-busy={historyLoading}>
        {historyError && <div className="notificationFeedback notificationFeedbackError" role="alert">{historyError} <button type="button" className="notificationTextButton" onClick={() => setReload((version) => version + 1)}>Tentar novamente</button></div>}
        {historyLoading ? <p className="notificationPickerEmpty" role="status">Carregando histórico...</p> : history.items.map((item) => (
          <article className="notificationSentItem" key={item.id}>
            <div className="notificationItemMeta"><span>{item.sender_name}</span><time dateTime={item.created_at}>{notificationDate(item.created_at)}</time></div>
            <h3>{item.title}</h3><p className="notificationMessage">{item.message}</p>
            <span className="notificationDeliveryCount"><Users size={14} aria-hidden="true" /> Enviada para {item.recipient_count} {item.recipient_count === 1 ? "usuário" : "usuários"}</span>
          </article>
        ))}
        {!historyLoading && !historyError && !history.items.length && <p className="notificationPickerEmpty">{historyQuery.trim() ? "Nenhuma notificação encontrada para esse filtro." : "Nenhuma notificação enviada ainda."}</p>}
        </div>
        {history.total > HISTORY_PAGE_SIZE && (
          <nav className="notificationPagination notificationHistoryPagination" aria-label="Paginação das notificações enviadas">
            <button type="button" className="btnGhost" disabled={historyOffset === 0 || historyLoading} onClick={() => setHistoryOffset((offset) => Math.max(0, offset - HISTORY_PAGE_SIZE))}>Anterior</button>
            <span>Página {Math.floor(historyOffset / HISTORY_PAGE_SIZE) + 1} de {Math.max(1, Math.ceil(history.total / HISTORY_PAGE_SIZE))}</span>
            <button type="button" className="btnGhost" disabled={historyOffset + HISTORY_PAGE_SIZE >= history.total || historyLoading} onClick={() => setHistoryOffset((offset) => offset + HISTORY_PAGE_SIZE)}>Próxima</button>
          </nav>
        )}
      </section>
      )}
    </div>
  );
}
