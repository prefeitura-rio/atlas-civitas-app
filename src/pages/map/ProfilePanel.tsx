import { Eye, EyeOff, UserRound } from "lucide-react";
import type { AuthUser } from "../../app/auth";
import { inputStyle } from "./shared";
import type { usePasswordChange } from "./usePasswordChange";
import type { Dispatch, SetStateAction } from "react";
import type { PanelKey } from "./mapConfig";

type Props = {
  me: AuthUser | null;
  auth: { organizationName: string | null };
  password: ReturnType<typeof usePasswordChange>;
  setPanel: Dispatch<SetStateAction<PanelKey>>;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  isMobile?: boolean;
};

export function ProfilePanel({
  me,
  auth,
  password,
  setPanel,
  setPanelOpen,
  isMobile = false,
}: Props) {
  const {
    pwOld,
    setPwOld,
    pwNew,
    setPwNew,
    pwNew2,
    setPwNew2,
    showPwOld,
    setShowPwOld,
    showPwNew,
    setShowPwNew,
    showPwNew2,
    setShowPwNew2,
    pwLoading,
    pwMsg,
    changePassword,
  } = password;
  if (isMobile) return (<>
                <div className="mobileEquipmentDragHandle" aria-hidden="true"><span /></div>
                <div className="mobileEquipmentHeader">
                  <div>
                    <span className="mobileEquipmentEyebrow">MAPA · CONTA</span>
                    <h2>Perfil</h2>
                    <p>Dados da conta</p>
                  </div>
                  <button type="button" onClick={() => { setPanel(null); setPanelOpen(false); }} aria-label="Voltar ao mapa">Voltar ao mapa</button>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(10,40,75,0.08)",
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      color: "rgba(10,40,75,0.58)",
                      marginBottom: 6,
                    }}
                  >
                    PERFIL
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 8, color: "#0f172a" }}>Dados do usuário</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "rgba(10,40,75,0.58)" }}>Nome</div>
                    <div style={{ fontSize: 13, color: "#0f172a" }}>{me?.full_name || "-"}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, marginTop: 6, color: "rgba(10,40,75,0.58)" }}>Email</div>
                    <div style={{ fontSize: 13, color: "rgba(15,23,42,0.72)" }}>{me?.email || "-"}</div>
                    <div style={{ fontSize: 11, fontWeight: 900, marginTop: 6, color: "rgba(10,40,75,0.58)" }}>Organização</div>
                    <div style={{ fontSize: 13, color: "rgba(15,23,42,0.85)" }}>{auth.organizationName || "-"}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 12,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(10,40,75,0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                      color: "rgba(10,40,75,0.58)",
                    }}
                  >
                    SEGURANÇA
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 2, color: "#0f172a" }}>Trocar senha</div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={pwOld}
                      onChange={(e) => setPwOld(e.target.value)}
                      type={showPwOld ? "text" : "password"}
                      placeholder="Senha atual"
                      style={{
                        ...inputStyle(),
                        paddingRight: 44,
                        border: "1px solid rgba(10,40,75,0.12)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwOld((v) => !v)}
                      aria-label={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                      title={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        color: "rgba(10,40,75,0.64)",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {showPwOld ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={pwNew}
                      onChange={(e) => setPwNew(e.target.value)}
                      type={showPwNew ? "text" : "password"}
                      placeholder="Nova senha"
                      style={{
                        ...inputStyle(),
                        paddingRight: 44,
                        border: "1px solid rgba(10,40,75,0.12)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew((v) => !v)}
                      aria-label={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                      title={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        color: "rgba(10,40,75,0.64)",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {showPwNew ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <div style={{ position: "relative" }}>
                    <input
                      value={pwNew2}
                      onChange={(e) => setPwNew2(e.target.value)}
                      type={showPwNew2 ? "text" : "password"}
                      placeholder="Confirmar nova senha"
                      style={{
                        ...inputStyle(),
                        paddingRight: 44,
                        border: "1px solid rgba(10,40,75,0.12)",
                        background: "rgba(255,255,255,0.96)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwNew2((v) => !v)}
                      aria-label={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                      title={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        color: "rgba(10,40,75,0.64)",
                        padding: 0,
                        width: 20,
                        height: 20,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      {showPwNew2 ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={changePassword}
                    disabled={pwLoading}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(10,40,75,0.18)",
                      background: "rgba(10,40,75,0.92)",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {pwLoading ? "Salvando..." : "Salvar nova senha"}
                  </button>
                  {pwMsg && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.96)",
                      border: "1px solid rgba(10,40,75,0.10)",
                      fontSize: 13,
                      color: "rgba(15,23,42,0.85)",
                    }}
                  >
                    {pwMsg}
                    </div>
                  )}
                </div>
              </>);
  return (<>
              <div
                className="profileSummaryCard"
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.88)",
                  border: "1px solid rgba(10,40,75,0.08)",
                  marginBottom: 12,
                }}
              >
                <div className="profileIdentityHeader">
                  <span className="profileAvatar" aria-hidden="true"><UserRound size={21} strokeWidth={2} /></span>
                  <div>
                    <div className="profileEyebrow">Dados da conta</div>
                    <div className="profileTitle">{me?.full_name || "Usuário"}</div>
                  </div>
                  <span className="profileOrganizationBadge">{auth.organizationName || "Sem organização"}</span>
                </div>
              </div>

                <div className="profilePasswordCard" style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                <div>
                  <div className="profilePasswordTitle">Trocar senha</div>
                  <div className="profilePasswordHint">Escolha uma senha forte para manter sua conta protegida.</div>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pwOld}
                    onChange={(e) => setPwOld(e.target.value)}
                    type={showPwOld ? "text" : "password"}
                    placeholder="Senha atual"
                    style={{ ...inputStyle(), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwOld((v) => !v)}
                    aria-label={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                    title={showPwOld ? "Ocultar senha atual" : "Mostrar senha atual"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "rgba(0,0,0,0.72)",
                      padding: 0,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPwOld ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    type={showPwNew ? "text" : "password"}
                    placeholder="Nova senha"
                    style={{ ...inputStyle(), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew((v) => !v)}
                    aria-label={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                    title={showPwNew ? "Ocultar nova senha" : "Mostrar nova senha"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "rgba(0,0,0,0.72)",
                      padding: 0,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPwNew ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    value={pwNew2}
                    onChange={(e) => setPwNew2(e.target.value)}
                    type={showPwNew2 ? "text" : "password"}
                    placeholder="Confirmar nova senha"
                    style={{ ...inputStyle(), paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwNew2((v) => !v)}
                    aria-label={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    title={showPwNew2 ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "rgba(0,0,0,0.72)",
                      padding: 0,
                      width: 20,
                      height: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    {showPwNew2 ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </div>

                <button
                  className="profilePasswordSubmit"
                  onClick={changePassword}
                  disabled={pwLoading}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(10,40,75,0.18)",
                    background: "rgba(10,40,75,0.92)",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {pwLoading ? "Salvando..." : "Salvar nova senha"}
                </button>

                {pwMsg && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(0,0,0,0.10)",
                      background: "rgba(255,255,255,0.90)",
                      fontSize: 13,
                      color: "rgba(0,0,0,0.85)",
                    }}
                  >
                    {pwMsg}
                  </div>
                )}
              </div>
            </>);
}
