import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { fetchJson } from "./shared";

type UsageSummary = {
  range?: { from?: string; to?: string };
  totals?: {
    events?: number;
    logins?: number;
    report_downloads?: number;
    camera_sessions?: number;
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
  camera_sessions?: number;
  total_events?: number;
  count?: number;
  total?: number;
  value?: number;
  last_activity_at?: string | null;
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

function normalizeList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (Array.isArray(data?.items)) return data.items as T[];
  if (Array.isArray(data?.results)) return data.results as T[];
  if (Array.isArray(data?.data)) return data.data as T[];
  return [];
}

function getSummaryTotal(summary: UsageSummary | null | undefined, key: keyof NonNullable<UsageSummary["totals"]>) {
  return Number(summary?.totals?.[key] ?? 0);
}

function getRankedItemTotal(item: RankedItem) {
  return Number(item.total_events ?? item.count ?? item.total ?? item.value ?? 0);
}

function rankedItemBreakdown(item: RankedItem) {
  const parts = [
    `${niceNumber(item.logins ?? 0)} logins`,
    `${niceNumber(item.report_downloads ?? 0)} downloads`,
    `${niceNumber(item.camera_sessions ?? 0)} câmeras`,
  ];
  return parts.join(" • ");
}

function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "aqua" | "violet" | "gold";
}) {
  const tones = {
    default: { bg: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(245,248,252,0.92))", accent: "#0a284b" },
    aqua: { bg: "linear-gradient(180deg, rgba(235,253,255,0.95), rgba(221,248,255,0.90))", accent: "#0f7c9a" },
    violet: { bg: "linear-gradient(180deg, rgba(245,240,255,0.95), rgba(234,228,255,0.90))", accent: "#5b3fd6" },
    gold: { bg: "linear-gradient(180deg, rgba(255,249,235,0.95), rgba(255,240,214,0.90))", accent: "#a16207" },
  }[tone];

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 22,
        border: "1px solid rgba(10,40,75,0.08)",
        background: tones.bg,
        boxShadow: "0 18px 40px rgba(10, 40, 75, 0.08)",
        minHeight: 118,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.06em", color: "rgba(10,40,75,0.58)" }}>
        {label}
      </div>
      <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1, fontWeight: 950, color: tones.accent }}>{value}</div>
      <div style={{ marginTop: 10, fontSize: 12, color: "rgba(15,23,42,0.68)" }}>{hint}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 950, color: "#0a284b" }}>{title}</div>
        {subtitle && <div style={{ marginTop: 4, fontSize: 12, color: "rgba(15,23,42,0.65)" }}>{subtitle}</div>}
      </div>
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
        fetchJson<any>(`${summaryUrl}?${params}`, { headers }),
        fetchJson<any>(`${topUsersUrl}?${params}&limit=100`, { headers }),
        fetchJson<any>(`${topOrgsUrl}?${params}&limit=100`, { headers }),
        fetchJson<any>(`${reportDownloadsUrl}?${params}&limit=20`, { headers }),
      ]);

      const summaryPayload = Array.isArray(summaryData) ? summaryData[0] : summaryData?.data ?? summaryData;
      setSummary(summaryPayload ?? null);
      setTopUsers(normalizeList<RankedItem>(usersData));
      setTopOrganizations(normalizeList<RankedItem>(orgData));
      setReportDownloads(normalizeList<ReportDownloadItem>(downloadsData));
    } catch (e: any) {
      setErr(e?.message || "Erro ao carregar métricas");
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

  const featuredUsers = filteredUsers.slice(0, 3);
  const featuredOrganizations = filteredOrganizations.slice(0, 3);
  const remainingUsers = filteredUsers.slice(3);
  const remainingOrganizations = filteredOrganizations.slice(3);

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
    { label: "Atividades", value: niceNumber(getSummaryTotal(summary, "events")), hint: "Trilha normalizada do uso" },
    { label: "Sessões", value: niceNumber(getSummaryTotal(summary, "sessions")), hint: "Logins efetivos no período", tone: "aqua" as const },
    { label: "Downloads", value: niceNumber(getSummaryTotal(summary, "report_downloads")), hint: "Relatórios exportados", tone: "gold" as const },
    { label: "Acessos câmera", value: niceNumber(getSummaryTotal(summary, "camera_sessions")), hint: "Uso de câmera inteligente", tone: "violet" as const },
    { label: "Usuários ativos", value: niceNumber(getSummaryTotal(summary, "distinct_users")), hint: "Pessoas distintas no recorte" },
    { label: "Organizações", value: niceNumber(getSummaryTotal(summary, "distinct_organizations")), hint: "Entes com atividade no período" },
  ];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          padding: 18,
          borderRadius: 28,
          border: "1px solid rgba(10,40,75,0.10)",
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 28%), radial-gradient(circle at top right, rgba(14,165,233,0.18), transparent 24%), linear-gradient(180deg, rgba(8,28,54,0.98), rgba(10,40,75,0.94))",
          color: "#fff",
          boxShadow: "0 26px 70px rgba(8, 28, 54, 0.28)",
        }}
      >
        <div style={{ display: "flex", alignItems: "start", gap: 14, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 11px", borderRadius: 999, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.14)", fontSize: 12, fontWeight: 800 }}>
              <ShieldCheck size={14} />
              Analíticos de uso
            </div>
            <div style={{ marginTop: 14, fontSize: isMobile ? 28 : 40, lineHeight: 1.02, fontWeight: 950, letterSpacing: "-0.04em" }}>
              Centro de inteligência operacional
            </div>
            <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.78)" }}>
              Uma visão executiva do uso da plataforma com sessões, rankings, downloads e acessos a câmera.
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, minWidth: 280 }}>
            <div style={{ display: "grid", gap: 8, padding: 14, borderRadius: 22, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", color: "rgba(255,255,255,0.60)" }}>
                PERÍODO
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8 }}>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.95)", color: "#0f172a" }} />
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.95)", color: "#0f172a" }} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setFrom(startOfDayIso(7))}
                  style={{ padding: "9px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 800, cursor: "pointer" }}
                >
                  7 dias
                </button>
                <button
                  onClick={() => setFrom(startOfDayIso(30))}
                  style={{ padding: "9px 11px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.08)", color: "#fff", fontWeight: 800, cursor: "pointer" }}
                >
                  30 dias
                </button>
                <button
                  onClick={load}
                  disabled={loading}
                  style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 999, border: "0", background: "linear-gradient(90deg, #56ccf2, #2f80ed)", color: "#fff", fontWeight: 900, cursor: "pointer" }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </div>

        {err && <div style={{ marginTop: 12, color: "#fecaca", fontSize: 13, fontWeight: 700 }}>{err}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        {summaryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} hint={card.hint} tone={card.tone} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateRows: "auto auto auto", padding: 16, borderRadius: 24, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(10,40,75,0.08)" }}>
          <SectionTitle title="Usuários" subtitle="Top 3 em destaque com lista completa e filtro" />
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(15,23,42,0.45)" }} />
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Filtrar por nome, email ou organização..."
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 14, border: "1px solid rgba(10,40,75,0.12)", background: "rgba(255,255,255,0.96)", color: "#0f172a" }}
            />
          </div>
          <div style={{ display: "grid", gap: 8, maxHeight: 206, overflow: "auto", paddingRight: 4 }}>
            {featuredUsers.map((item, index) => (
              <div key={`featured-user-${item.id || item.user_id || index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 18, background: "rgba(248,250,252,0.98)", color: "#0f172a", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "#0a284b", color: "#fff" }}>
                  {index + 1}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.full_name || item.name || item.email || "Usuário"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.64)" }}>{rankedItemBreakdown(item)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950, color: "#0a284b" }}>{niceNumber(getRankedItemTotal(item))}</div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: "rgba(15,23,42,0.50)" }}>atividades</div>
                </div>
              </div>
            ))}
            {remainingUsers.map((item, index) => (
              <div key={item.id || item.user_id || index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 16, background: "rgba(248,250,252,0.95)", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(10,40,75,0.08)", color: "#0a284b" }}>
                  {index + 4}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.full_name || item.name || item.email || "Usuário"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.64)" }}>{item.email || item.organization_name || "sem detalhe"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950, color: "#0a284b" }}>{niceNumber(getRankedItemTotal(item))}</div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: "rgba(15,23,42,0.50)" }}>atividades</div>
                </div>
              </div>
            ))}
            {!filteredUsers.length && !loading && <div style={{ fontSize: 13, color: "rgba(15,23,42,0.60)" }}>Nenhum usuário encontrado.</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto auto auto", padding: 16, borderRadius: 24, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(10,40,75,0.08)" }}>
          <SectionTitle title="Organizações" subtitle="Top 3 em destaque com lista completa e filtro" />
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(15,23,42,0.45)" }} />
            <input
              value={organizationSearch}
              onChange={(e) => setOrganizationSearch(e.target.value)}
              placeholder="Filtrar por nome da organização..."
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", borderRadius: 14, border: "1px solid rgba(10,40,75,0.12)", background: "rgba(255,255,255,0.96)", color: "#0f172a" }}
            />
          </div>
          <div style={{ display: "grid", gap: 8, maxHeight: 206, overflow: "auto", paddingRight: 4 }}>
            {featuredOrganizations.map((item, index) => (
              <div key={`featured-org-${item.id || item.organization_id || index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 18, background: "rgba(248,250,252,0.98)", color: "#0f172a", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "#0a284b", color: "#fff" }}>
                  {index + 1}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.organization_name || item.name || "Organização"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.64)" }}>{rankedItemBreakdown(item)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950, color: "#0a284b" }}>{niceNumber(getRankedItemTotal(item))}</div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: "rgba(15,23,42,0.50)" }}>atividades</div>
                </div>
              </div>
            ))}
            {remainingOrganizations.map((item, index) => (
              <div key={item.id || item.organization_id || index} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 16, background: "rgba(248,250,252,0.95)", border: "1px solid rgba(15,23,42,0.06)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", fontWeight: 900, background: "rgba(10,40,75,0.08)", color: "#0a284b" }}>
                  {index + 4}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.organization_name || item.name || "Organização"}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.64)" }}>{rankedItemBreakdown(item)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 950, color: "#0a284b" }}>{niceNumber(getRankedItemTotal(item))}</div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 800, color: "rgba(15,23,42,0.50)" }}>atividades</div>
                </div>
              </div>
            ))}
            {!filteredOrganizations.length && !loading && <div style={{ fontSize: 13, color: "rgba(15,23,42,0.60)" }}>Nenhuma organização encontrada.</div>}
          </div>
        </div>
      </div>

      <div style={{ padding: 16, borderRadius: 24, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(10,40,75,0.08)" }}>
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

        <div style={{ display: "grid", gap: 8, maxHeight: 420, overflow: "auto" }}>
          {filteredReportDownloads.map((item, index) => {
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
                  <div style={{ marginTop: 4 }}>Rastreio: {item.selection_hash || "-"}</div>
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
                    background: "linear-gradient(90deg, #0a284b, #2f80ed)",
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
      </div>

    </div>
  );
}
