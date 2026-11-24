

export const civitasToolsSummary = [
    {
      tool: "Cerco Eletrônico",
      what: "Monitoramento em tempo real de veículos suspeitos, com geração automática de alertas",
      when: "Em situações de busca ativa, quando a placa do veículo já é conhecida",
      result: "Alertas em tempo real a cada nova detecção da placa monitorada nos equipamentos tecnológicos da Prefeitura",
    },
    {
      tool: "Pontos de Detecção",
      what: "Consultar todas as passagens de uma placa e reconstruir deslocamentos e rotas",
      when: "Quando há placa identificada e é preciso analisar trajetos ou presença em locais específicos",
      result: "Mapa com rotas, tabela cronológica de detecções, agrupamento em viagens e possíveis indícios de clonagem",
    },
    {
      tool: "Busca por Radar",
      what: "Identificar veículos que passaram em determinado local e período",
      when: "Quando não há placa definida, mas há local e horário da ocorrência",
      result: "Lista cronológica de placas detectadas em radar ou conjunto de radares",
    },
    {
      tool: "Placas Conjuntas",
      what: "Identificar veículos que trafegam junto com uma placa monitorada",
      when: "Quando suspeita-se de atuação em conjunto, batedores ou acompanhamento de veículos",
      result: "Lista de placas associadas, ranking de recorrência e frequência de passagens conjuntas",
    },
    {
      tool: "Placas Correlatas",
      what: "Identificar padrões entre diferentes veículos monitorados",
      when: "Investigações com múltiplos veículos ou análise de conexões entre ocorrências",
      result: "Grafo de conexões entre veículos e tabela ordenada por nível de correlação",
    },
    {
      tool: "Imagens e Gravações",
      what: "Solicitação de extração de imagens e/ou trechos de vídeo de câmeras específicas em um período e local",
      when: "Quando há necessidade de análise visual detalhada de um evento em ponto e intervalo de tempo",
      result: "Pacote com registros (imagens/gravações) identificados por câmera, data e horário",
    },
  ] as const;

export const civitasTabLabel = "ACIONAR A CIVITAS";

export const civitasPanelTitle = "Ferramentas da CIVITAS e como solicitar informações";

export const civitasPanelSubtitle = "Acesse os recursos disponíveis e saiba como fazer solicitações formais";

export const civitasContactWhatsappHref = "https://wa.me/5521989091247";

export const civitasContactEmail = "civitas@dados.rio";

export const civitasContactEmailHref = `mailto:${civitasContactEmail}`;

export const civitasModelPdfHref = "/Modelo_Oficio_CIVITAS_NOV26.pdf";
