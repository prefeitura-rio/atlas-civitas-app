

export const GeometrySummaryCard = ({
    isMobile,
    hasAuthorizedReportLayers,
    title,
    total,
    items,
    onClose,
    onDownload,
    reportLoading,
    reportMsg,
    canRequest,
    loading = false,
    loadingText = "Carregando resumo...",
  }: {
    isMobile: boolean;
    hasAuthorizedReportLayers: boolean;
    title: string;
    total: number;
    items: Array<{ label: string; value: number }>;
    onClose: () => void;
    onDownload: () => void;
    reportLoading: boolean;
    reportMsg: string | null;
    canRequest: boolean;
    loading?: boolean;
    loadingText?: string;
  }) => (
    <div
      className="dock geometrySummaryCard"
      style={
        isMobile
          ? { width: "100%", maxWidth: 360, padding: 8, gap: 4 }
          : { minWidth: 220 }
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="dockTitle" style={{ marginBottom: 0 }}>
          Resumo
        </div>
        <button
          type="button"
          className="btnGhost"
          onClick={onClose}
          style={{
            minWidth: isMobile ? 64 : 28,
            minHeight: isMobile ? 32 : 28,
            padding: isMobile ? "5px 10px" : 0,
            borderRadius: isMobile ? 8 : 999,
            lineHeight: 1.2,
          }}
          aria-label={isMobile ? "Voltar ao mapa" : "Fechar resumo"}
          title={isMobile ? "Voltar ao mapa" : "Fechar resumo"}
        >
          {isMobile ? "Voltar" : "✕"}
        </button>
      </div>
      <div
        className="dockNote"
        style={{ lineHeight: isMobile ? 1.25 : 1.4, marginTop: isMobile ? 2 : 6, fontSize: isMobile ? 9 : undefined }}
      >
        <div style={{ fontSize: isMobile ? 11 : 13, marginBottom: isMobile ? 3 : 4 }}>
          <strong>{loading ? title : `${title} - Total: ${total}`}</strong>
        </div>
        {loading ? (
          <div className="summaryLoadingRow" style={{ marginTop: isMobile ? 6 : 8 }}>
            <span className="summaryLoadingSpinner" aria-hidden="true" />
            <span>{loadingText}</span>
          </div>
        ) : (
          <>
            {isMobile ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "2px 8px",
                  fontSize: 9,
                }}
              >
                {items.map((item) => (
                  <div key={item.label}>
                    {item.label}: {item.value}
                  </div>
                ))}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.label}>
                  {item.label}: {item.value}
                </div>
              ))
            )}
            <div style={{ marginTop: isMobile ? 6 : 10 }}>
              <button
                className="btnGhost"
                onClick={onDownload}
                disabled={!canRequest || reportLoading}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  minHeight: isMobile ? 30 : undefined,
                  padding: isMobile ? "6px 8px" : undefined,
                  fontSize: isMobile ? 11 : undefined,
                  opacity: !canRequest || reportLoading ? 0.7 : 1,
                }}
              >
                {reportLoading ? "Gerando PDF..." : "Baixar PDF"}
              </button>
              {reportMsg && (
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(15,23,42,0.8)" }}>
                  {reportMsg}
                </div>
              )}
              {!canRequest && (
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(15,23,42,0.72)" }}>
                  {hasAuthorizedReportLayers
                    ? "Ative pelo menos uma camada para incluir neste relatório."
                    : "Nenhuma camada autorizada para incluir neste relatório."}
                </div>
              )}
            </div>
            {isMobile ? (
              <div style={{ marginTop: 6, fontSize: 8.5, lineHeight: 1.2, color: "rgba(15,23,42,0.72)" }}>
                * O total pode não refletir pontos únicos no mapa.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 4,
                  fontSize: 9,
                  lineHeight: 1.35,
                  color: "rgba(15,23,42,0.75)",
                }}
              >
                <span
                  title="Alguns equipamentos podem compartilhar a mesma coordenada."
                  style={{
                    display: "inline-block",
                    marginTop: 1,
                    fontWeight: 900,
                    fontSize: 10,
                    lineHeight: 1,
                  }}
                >
                  *
                </span>
                <div>
                  Podem existir câmeras, radares, LPR e Super Câmeras Inteligentes na mesma coordenada.
                  <br />
                  Por isso, o total pode não refletir pontos únicos no mapa.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
