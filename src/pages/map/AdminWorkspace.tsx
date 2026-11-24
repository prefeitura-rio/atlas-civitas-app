import type { Dispatch, RefObject, SetStateAction } from "react";
import type { FeatureCollection, Point } from "geojson";
import { ArrowLeft, ChevronRight, Clapperboard, MapPinned } from "lucide-react";
import type { AuthUser } from "../../app/auth";
import { API_BASE, type AdminTab, type PanelKey } from "./mapConfig";
import type { UserRole } from "./roles";
import { AdminUsersPanel } from "./AdminUsersPanel";
import { AdminOrganizationsPanel } from "./AdminOrganizationsPanel";
import { AdminCamerasPanel } from "./AdminCamerasPanel";
import { AdminRadaresPanel } from "./AdminRadaresPanel";
import { AdminLogsPanel } from "./AdminLogsPanel";
import { AdminUsageDashboardPanel } from "./AdminUsageDashboardPanel";
import { AdminNotificationsPanel } from "./AdminNotificationsPanel";
import { AdminButton } from "./AdminButton";
import { LayerToggle } from "./LayerToggle";

type Props = {
  activeAdminIsEquipment: boolean;
  activeAdminTab: AdminTab;
  activeAdminLabel: string;
  adminWorkspaceMainRef: RefObject<HTMLElement | null>;
  adminTabOptions: Array<{ key: AdminTab; label: string }>;
  setAdminTab: Dispatch<SetStateAction<AdminTab>>;
  setPanel: Dispatch<SetStateAction<PanelKey>>;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  isMobile: boolean;
  adminUsersOrgOpen: boolean;
  accessToken: string;
  role: UserRole;
  setAdminUsersOrgOpen: Dispatch<SetStateAction<boolean>>;
  me: AuthUser | null;
  cinematicMode: boolean;
  setCinematicMode: Dispatch<SetStateAction<boolean>>;
  poisGeo: FeatureCollection<Point>;
  loadCameras: () => Promise<void>;
  loadCamerasIntel: () => Promise<void>;
  loadCamerasLpr: () => Promise<void>;
  loadRadares: () => Promise<void>;
};

export function AdminWorkspace({
  activeAdminIsEquipment,
  activeAdminTab,
  adminWorkspaceMainRef,
  adminTabOptions,
  setAdminTab,
  setPanel,
  setPanelOpen,
  activeAdminLabel,
  isMobile,
  adminUsersOrgOpen,
  accessToken,
  role,
  setAdminUsersOrgOpen,
  me,
  cinematicMode,
  setCinematicMode,
  poisGeo,
  loadCameras,
  loadCamerasIntel,
  loadCamerasLpr,
  loadRadares,
}: Props) {
  return (<section className="adminWorkspace" aria-label="Administração">
          <main className={`adminWorkspaceMain ${activeAdminIsEquipment ? "adminWorkspaceMainEquipment" : ""} ${activeAdminTab === "notifications" ? "adminWorkspaceMainNotifications" : ""} ${activeAdminTab === "logs" ? "adminWorkspaceMainLogs" : ""}`} ref={adminWorkspaceMainRef}>
            <nav className="adminWorkspaceMobileNav" aria-label="Seções da administração">
              {adminTabOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={activeAdminTab === option.key ? "adminWorkspaceMobileNavActive" : ""}
                  onClick={() => setAdminTab(option.key)}
                  aria-current={activeAdminTab === option.key ? "page" : undefined}
                >
                  {option.label}
                </button>
              ))}
            </nav>
            <nav className="adminBreadcrumb" aria-label="Caminho de navegação">
              <button type="button" onClick={() => { setPanel(null); setPanelOpen(false); }}>Mapa</button>
              <ChevronRight size={14} aria-hidden="true" />
              <span>Administração</span>
              {activeAdminIsEquipment && (
                <>
                  <ChevronRight size={14} aria-hidden="true" />
                  <span>Equipamentos</span>
                </>
              )}
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">{activeAdminLabel}</span>
            </nav>

            <div className="adminWorkspaceHeader">
              <div>
                <h1>{activeAdminIsEquipment ? "Equipamentos" : activeAdminLabel}</h1>
                <p>{activeAdminIsEquipment ? activeAdminLabel : "Gerenciamento completo"}</p>
              </div>
              <AdminButton size="small" icon={isMobile ? undefined : ArrowLeft} className="adminWorkspaceClose" aria-label="Voltar ao mapa" onClick={() => { setPanel(null); setPanelOpen(false); }}>
                <span>Voltar ao mapa</span>
              </AdminButton>
            </div>

            <div className={`adminWorkspaceContent ${activeAdminIsEquipment ? "adminWorkspaceContentEquipment" : ""} ${activeAdminTab === "notifications" ? "adminWorkspaceContentNotifications" : ""} ${activeAdminTab === "logs" ? "adminWorkspaceContentLogs" : ""} ${adminUsersOrgOpen ? "adminWorkspaceContentDropdownOpen" : ""}`}>
              {activeAdminTab === "users" && (
                <AdminUsersPanel
                  apiBase={API_BASE}
                  token={accessToken}
                  viewerRole={role}
                  isMobile={isMobile}
                  onOrgDropdownOpenChange={setAdminUsersOrgOpen}
                />
              )}
              {activeAdminTab === "usage" && (
                <AdminUsageDashboardPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
              )}
              {activeAdminTab === "notifications" && role === "admin" && (
                <AdminNotificationsPanel key={me?.id} apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
              )}
              {!isMobile && activeAdminTab === "cinematic" && (
                <section className="adminCard adminCinematicCard" aria-labelledby="adminCinematicTitle">
                  <div className="adminCinematicHeading">
                    <span className="adminCinematicIcon"><Clapperboard size={22} aria-hidden="true" /></span>
                    <div>
                      <h2 id="adminCinematicTitle">Modo cinematográfico</h2>
                      <p>Mostra cada equipamento das camadas ativas no mapa, sem agrupamentos.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`adminCinematicToggle ${cinematicMode ? "adminCinematicToggleOn" : ""}`}
                    role="switch"
                    aria-checked={cinematicMode}
                    onClick={() => setCinematicMode((enabled) => !enabled)}
                  >
                    <span>{cinematicMode ? "Modo ativado" : "Ativar modo"}</span>
                    <LayerToggle checked={cinematicMode} />
                  </button>
                  <p className="adminCinematicNote">
                    {poisGeo.features.length.toLocaleString("pt-BR")} equipamentos nas camadas ativas. O mapa carrega os pontos em uma única fonte e desenha apenas os trechos visíveis na tela. O sistema deve ficar bem mais lento.
                  </p>
                  <AdminButton variant="primary" size="small" icon={MapPinned} style={{ justifySelf: "start" }} onClick={() => { setPanel(null); setPanelOpen(false); }}>
                    Ver mapa
                  </AdminButton>
                </section>
              )}
              {activeAdminTab === "organizations" && (
                <AdminOrganizationsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
              )}
              {(activeAdminTab === "cameras" || activeAdminTab === "smart_cameras" || activeAdminTab === "lpr") && (
                <AdminCamerasPanel
                  apiBase={API_BASE}
                  token={accessToken}
                  scope={activeAdminTab === "smart_cameras" ? "inteligentes" : activeAdminTab}
                  onStatusChanged={() => {
                    loadCameras();
                    loadCamerasIntel();
                    loadCamerasLpr();
                  }}
                  isMobile={isMobile}
                />
              )}
              {activeAdminTab === "radares" && (
                <AdminRadaresPanel
                  apiBase={API_BASE}
                  token={accessToken}
                  onStatusChanged={() => loadRadares()}
                  isMobile={isMobile}
                />
              )}
              {activeAdminTab === "logs" && (
                <AdminLogsPanel apiBase={API_BASE} token={accessToken} isMobile={isMobile} />
              )}
            </div>
          </main>
        </section>);
}
