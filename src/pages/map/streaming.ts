import { cleanString, fetchJson } from "./shared";
import { API_BASE } from "./mapConfig";
import type { CameraIntel, SmartCameraSessionResponse } from "./types";
import { showStreamingAlert } from "./alerts";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

export function escapeHtml(s: string) {
  return (s || "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

export function normalizeSessionUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return raw.startsWith("/") ? `${API_BASE}${raw}` : raw;
}

export function isHttpsUrl(value: unknown) {
  if (typeof value !== "string") return false;
  return /^https:\/\//i.test(value.trim());
}

export function getSmartCameraId(value: any) {
  return cleanString(value?.id);
}

export function getSmartCameraExternalId(value: any) {
  return cleanString(value?.external_camera_id);
}

export type SmartCameraSessionSource = Pick<CameraIntel, "id" | "external_camera_id">;

export function shouldDisableSmartCameraStreaming(error: unknown) {
    const rawMessage = String((error as any)?.message || "").trim();
    const match = rawMessage.match(/^(\d{3})\s*-\s*(.*)$/);
    const status = match ? Number(match[1]) : null;
    return status === 403 || status === 404 || status === 409 || rawMessage.includes("URL de sessão válida");
  }

export function getSmartCameraSessionErrorMessage(error: unknown, action: "preview" | "stream") {
    const rawMessage = String((error as any)?.message || "").trim();
    const match = rawMessage.match(/^(\d{3})\s*-\s*(.*)$/);
    if (match) {
      const status = Number(match[1]);
      if (status === 403) {
        return "Seu perfil não tem permissão para abrir o streaming desta super câmera.";
      }
      if (status === 404) {
        return "A super câmera inteligente não foi encontrada.";
      }
      if (status === 409) {
        return "Esta super câmera ainda não possui integração de streaming.";
      }
      if (status >= 500) {
        return "O serviço de streaming está indisponível no momento. Tente novamente mais tarde.";
      }
    }

    if (rawMessage) return rawMessage;

    return action === "preview"
      ? "Não foi possível abrir o preview da super câmera inteligente."
      : "Não foi possível abrir o streaming da super câmera inteligente.";
  }

export function shouldRetryCommonCameraSession(error: unknown) {
    const rawMessage = String((error as any)?.message || "").trim();
    const match = rawMessage.match(/^(\d{3})\s*-\s*(.*)$/);
    const status = match ? Number(match[1]) : null;

    if ([403, 404, 409, 423, 425, 429, 502, 503].includes(Number(status))) return true;

    const normalized = rawMessage.toLowerCase();
    return (
      normalized.includes("expir") ||
      normalized.includes("playback") ||
      normalized.includes("sessão") ||
      normalized.includes("session")
    );
  }

type CameraStreamingContext = {
  accessToken: string;
  hasStreamingAccessRef: import("react").RefObject<boolean>;
  hasSmartCameraStreamingAccessRef: import("react").RefObject<boolean>;
  unavailableSmartCameraIdsRef: import("react").RefObject<Record<string, true>>;
  setUnavailableSmartCameraIds: import("react").Dispatch<import("react").SetStateAction<Record<string, true>>>;
};

export function createCameraStreaming({
  accessToken, hasStreamingAccessRef, hasSmartCameraStreamingAccessRef,
  unavailableSmartCameraIdsRef, setUnavailableSmartCameraIds,
}: CameraStreamingContext) {
  function markSmartCameraStreamingUnavailable(smartId: string) {
    const normalizedId = cleanString(smartId);
    if (!normalizedId) return;
    setUnavailableSmartCameraIds((prev) => (prev[normalizedId] ? prev : { ...prev, [normalizedId]: true }));
  }

  function clearSmartCameraStreamingUnavailable(smartId: string) {
    const normalizedId = cleanString(smartId);
    if (!normalizedId) return;
    setUnavailableSmartCameraIds((prev) => {
      if (!prev[normalizedId]) return prev;
      const next = { ...prev };
      delete next[normalizedId];
      return next;
    });
  }

  function isSmartCameraStreamingUnavailable(source: SmartCameraSessionSource | string | null | undefined) {
    const smartId = typeof source === "string" ? cleanString(source) : getSmartCameraId(source);
    if (!smartId) return false;
    return Boolean(unavailableSmartCameraIdsRef.current[smartId]);
  }

  async function requestSmartCameraSession(smartId: string, durationSeconds: number) {
    const trimmedSmartId = cleanString(smartId);
    if (!trimmedSmartId) {
      throw new Error("ID da super câmera inteligente indisponível.");
    }

    const data = await fetchJson<SmartCameraSessionResponse>(`${API_BASE}/cameras-inteligentes/${encodeURIComponent(trimmedSmartId)}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ durationSeconds }),
    });

    const sessionUrl = normalizeSessionUrl(data?.session_url);
    if (!sessionUrl) {
      throw new Error("O backend não retornou uma URL de sessão válida.");
    }

    clearSmartCameraStreamingUnavailable(trimmedSmartId);

    return {
      ...data,
      sessionUrl,
    };
  }

  async function requestCommonCameraSession(cameraId: string, durationSeconds: number) {
    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) {
      throw new Error("ID da câmera indisponível.");
    }

    const data = await fetchJson<any>(`${API_BASE}/cameras/${encodeURIComponent(trimmedCameraId)}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ durationSeconds }),
    });

    const sessionUrl = normalizeSessionUrl(data?.session_url);
    if (!sessionUrl) {
      throw new Error("O backend não retornou uma URL de sessão válida.");
    }

    return {
      ...data,
      sessionUrl,
    };
  }

  async function requestCommonCameraView(cameraId: string) {
    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) return;

    await fetchJson<any>(`${API_BASE}/cameras/${encodeURIComponent(trimmedCameraId)}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
  }

  async function openSmartCameraStreamWindow(source: SmartCameraSessionSource, durationSeconds: number) {
    if (!hasSmartCameraStreamingAccessRef.current) {
      await showStreamingAlert({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Seu perfil não pode abrir streaming desta super câmera.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const smartId = getSmartCameraId(source);
    if (!smartId) {
      await showStreamingAlert({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Esta super câmera não possui um ID válido para streaming.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const streamWindow = window.open("about:blank", "_blank");
    if (streamWindow) {
      try {
        streamWindow.opener = null;
      } catch {}
    }

    try {
      const session = await requestSmartCameraSession(smartId, durationSeconds);
      if (streamWindow && !streamWindow.closed) {
        streamWindow.location.href = session.sessionUrl;
      } else {
        window.location.href = session.sessionUrl;
      }
    } catch (error) {
      if (shouldDisableSmartCameraStreaming(error)) {
        markSmartCameraStreamingUnavailable(smartId);
      }
      if (streamWindow) {
        streamWindow.close();
      }
      await showStreamingAlert({
        icon: "warning",
        title: "Streaming indisponível",
        text: getSmartCameraSessionErrorMessage(error, "stream"),
        confirmButtonText: "Entendi",
      });
    }
  }

  async function openCommonCameraStreamWindow(cameraId: string, durationSeconds: number) {
    if (!hasStreamingAccessRef.current) {
      await showStreamingAlert({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Seu perfil não pode abrir streaming desta câmera.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const trimmedCameraId = cleanString(cameraId);
    if (!trimmedCameraId) {
      await showStreamingAlert({
        icon: "warning",
        title: "Streaming indisponível",
        text: "Esta câmera não possui um ID válido para streaming.",
        confirmButtonText: "Entendi",
      });
      return;
    }

    const streamWindow = window.open("about:blank", "_blank");
    if (streamWindow) {
      try {
        streamWindow.opener = null;
      } catch {}
    }

    try {
      await requestCommonCameraView(trimmedCameraId).catch((error) => {
        console.warn("Falha ao registrar visualização da câmera.", error);
      });

      let session: Awaited<ReturnType<typeof requestCommonCameraSession>>;
      try {
        session = await requestCommonCameraSession(trimmedCameraId, durationSeconds);
      } catch (error) {
        if (!shouldRetryCommonCameraSession(error)) throw error;
        session = await requestCommonCameraSession(trimmedCameraId, durationSeconds);
      }

      if (streamWindow && !streamWindow.closed) {
        streamWindow.location.href = session.sessionUrl;
      } else {
        window.location.href = session.sessionUrl;
      }
    } catch (error) {
      if (streamWindow) {
        streamWindow.close();
      }
      await showStreamingAlert({
        icon: "warning",
        title: "Streaming indisponível",
        text: String((error as any)?.message || "Não foi possível abrir o streaming da câmera."),
        confirmButtonText: "Entendi",
      });
    }
  }
  return {
    markSmartCameraStreamingUnavailable,
    isSmartCameraStreamingUnavailable,
    requestSmartCameraSession,
    requestCommonCameraSession,
    openSmartCameraStreamWindow,
    openCommonCameraStreamWindow,
  };
}
