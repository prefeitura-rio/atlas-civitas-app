import { API_BASE } from "./mapConfig";
import { fetchJson } from "./shared";
import { fetchWithFriendlyNetworkError, SERVER_UNAVAILABLE_MESSAGE } from "../../app/errorMessages";

export function createReportDownloads(accessToken: string) {
  function resolveApiUrl(pathOrUrl: string) {
    if (!pathOrUrl) return "";
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
    return `${API_BASE}${normalizedPath}`;
  }

  async function downloadReportFile(pathOrUrl: string, fallbackName: string) {
    const url = resolveApiUrl(pathOrUrl);
    if (!url) throw new Error("URL de download inválida.");

    const liveAccessToken =
      sessionStorage.getItem("access_token") || localStorage.getItem("access_token") || accessToken;
    const res = await fetchWithFriendlyNetworkError(url, {
      headers: {
        ...(liveAccessToken ? { Authorization: `Bearer ${liveAccessToken}` } : {}),
      },
    });
    if (!res.ok) {
      if (res.status >= 500) throw new Error(SERVER_UNAVAILABLE_MESSAGE);
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha no download (${res.status}) ${txt || res.statusText}`);
    }

    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
    const filename = match ? decodeURIComponent(match[1].replace(/"/g, "").trim()) : fallbackName;

    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  }

  async function waitForReportCompletion(reportId: string, maxAttempts = 20, intervalMs = 1500) {
    for (let i = 0; i < maxAttempts; i++) {
      const detail = await fetchJson<any>(`${API_BASE}/reports/${reportId}`, {
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      const status = String(detail?.status || "").toLowerCase();
      if (status === "completed" && detail?.download_url) return detail;
      if (status === "failed" || status === "error") {
        throw new Error(detail?.message || "Falha ao gerar relatório.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }
    throw new Error("Relatório ainda em processamento. Tente novamente mais tarde.");
  }
  return { downloadReportFile, waitForReportCompletion };
}
