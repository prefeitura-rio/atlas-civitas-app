import { useEffect, useMemo, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ChevronRight, FileText } from "lucide-react";
import pdfWorkerUrl from "../workers/pdf.worker.ts?worker&url";
import atlasBrand from "../assets/atlas-brand.png";
import { fetchJson } from "./map/shared";
import "./terms.css";

type Props = {
  apiBase: string;
  accessToken: string;
  currentVersion: string | null;
  error?: string | null;
  onRetry?: () => void;
  onAccepted?: () => void;
};

const TERMS_PDF_URL = "/termos.pdf";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function describePdfError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(Reflect.get(error, "message") || "")
      : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("promise.withresolvers") || normalized.includes("url.parse")) {
    return "Seu navegador está desatualizado para abrir este PDF. Atualize e tente novamente.";
  }
  if (
    normalized.includes("setting up fake worker failed") ||
    normalized.includes("worker") ||
    normalized.includes("module script")
  ) {
    return "Falha ao inicializar o leitor de PDF no navegador.";
  }
  if (
    normalized.includes("missing pdf") ||
    normalized.includes("unexpected server response")
  ) {
    return "Documento de termos não encontrado em /termos.pdf.";
  }
  if (normalized.includes("fetch")) {
    return "Não foi possível baixar o documento.";
  }
  return "Não foi possível carregar o documento.";
}

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
  const [pdfReloadKey, setPdfReloadKey] = useState(0);
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
        const firstPage = await pdf.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });
        const containerWidth = Math.max(
          320,
          (termsBodyRef.current?.clientWidth ?? window.innerWidth * 0.92) - 20,
        );
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const targetPixelWidth = containerWidth * dpr * 1.35;
        const renderScale = Math.min(
          2.8,
          Math.max(1.8, targetPixelWidth / baseViewport.width),
        );

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;

          const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: renderScale });
          const canvas = document.createElement("canvas");
          const canvasContext = canvas.getContext("2d", { alpha: false });
          if (!canvasContext) {
            throw new Error("Canvas 2D indisponível");
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvasContext, canvas, viewport }).promise;
          pages.push(canvas.toDataURL("image/png"));
          page.cleanup();
        }

        if (cancelled) return;
        setPdfPages(pages);
      } catch (e) {
        if (cancelled) return;
        console.error("[Terms] Falha ao carregar PDF de termos", e);
        setPdfLoadErr(describePdfError(e));
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
  }, [pdfReloadKey]);

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
    } catch (e: unknown) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String(Reflect.get(e, "message") || "")
          : "";
      setSubmitErr(message || "Falha ao aceitar termos");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetryPdfLoad() {
    setPdfReloadKey((current) => current + 1);
  }

  return (
    <div className="termsScreen">
      <header className="termsTopbar">
        <img src={atlasBrand} alt="Prefeitura do Rio e CIVITAS Rio" className="termsTopbarBrand" />
      </header>

      <main className="termsMain">
        <section className="termsCard" aria-labelledby="terms-title">
          <div className="termsCardHeader">
            <span className="termsHeaderIcon" aria-hidden="true"><FileText size={23} /></span>
            <div className="termsHeaderCopy">
              <span className="termsEyebrow">Confirmação de acesso</span>
              <h1 className="termsTitle" id="terms-title">TERMOS E CONDIÇÕES</h1>
              <p>Leia o documento até o final para continuar no sistema.</p>
            </div>
          </div>

          <div className="termsBody" ref={termsBodyRef} data-testid="terms-scroll-container">
            {pdfLoading && <div className="termsLoading">Carregando documento...</div>}
            {!pdfLoading && pdfLoadErr && (
              <div className="termsError" role="alert">
                {pdfLoadErr}
                <div className="termsActions">
                  <button className="termsRetry" onClick={handleRetryPdfLoad} type="button">
                    Recarregar documento
                  </button>
                </div>
              </div>
            )}
            {!pdfLoading && !pdfLoadErr && (
              <div className="termsPages">
                {pdfPages.map((src, idx) => (
                  <img
                    key={`terms-page-${idx + 1}`}
                    src={src}
                    alt={`Página ${idx + 1} do termo`}
                    className="termsPage"
                    loading={idx <= 1 ? "eager" : "lazy"}
                    draggable={false}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="termsFooter">
            {pdfLoading && (
              <div className="termsHint">Aguarde o carregamento do documento para habilitar o aceite.</div>
            )}
            {pdfReady && !scrolledToEnd && (
              <div className="termsHint">Role até o final do documento para habilitar o aceite.</div>
            )}

            <div className="termsFooterActions">
              <label
                className={`termsRow ${!scrolledToEnd ? "termsRowDisabled" : ""}`}
                data-testid="terms-agree-row"
                data-scrolled-to-end={scrolledToEnd ? "true" : "false"}
              >
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  disabled={!pdfReady || !scrolledToEnd}
                  className="termsCheckboxInput"
                  aria-label="Concordo com os termos e condições"
                />
                <span className="termsCheck" data-checked={agree ? "true" : "false"}>
                  {agree ? "✓" : ""}
                </span>
                <span>Concordo com os termos e condições</span>
              </label>

              <button
                className="termsButton"
                type="button"
                onClick={handleAccept}
                disabled={!canSubmit}
                data-testid="terms-accept-button"
              >
                {submitting ? "Aceitando..." : "Aceitar e continuar"}
                {!submitting && <ChevronRight size={17} aria-hidden="true" />}
              </button>
            </div>

            {(error || submitErr) && (
              <div className="termsError" role="alert">
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
        </section>
      </main>
    </div>
  );
}
