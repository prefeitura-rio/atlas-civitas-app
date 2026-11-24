import type { RefObject } from "react";
import civitasWhatsappIcon from "@/assets/icons/civitas/whatsapp.svg";
import civitasDownloadIcon from "@/assets/icons/civitas/Icon-1.svg";
import civitasInfoIcon from "@/assets/icons/civitas/Icon.svg";
import civitasEmergencyIcon from "@/assets/icons/civitas/e911_emergency.svg";
import civitasDetectionIcon from "@/assets/icons/civitas/motion_sensor_active.svg";
import civitasRadarIcon from "@/assets/icons/civitas/radar.svg";
import civitasJointPlatesIcon from "@/assets/icons/civitas/traffic_jam.svg";
import civitasCorrelatesIcon from "@/assets/icons/civitas/car_crash.svg";
import civitasMediaIcon from "@/assets/icons/civitas/videocam.svg";
import {
  civitasToolsSummary,
  civitasPanelTitle,
  civitasPanelSubtitle,
  civitasContactWhatsappHref,
  civitasContactEmail,
  civitasContactEmailHref,
  civitasModelPdfHref,
} from "./civitasContent";

type Props = {
  isMobile: boolean;
  civitasScrollRef: RefObject<HTMLDivElement | null>;
  civitasScrollThumbRef: RefObject<HTMLDivElement | null>;
  civitasScrollRailRef: RefObject<HTMLDivElement | null>;
  civitasHeroRef: RefObject<HTMLElement | null>;
};

export function CivitasPanel({ isMobile, civitasScrollRef, civitasScrollThumbRef, civitasScrollRailRef, civitasHeroRef }: Props) {
    const civitasToolIcons = [
      civitasEmergencyIcon,
      civitasDetectionIcon,
      civitasRadarIcon,
      civitasJointPlatesIcon,
      civitasCorrelatesIcon,
      civitasMediaIcon,
    ] as const;

    return (
      <div className="civitasPanelLayout">
        <div ref={civitasScrollRef} className="civitasPanelScroll">
          <header ref={civitasHeroRef} className="civitasHero">
            <div className="civitasHeroText">
              <div className="civitasHeroTitle">{civitasPanelTitle}</div>
              <div className="civitasHeroSubtitle">{civitasPanelSubtitle}</div>
            </div>
            <div className="civitasHeroActions">
              <a href={civitasContactWhatsappHref} className="civitasActionBtn civitasActionBtnGhost">
                <span className="civitasActionBtnIcon">
                  <img src={civitasWhatsappIcon} alt="" className="civitasActionBtnIconImg" />
                </span>
                Entrar em contato
              </a>
              <a href={civitasModelPdfHref} download className="civitasActionBtn civitasActionBtnPrimary">
                <span className="civitasActionBtnIcon">
                  <img src={civitasDownloadIcon} alt="" className="civitasActionBtnIconImg" />
                </span>
                Modelo de ofício (PDF)
              </a>
            </div>
          </header>

          <section className="civitasSection">
            <div className="civitasSectionTitle">
              <span className="civitasSectionBar" />
              Resumo das ferramentas da CIVITAS
            </div>

            {!isMobile ? (
              <div className="civitasSummaryList">
                {civitasToolsSummary.map((row, idx) => {
                  const toolIcon = civitasToolIcons[idx] ?? civitasDetectionIcon;
                  return (
                    <article key={row.tool} className="civitasSummaryRow">
                      <div className="civitasSummaryCol civitasSummaryToolCol">
                        <div className="civitasSummaryLabel">Ferramenta</div>
                        <div className="civitasSummaryToolLine">
                          <span className="civitasSummaryToolIcon">
                            <img src={toolIcon} alt="" className="civitasSummaryToolIconImg" />
                          </span>
                          <div className="civitasSummaryToolName">{row.tool}</div>
                        </div>
                      </div>
                      <div className="civitasSummaryCol">
                        <div className="civitasSummaryLabel">O que é</div>
                        <div className="civitasSummaryText">{row.what}</div>
                      </div>
                      <div className="civitasSummaryCol">
                        <div className="civitasSummaryLabel">Quando utilizar</div>
                        <div className="civitasSummaryText">{row.when}</div>
                      </div>
                      <div className="civitasSummaryCol">
                        <div className="civitasSummaryLabel">Resultado</div>
                        <div className="civitasSummaryText">{row.result}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="civitasSummaryMobileList">
                {civitasToolsSummary.map((row, idx) => {
                  const toolIcon = civitasToolIcons[idx] ?? civitasDetectionIcon;
                  return (
                    <article key={row.tool} className="civitasSummaryMobileCard">
                      <div className="civitasSummaryToolLine">
                        <span className="civitasSummaryToolIcon">
                          <img src={toolIcon} alt="" className="civitasSummaryToolIconImg" />
                        </span>
                        <div className="civitasSummaryToolName">{row.tool}</div>
                      </div>
                      <div className="civitasSummaryMobileBlock">
                        <div className="civitasSummaryLabel">O que é</div>
                        <div className="civitasSummaryText">{row.what}</div>
                      </div>
                      <div className="civitasSummaryMobileBlock">
                        <div className="civitasSummaryLabel">Quando utilizar</div>
                        <div className="civitasSummaryText">{row.when}</div>
                      </div>
                      <div className="civitasSummaryMobileBlock">
                        <div className="civitasSummaryLabel">Resultado</div>
                        <div className="civitasSummaryText">{row.result}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="civitasGuide">
            <div className="civitasGuideTitleRow">
              <span className="civitasGuideBadge">
                <img src={civitasInfoIcon} alt="" className="civitasGuideBadgeIcon" />
              </span>
              <div className="civitasGuideTitle">Como solicitar o uso das funcionalidades da CIVITAS</div>
            </div>
            <p className="civitasGuideText">
              Para usufruir das funcionalidades disponíveis no App CIVITAS e dos relatórios analíticos associados ao cerco
              eletrônico, a solicitação deve ser iniciada formalmente por meio de ofício, conforme previsto em lei,{" "}
              <a
                href="https://leis.org/municipais/rj/rio-de-janeiro/lei/decreto/2026/57481/decreto-n-57481-2026-dispoe-sobre-o-compartilhamento-tratamento-e-protecao-de-dados-e-imagens-no-ambito-da-central-de-inteligencia-vigilancia-e-tecnologia-de-apoio-a-seguranca-publica-civitas-e-da-outras-providencias"
                target="_blank"
                rel="noreferrer"
              >
                DECRETO RIO Nº 57.481, DE 12 DE JANEIRO DE 2026
              </a>
              .
            </p>

            <div className="civitasGuideRequirements">
              <div className="civitasGuideRequirementsTitle">Requisitos para a solicitação</div>
              <ul className="civitasGuideList">
                <li>
                  As solicitações devem ser encaminhadas por <strong>ofício eletrônico</strong>, assinado digitalmente pela
                  autoridade competente do órgão.
                </li>
                <li>
                Enviar ao endereço:{" "}
                  <a href={civitasContactEmailHref} style={{ fontWeight: 800 }}>
                    {civitasContactEmail}
                  </a>
                  .
                </li>
                <li>O documento deve conter: número e data do ofício, identificação do órgão requerente.</li>
                <li>Contatos do ponto focal responsável (e-mail e telefone).</li>
                <li>
                  Descrição objetiva da informação solicitada, incluindo local, data, horário, dinâmica e demais elementos
                  relevantes para análise.
                </li>
              </ul>
            </div>
          </section>
        </div>
        <div ref={civitasScrollRailRef} className="civitasScrollRail" aria-hidden="true">
          <div ref={civitasScrollThumbRef} className="civitasScrollThumb" />
        </div>
      </div>
    );
  }
