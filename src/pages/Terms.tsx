import { useEffect, useMemo, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import { fetchJson } from "./map/shared";

type Props = {
  apiBase: string;
  accessToken: string;
  currentVersion: string | null;
  error?: string | null;
  onRetry?: () => void;
  onAccepted?: () => void;
};

const TERMS_PDF_URL = "/termos.pdf";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function Terms({
  apiBase,
  accessToken,
  currentVersion,
  error,
  onRetry,
  onAccepted,
}: Props) {
  const termsBodyRef = useRef<HTMLDivElement | null>(null);
  const [agree, setAgree] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfLoadErr, setPdfLoadErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const pdfReady = !pdfLoading && !pdfLoadErr && pdfPages.length > 0;

  const canSubmit = useMemo(() => {
    return !!currentVersion && agree && pdfReady && scrolledToEnd && !submitting;
  }, [currentVersion, agree, pdfReady, scrolledToEnd, submitting]);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument(TERMS_PDF_URL);

    async function renderPdf() {
      setPdfLoading(true);
      setPdfLoadErr(null);
      setPdfPages([]);
      setScrolledToEnd(false);

      try {
        const pdf = await loadingTask.promise;
        const pages: string[] = [];
        // Higher scale improves text sharpness, especially on Retina/high-DPI displays.
        const renderScale = Math.min(
          3,
          Math.max(2, (window.devicePixelRatio || 1) * 1.5),
        );

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement("canvas");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvas, viewport }).promise;
          pages.push(canvas.toDataURL("image/png"));
          page.cleanup();
        }

        if (cancelled) return;
        setPdfPages(pages);
      } catch (_e) {
        if (cancelled) return;
        setPdfLoadErr("Nao foi possivel carregar o documento.");
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, []);

  useEffect(() => {
    const el = termsBodyRef.current;
    if (!el || !pdfReady) return;

    const checkScrollEnd = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 4) {
        setScrolledToEnd(true);
        return;
      }
      setScrolledToEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 8);
    };

    checkScrollEnd();
    el.addEventListener("scroll", checkScrollEnd, { passive: true });
    window.addEventListener("resize", checkScrollEnd);

    return () => {
      el.removeEventListener("scroll", checkScrollEnd);
      window.removeEventListener("resize", checkScrollEnd);
    };
  }, [pdfReady, pdfPages.length]);

  async function handleAccept() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);

    try {
      await fetchJson(`${apiBase}/users/accept-terms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ version: currentVersion, accepted: true }),
      });
      onAccepted?.();
    } catch (e: any) {
      setSubmitErr(e?.message ?? "Falha ao aceitar termos");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background:
          "radial-gradient(1200px 600px at 10% 10%, rgba(0,186,255,0.12), transparent 60%)," +
          "radial-gradient(1200px 600px at 90% 90%, rgba(255,160,64,0.10), transparent 60%)," +
          "linear-gradient(180deg, #0b0b10, #141418)",
        color: "#fff",
      }}
    >
      <style>{`
        .termsCard {
          width: min(980px, 100%);
          background: rgba(15,15,20,0.92);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.45);
          backdrop-filter: blur(10px);
        }
        .termsTitle {
          font-size: 20px;
          letter-spacing: 2px;
          font-weight: 700;
          text-transform: uppercase;
          margin: 0 0 12px 0;
        }
        .termsBody {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 10px;
          max-height: 70vh;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .termsBody::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .termsPages {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .termsPage {
          width: 100%;
          display: block;
          border-radius: 8px;
          user-select: none;
          pointer-events: none;
          background: #fff;
        }
        .termsLoading {
          min-height: 52vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.72);
          font-size: 14px;
        }
        .termsHint {
          margin-top: 10px;
          font-size: 12px;
          color: rgba(255,255,255,0.62);
        }
        .termsRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
        }
        .termsRowDisabled {
          opacity: 0.62;
          cursor: not-allowed;
        }
        .termsCheck {
          width: 18px;
          height: 18px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.35);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.06);
        }
        .termsCheck[data-checked="true"] {
          background: #00c0f3;
          border-color: #00c0f3;
          color: #ffffff;
          font-weight: 700;
        }
        .termsButton {
          margin-top: 18px;
          width: 100%;
          border: none;
          border-radius: 999px;
          padding: 12px 16px;
          color: #fff;
          font-weight: 700;
          letter-spacing: 0.3px;
          cursor: pointer;
          background: linear-gradient(90deg, #00c0f3, #0a284b);
          box-shadow: 0 12px 30px rgba(0, 24, 48, 0.35);
          transition: transform 0.15s ease, opacity 0.15s ease;
        }
        .termsButton:hover {
          transform: translateY(-1px);
        }
        .termsButton:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
        .termsMeta {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.55);
        }
        .termsError {
          margin-top: 10px;
          color: #ffd4d4;
          background: rgba(255,50,50,0.12);
          border: 1px solid rgba(255,50,50,0.35);
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
        }
        .termsActions {
          margin-top: 10px;
          display: flex;
          gap: 10px;
        }
        .termsRetry {
          background: transparent;
          color: #fff;
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 999px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 12px;
        }
        @media (max-width: 640px) {
          .termsCard {
            padding: 16px;
          }
          .termsTitle {
            font-size: 18px;
          }
          .termsBody {
            max-height: 62vh;
          }
        }
      `}</style>

      <div className="termsCard">
        <h1 className="termsTitle">TERMOS E CONDIÇÕES</h1>

        <div className="termsBody" ref={termsBodyRef}>
          {pdfLoading && <div className="termsLoading">Carregando documento...</div>}
          {!pdfLoading && pdfLoadErr && <div className="termsError">{pdfLoadErr}</div>}
          {!pdfLoading && !pdfLoadErr && (
            <div className="termsPages">
              {pdfPages.map((src, idx) => (
                <img
                  key={`terms-page-${idx + 1}`}
                  src={src}
                  alt={`Pagina ${idx + 1} do termo`}
                  className="termsPage"
                  loading={idx <= 1 ? "eager" : "lazy"}
                  draggable={false}
                />
              ))}
            </div>
          )}
        </div>
        {pdfLoading && (
          <div className="termsHint">Aguarde o carregamento do documento para habilitar o aceite.</div>
        )}
        {pdfReady && !scrolledToEnd && (
          <div className="termsHint">Role até o final do documento para habilitar o aceite.</div>
        )}

        <label className={`termsRow ${!scrolledToEnd ? "termsRowDisabled" : ""}`}>
          <span className="termsCheck" data-checked={agree ? "true" : "false"}>
            {agree ? "✓" : ""}
          </span>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            disabled={!pdfReady || !scrolledToEnd}
            style={{ display: "none" }}
          />
          <span>Concordo com os termos e condições</span>
        </label>

        <button
          className="termsButton"
          type="button"
          onClick={handleAccept}
          disabled={!canSubmit}
        >
          {submitting ? "Aceitando..." : "Aceitar"}
        </button>

        {currentVersion && <div className="termsMeta">Versão atual: {currentVersion}</div>}
        {!currentVersion && <div className="termsMeta">Versão indisponível no momento.</div>}

        {(error || submitErr) && (
          <div className="termsError">
            {error || submitErr}
            {onRetry && (
              <div className="termsActions">
                <button className="termsRetry" onClick={onRetry} type="button">
                  Tentar novamente
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
