import React, { useMemo, useState } from "react";
import { fetchJson } from "./map/shared";

type Props = {
  apiBase: string;
  accessToken: string;
  currentVersion: string | null;
  error?: string | null;
  onRetry?: () => void;
  onAccepted?: () => void;
};

export default function Terms({
  apiBase,
  accessToken,
  currentVersion,
  error,
  onRetry,
  onAccepted,
}: Props) {
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!currentVersion && agree && !submitting;
  }, [currentVersion, agree, submitting]);

  async function handleAccept() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitErr(null);

    try {
      await fetchJson(`${apiBase}/api/v1/auth/accept-terms`, {
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
          width: min(760px, 100%);
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
          padding: 14px;
          max-height: 280px;
          overflow: auto;
          color: rgba(255,255,255,0.78);
          font-size: 14px;
          line-height: 1.45;
        }
        .termsRow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 14px;
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
        .termsCheck[data-checked=\"true\"] {
          background: linear-gradient(135deg, #00c0f3, #7ef29a);
          border-color: transparent;
          color: #091015;
          font-weight: 700;
        }
        .termsButton {
          margin-top: 18px;
          width: 100%;
          border: none;
          border-radius: 999px;
          padding: 12px 16px;
          color: #111;
          font-weight: 700;
          letter-spacing: 0.3px;
          cursor: pointer;
          background:
            linear-gradient(135deg, #4285f4 0%, #34a853 40%, #fbbc05 70%, #ea4335 100%);
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
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
        }
      `}</style>

      <div className="termsCard">
        <h1 className="termsTitle">TERMOS E CONDIÇÕES</h1>

        <div className="termsBody">
          O texto dos termos será disponibilizado em breve.
        </div>

        <label className="termsRow">
          <span className="termsCheck" data-checked={agree ? "true" : "false"}>
            {agree ? "✓" : ""}
          </span>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
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

        {currentVersion && (
          <div className="termsMeta">Versão atual: {currentVersion}</div>
        )}
        {!currentVersion && (
          <div className="termsMeta">
            Versão indisponível no momento.
          </div>
        )}

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
