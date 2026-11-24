import { useState } from "react";
import { API_BASE } from "./mapConfig";
import { fetchJson } from "./shared";

export function usePasswordChange(accessToken: string) {
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [showPwOld, setShowPwOld] = useState(false);
  const [showPwNew, setShowPwNew] = useState(false);
  const [showPwNew2, setShowPwNew2] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);


  async function changePassword() {
    setPwMsg(null);

    if (!pwOld || !pwNew || !pwNew2) return setPwMsg("Preencha todos os campos.");
    if (pwNew !== pwNew2) return setPwMsg("As senhas novas não batem.");
    if (pwNew.length < 8) return setPwMsg("Senha muito curta (mínimo 8).");

    setPwLoading(true);
    try {
      await fetchJson(`${API_BASE}/users/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ old_password: pwOld, new_password: pwNew }),
      });

      setPwOld("");
      setPwNew("");
      setPwNew2("");
      setPwMsg("Senha alterada com sucesso.");
    } catch (e: any) {
      console.error(e);
      setPwMsg(e?.message || "Erro ao trocar senha.");
    } finally {
      setPwLoading(false);
    }
  }
  return {
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
  };
}
