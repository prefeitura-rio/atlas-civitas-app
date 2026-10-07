import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, Download, FileDown, Loader2, Radio, RefreshCw, Search, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { fetchJson } from "./shared";
import "./usage-dashboard.css";

type UsageSummary = {
  range?: { from?: string; to?: string };
  totals?: {
    events?: number;
    logins?: number;
    report_downloads?: number;
    camera_views?: number;
    camera_sessions?: number;
    camera_smart_sessions?: number;
    camera_accesses?: number;
    distinct_users?: number;
    distinct_organizations?: number;
    sessions?: number;
    open_sessions?: number;
    closed_sessions?: number;
  };
  recent_events?: TimelineItem[];
};

type RankedItem = {
  id?: string;
  user_id?: string;
  organization_id?: string;
  name?: string;
  full_name?: string;
  email?: string;
  organization_name?: string;
  logins?: number;
  report_downloads?: number;
  camera_views?: number;
  camera_sessions?: number;
  camera_smart_sessions?: number;
  camera_accesses?: number;
  sessions?: number;
  total_events?: number;
  count?: number;
  total?: number;
  value?: number;
  last_activity_at?: string | null;
  daily_activity?: Array<{ date: string; count: number; sessions: number; downloads: number; camera_accesses: number }>;
};

type ReportDownloadItem = {
  event_id?: string;
  downloaded_at?: string;
  file_hash?: string;
  selection_hash?: string;
  download_url?: string | null;
  report?: {
    id?: string;
    name?: string;
    report_type?: string;
    status?: string;
    requested_at?: string;
    download_url?: string | null;
  } | null;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
  organization?: {
    id?: string;
    name?: string;
  } | null;
};

type TimelineItem = {
  id?: string;
  created_at?: string;
  user_name?: string;
  user_email?: string;
  title?: string;
  action?: string;
  target?: string;
  type?: string;
  event_id?: string;
  downloaded_at?: string;
  accessed_at?: string;
};

function startOfDayIso(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function niceNumber(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR").format(num);
}

function normalizeList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (typeof data !== "object" || data === null) return [];
  const payload = data as Record<string, unknown>;
  if (Array.isArray(payload.items)) return payload.items as T[];
  if (Array.isArray(payload.results)) return payload.results as T[];
  if (Array.isArray(payload.data)) return payload.data as T[];
  return [];
}

function getSummaryTotal(summary: UsageSummary | null | undefined, key: keyof NonNullable<UsageSummary["totals"]>) {
  return Number(summary?.totals?.[key] ?? 0);
}

function getRankedItemTotal(item: RankedItem) {
  return Number(item.total_events ?? item.count ?? item.total ?? item.value ?? 0);
}

function getCameraAccessTotal(item: RankedItem) {
  if (item.camera_accesses != null) return Number(item.camera_accesses);
  const cameraViews = Number(item.camera_views ?? 0);
  const cameraSessions = Number(item.camera_sessions ?? 0);
  const smartSessions = Number(item.camera_smart_sessions ?? 0);
  return cameraViews + cameraSessions + smartSessions;
}

function getSummaryCameraAccessTotal(summary: UsageSummary | null | undefined) {
  const explicitTotal = Number(summary?.totals?.camera_accesses ?? NaN);
  if (Number.isFinite(explicitTotal)) return explicitTotal;
  return (
    Number(summary?.totals?.camera_views ?? 0) +
    Number(summary?.totals?.camera_sessions ?? 0) +
    Number(summary?.totals?.camera_smart_sessions ?? 0)
  );
}

function rankedItemBreakdown(item: RankedItem) {
  const parts = [
    `${niceNumber(item.logins ?? 0)} logins`,
    `${niceNumber(item.report_downloads ?? 0)} downloads`,
    `${niceNumber(getCameraAccessTotal(item))} acessos câmera`,
  ];
  return parts.join(" • ");
}

function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

const USERS_PAGE_SIZE = 3;
const ORGANIZATIONS_PAGE_SIZE = 3;
const REPORT_DOWNLOADS_PAGE_SIZE = 5;

function PaginationControls({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div
      className="pageControls"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}
    >
      <button
        type="button"
        className="btnGhost"
        onClick={onPrev}
        disabled={page <= 1}
        style={{ opacity: page <= 1 ? 0.5 : 1 }}
      >
        Anterior
      </button>
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        Página {page} de {totalPages}
      </div>
      <button
        type="button"
        className="btnGhost"
        onClick={onNext}
        disabled={page >= totalPages}
        style={{ opacity: page >= totalPages ? 0.5 : 1 }}
      >
        Próxima
      </button>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "navy",
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "navy" | "aqua" | "violet" | "gold";
}) {
  return (
    <div className={`usageMetricCard usageMetricCard-${tone}`}>
      <div className="usageMetricTop">
        <span className="usageMetricLabel">{label}</span>
        <span className="usageMetricIcon"><Icon size={19} strokeWidth={1.8} aria-hidden="true" /></span>
      </div>
      <div className="usageMetricValue">{value}</div>
      <div className="usageMetricHint">{hint}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="usageSectionTitle">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function AdminUsageDashboardPanel({
  apiBase,
  token,
  isMobile,
}: {
  apiBase: string;
  token: string;
  isMobile: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(() => startOfDayIso(30));
  const [to, setTo] = useState(() => startOfDayIso(0));
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [topUsers, setTopUsers] = useState<RankedItem[]>([]);
  const [topOrganizations, setTopOrganizations] = useState<RankedItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [organizationSearch, setOrganizationSearch] = useState("");
  const [reportDownloads, setReportDownloads] = useState<ReportDownloadItem[]>([]);
  const [reportSearch, setReportSearch] = useState("");
  const [downloadingReportKey, setDownloadingReportKey] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [organizationsPage, setOrganizationsPage] = useState(1);
  const [downloadsPage, setDownloadsPage] = useState(1);

  const summaryUrl = useMemo(() => `${apiBase}/admin/dashboard/usage/summary`, [apiBase]);
  const topUsersUrl = useMemo(() => `${apiBase}/admin/dashboard/usage/top-users`, [apiBase]);
  const topOrgsUrl = useMemo(() => `${apiBase}/admin/dashboard/usage/top-organizations`, [apiBase]);
  const reportDownloadsUrl = useMemo(() => `${apiBase}/admin/dashboard/usage/report-downloads`, [apiBase]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams({ from, to });
      const headers = { Authorization: `Bearer ${token}` };
      const [summaryData, usersData, orgData, downloadsData] = await Promise.all([
        fetchJson<unknown>(`${summaryUrl}?${params}`, { headers }),
        fetchJson<unknown>(`${topUsersUrl}?${params}&limit=100`, { headers }),
        fetchJson<unknown>(`${topOrgsUrl}?${params}&limit=0`, { headers }),
        fetchJson<unknown>(`${reportDownloadsUrl}?${params}&limit=20`, { headers }),
      ]);

      const summaryPayload = Array.isArray(summaryData)
        ? summaryData[0]
        : typeof summaryData === "object" && summaryData !== null && "data" in summaryData
          ? summaryData.data
          : summaryData;
      setSummary((summaryPayload as UsageSummary | null) ?? null);
      setTopUsers(normalizeList<RankedItem>(usersData));
      setTopOrganizations(normalizeList<RankedItem>(orgData));
      setReportDownloads(normalizeList<ReportDownloadItem>(downloadsData));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao carregar métricas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredReportDownloads = useMemo(() => {
    const term = reportSearch.trim().toLowerCase();
    if (!term) return reportDownloads;
    return reportDownloads.filter((item) => {
      const haystack = [
        item.user?.name,
        item.user?.email,
        item.organization?.name,
        item.report?.name,
        item.report?.report_type,
        item.event_id,
        item.selection_hash,
        item.file_hash,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }, [reportDownloads, reportSearch]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return topUsers;
    return topUsers.filter((item) =>
      [
        item.full_name,
        item.name,
        item.email,
        item.organization_name,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(term)
    );
  }, [topUsers, userSearch]);

  const filteredOrganizations = useMemo(() => {
    const term = organizationSearch.trim().toLowerCase();
    if (!term) return topOrganizations;
    return topOrganizations.filter((item) =>
      [
        item.organization_name,
        item.name,
        item.email,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ")
        .includes(term)
    );
  }, [topOrganizations, organizationSearch]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const organizationsTotalPages = Math.max(1, Math.ceil(filteredOrganizations.length / ORGANIZATIONS_PAGE_SIZE));
  const downloadsTotalPages = Math.max(1, Math.ceil(filteredReportDownloads.length / REPORT_DOWNLOADS_PAGE_SIZE));
  const paginatedUsers = paginateItems(filteredUsers, Math.min(usersPage, usersTotalPages), USERS_PAGE_SIZE);
  const paginatedOrganizations = paginateItems(filteredOrganizations, Math.min(organizationsPage, organizationsTotalPages), ORGANIZATIONS_PAGE_SIZE);
  const paginatedReportDownloads = paginateItems(filteredReportDownloads, Math.min(downloadsPage, downloadsTotalPages), REPORT_DOWNLOADS_PAGE_SIZE);
  const topUserActivity = Math.max(1, ...filteredUsers.map(getRankedItemTotal));
  const topOrganizationActivity = Math.max(1, ...filteredOrganizations.map(getRankedItemTotal));

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, topUsers, from, to]);

  useEffect(() => {
    setOrganizationsPage(1);
  }, [organizationSearch, topOrganizations, from, to]);

  useEffect(() => {
    setDownloadsPage(1);
  }, [reportSearch, reportDownloads, from, to]);

  useEffect(() => {
    if (usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [usersPage, usersTotalPages]);

  useEffect(() => {
    if (organizationsPage > organizationsTotalPages) setOrganizationsPage(organizationsTotalPages);
  }, [organizationsPage, organizationsTotalPages]);

  useEffect(() => {
    if (downloadsPage > downloadsTotalPages) setDownloadsPage(downloadsTotalPages);
  }, [downloadsPage, downloadsTotalPages]);

  function reportDownloadKey(item: ReportDownloadItem, index: number) {
    return item.event_id || item.report?.id || item.file_hash || `download-${index}`;
  }

  async function downloadReportFile(pathOrUrl: string, fallbackName: string) {
    const clean = String(pathOrUrl || "").trim();
    if (!clean) throw new Error("URL de download inválida.");
    const url = /^https?:\/\//i.test(clean)
      ? clean
      : `${apiBase}${clean.startsWith("/") ? "" : "/"}${clean}`;

    const res = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Falha no download (${res.status}) ${res.statusText}`);
    }

    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }

  async function resolveReportDownloadUrl(item: ReportDownloadItem) {
    if (item.download_url) return item.download_url;
    if (item.report?.download_url) return item.report.download_url;
    if (!item.report?.id) return null;
    return `${apiBase}/reports/${encodeURIComponent(String(item.report.id))}/download`;
  }

  async function handleDownloadReport(item: ReportDownloadItem, index: number) {
    const key = reportDownloadKey(item, index);
    setDownloadingReportKey(key);
    try {
      const downloadUrl = await resolveReportDownloadUrl(item);
      if (!downloadUrl) {
        throw new Error("Este relatório ainda não expôs uma URL de download.");
      }
      const safeName = (item.report?.name || item.report?.report_type || item.user?.name || "relatorio")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .toLowerCase();
      await downloadReportFile(downloadUrl, `${safeName}.pdf`);
    } finally {
      setDownloadingReportKey(null);
    }
  }

  const summaryCards = [
    { label: "Atividades", value: niceNumber(getSummaryTotal(summary, "events")), hint: "Eventos registrados no período", icon: Activity, tone: "navy" as const },
    { label: "Sessões", value: niceNumber(getSummaryTotal(summary, "sessions")), hint: "Logins efetivos no período", icon: ShieldCheck, tone: "aqua" as const },
    { label: "Downloads", value: niceNumber(getSummaryTotal(summary, "report_downloads")), hint: "Relatórios exportados", icon: FileDown, tone: "gold" as const },
    { label: "Streaming", value: niceNumber(getSummaryCameraAccessTotal(summary)), hint: "Acessos a câmeras", icon: Radio, tone: "violet" as const },
    { label: "Usuários ativos", value: niceNumber(getSummaryTotal(summary, "distinct_users")), hint: "Pessoas distintas no período", icon: Users, tone: "navy" as const },
    { label: "Organizações", value: niceNumber(getSummaryTotal(summary, "distinct_organizations")), hint: "Organizações com atividade", icon: Building2, tone: "aqua" as const },
  ];

  return (
    <div className="usageDashboard">
      <section className="usageHero" aria-labelledby="usageHeroTitle">
        <div className="usageHeroCopy">
          <span className="usageEyebrow"><ShieldCheck size={15} aria-hidden="true" /> PAINEL DE USO</span>
          <h2 id="usageHeroTitle">Métricas da plataforma</h2>
          <p>Acompanhe atividades, pessoas, organizações e acesso aos recursos da CIVITAS.</p>
        </div>
        <div className="usageFilters" aria-label="Período das métricas">
          <div className="usageFilterHeading">Período de análise</div>
          <div className="usageDateFields">
            <label>De<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>Até<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <div className="usageFilterActions">
            <button type="button" className="usagePreset" onClick={() => { setFrom(startOfDayIso(7)); setTo(startOfDayIso(0)); }}>7 dias</button>
            <button type="button" className="usagePreset" onClick={() => { setFrom(startOfDayIso(30)); setTo(startOfDayIso(0)); }}>30 dias</button>
            <button type="button" className="usageRefresh" onClick={load} disabled={loading}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {loading ? "Atualizando" : "Atualizar"}
            </button>
          </div>
        </div>
      </section>

      {err && <div className="usageError" role="alert">{err}</div>}

      <div className="usageViewContent">
      <div className="usageBlockHeading"><h2>Indicadores principais</h2><p>Selecione um período e clique em Atualizar</p></div>
      <div className="usageMetricGrid">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="usageBlockHeading"><h2>Quem mais utiliza</h2><p>Atividades por pessoa e organização</p></div>
      <div className="usageRankingsGrid">
        <section className="usagePanel">
          <SectionTitle title="Usuários" subtitle="Ranking de top usuários" />
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(15,23,42,0.45)" }} />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Filtrar por nome do usuário"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 14, border: "1px solid rgba(10,40,75,0.12)", background: "rgba(255,255,255,0.96)", color: "#0f172a" }}
            />
          </div>
          <div className="usageList">
            {paginatedUsers.map((item, index) => (
              <div className="usageListRow" key={item.id || item.user_id || index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 18, background: "rgba(248,250,252,0.98)", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: ((Math.min(usersPage, usersTotalPages) - 1) * USERS_PAGE_SIZE + index + 1) <= 3 ? "#0a284b" : "rgba(10,40,75,0.08)", color: ((Math.min(usersPage, usersTotalPages) - 1) * USERS_PAGE_SIZE + index + 1) <= 3 ? "#fff" : "#0a284b" }}>
                  {(Math.min(usersPage, usersTotalPages) - 1) * USERS_PAGE_SIZE + index + 1}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.full_name || item.name || item.email || "Usuário"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.64)" }}>{rankedItemBreakdown(item)}</div>
                  <div className="usageRankTrack"><span style={{ width: `${Math.max(2, getRankedItemTotal(item) / topUserActivity * 100)}%` }} /></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950, color: "#0a284b" }}>{niceNumber(getRankedItemTotal(item))}</div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: "rgba(15,23,42,0.50)" }}>atividades</div>
                </div>
              </div>
            ))}
            {!filteredUsers.length && !loading && <div style={{ fontSize: 13, color: "rgba(15,23,42,0.60)" }}>Nenhum usuário encontrado.</div>}
          </div>
          <PaginationControls
            page={Math.min(usersPage, usersTotalPages)}
            totalPages={usersTotalPages}
            onPrev={() => setUsersPage((page) => Math.max(1, page - 1))}
            onNext={() => setUsersPage((page) => Math.min(usersTotalPages, page + 1))}
          />
        </section>

        <section className="usagePanel">
          <SectionTitle title="Organizações" subtitle="Ranking de top organizações" />
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(15,23,42,0.45)" }} />
            <input
              value={organizationSearch}
              onChange={(e) => setOrganizationSearch(e.target.value)}
              placeholder="Filtrar por nome da organização"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 14, border: "1px solid rgba(10,40,75,0.12)", background: "rgba(255,255,255,0.96)", color: "#0f172a" }}
            />
          </div>
          <div className="usageList">
            {paginatedOrganizations.map((item, index) => (
              <div className="usageListRow" key={item.id || item.organization_id || index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 18, background: "rgba(248,250,252,0.98)", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: ((Math.min(organizationsPage, organizationsTotalPages) - 1) * ORGANIZATIONS_PAGE_SIZE + index + 1) <= 3 ? "#0a284b" : "rgba(10,40,75,0.08)", color: ((Math.min(organizationsPage, organizationsTotalPages) - 1) * ORGANIZATIONS_PAGE_SIZE + index + 1) <= 3 ? "#fff" : "#0a284b" }}>
                  {(Math.min(organizationsPage, organizationsTotalPages) - 1) * ORGANIZATIONS_PAGE_SIZE + index + 1}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.organization_name || item.name || "Organização"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.64)" }}>{rankedItemBreakdown(item)}</div>
                  <div className="usageRankTrack"><span style={{ width: `${Math.max(2, getRankedItemTotal(item) / topOrganizationActivity * 100)}%` }} /></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950, color: "#0a284b" }}>{niceNumber(getRankedItemTotal(item))}</div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: "rgba(15,23,42,0.50)" }}>atividades</div>
                </div>
              </div>
            ))}
            {!filteredOrganizations.length && !loading && <div style={{ fontSize: 13, color: "rgba(15,23,42,0.60)" }}>Nenhuma organização encontrada.</div>}
          </div>
          <PaginationControls
            page={Math.min(organizationsPage, organizationsTotalPages)}
            totalPages={organizationsTotalPages}
            onPrev={() => setOrganizationsPage((page) => Math.max(1, page - 1))}
            onNext={() => setOrganizationsPage((page) => Math.min(organizationsTotalPages, page + 1))}
          />
        </section>
      </div>

      <div className="usageBlockHeading"><h2>Histórico de downloads</h2><p>Arquivos disponíveis para consulta</p></div>
      <section className="usagePanel usageDownloadsPanel">
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 950, color: "#0a284b" }}>Downloads de relatórios</div>
            <div style={{ marginTop: 4, fontSize: 12, color: "rgba(15,23,42,0.65)" }}>
              Veja o relatório baixado por cada usuário e baixe novamente quando precisar.
            </div>
          </div>
          <div style={{ position: "relative", minWidth: isMobile ? "100%" : 280, flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(15,23,42,0.45)" }} />
            <input
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Filtrar por usuário, relatório, hash..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px 10px 34px",
                borderRadius: 14,
                border: "1px solid rgba(10,40,75,0.12)",
                background: "rgba(255,255,255,0.96)",
                color: "#0f172a",
              }}
            />
          </div>
        </div>

        <div className="usageDownloadsList">
          {paginatedReportDownloads.map((item, index) => {
            const key = reportDownloadKey(item, index);
            const isDownloading = downloadingReportKey === key;

            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderRadius: 18,
                  background: "rgba(248,250,252,0.95)",
                  border: "1px solid rgba(15,23,42,0.06)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Download size={14} color="#0a284b" />
                    <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.report?.name || item.report?.report_type || "Relatório"}
                    </div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "rgba(15,23,42,0.64)" }}>
                    {item.user?.name || item.user?.email || "usuário"}{item.organization?.name ? ` • ${item.organization.name}` : ""}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(10,40,75,0.08)", color: "#0a284b", fontSize: 11, fontWeight: 800 }}>
                      {item.report?.status || "status desconhecido"}
                    </span>
                    {item.report?.report_type && (
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: "rgba(91,63,214,0.10)", color: "#5b3fd6", fontSize: 11, fontWeight: 800 }}>
                        {item.report.report_type}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ minWidth: 0, fontSize: 12, color: "rgba(15,23,42,0.68)" }}>
                  <div>Dia do download {item.downloaded_at ? new Date(item.downloaded_at).toLocaleDateString("pt-BR") : "-"}</div>
                  <div
                    style={{
                      marginTop: 4,
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      whiteSpace: "normal",
                    }}
                  >
                    Rastreio: {item.selection_hash || "-"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadReport(item, index)}
                  disabled={isDownloading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "0",
                    background: "#0a284b",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: "pointer",
                    minWidth: 140,
                    opacity: isDownloading ? 0.75 : 1,
                  }}
                >
                  {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {isDownloading ? "Baixando..." : "Baixar PDF"}
                </button>
              </div>
            );
          })}

          {!filteredReportDownloads.length && !loading && (
            <div style={{ fontSize: 13, color: "rgba(15,23,42,0.60)" }}>Nenhum download encontrado com esse filtro.</div>
          )}
        </div>
        <PaginationControls
          page={Math.min(downloadsPage, downloadsTotalPages)}
          totalPages={downloadsTotalPages}
          onPrev={() => setDownloadsPage((page) => Math.max(1, page - 1))}
          onNext={() => setDownloadsPage((page) => Math.min(downloadsTotalPages, page + 1))}
        />
      </section>
      </div>
    </div>
  );
}
