import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "./map/shared";

type Props = {
  apiBase: string;
  accessToken: string;
  currentVersion: string | null;
  error?: string | null;
  onRetry?: () => void;
  onAccepted?: () => void;
};

const TERMS_DRAFT = `TERMO DE USO

Histórico de Revisões

Versão 1.0
Março/2026


1. DA CIÊNCIA DO TERMO DE USO:

O presente Termo de Uso estabelece as condições de utilização do sistema Atlas Civitas, sistema institucional mantido pela CIVITAS Rio - Centro Integrado de Vigilância, Tecnologia e Apoio à Segurança Pública, no âmbito da Prefeitura da Cidade do Rio de Janeiro.

O uso do sistema Atlas Civitas está condicionado à ciência do termo e do aviso associados. O usuário deverá ler e certificar-se de havê-los entendido, estar consciente de todas as condições estabelecidas no Termo de Uso e se comprometer a cumpri-las.

Ao utilizar o sistema Atlas Civitas, o usuário manifesta estar ciente em relação ao conteúdo deste Termo de Uso e estará legalmente vinculado a todas as condições aqui previstas.

2. DEFINIÇÕES DO TERMO DE USO:

Para os fins deste Termo de Uso, são aplicáveis as seguintes definições:

a) Agente público: Todo aquele que exerce, ainda que transitoriamente ou sem remuneração, por eleição, nomeação, designação, contratação ou qualquer outra forma de investidura ou vínculo, mandato, cargo, emprego ou função nos órgãos e entidades da Administração Pública, direta ou indireta.

b) Agentes de Estado: Inclui órgãos e entidades da Administração pública além dos seus agentes públicos.

c) Códigos maliciosos: São qualquer programa de computador, ou parte de um programa, construído com a intenção de provocar danos, obter informações não autorizadas ou interromper o funcionamento de sistemas e/ou redes de computadores.

d) Sítios e aplicativos: Sítios e aplicativos por meio dos quais o usuário acessa os serviços e conteúdos disponibilizados.

e) Terceiro: Pessoa ou entidade que não participa diretamente em um contrato, em um ato jurídico ou em um negócio, ou que, para além das partes envolvidas, pode ter interesse num processo jurídico.

f) Internet: Sistema constituído do conjunto de protocolos lógicos, estruturado em escala mundial para uso público e irrestrito, com a finalidade de possibilitar a comunicação de dados entre terminais por meio de diferentes redes.

g) Usuários: (ou "Usuário", quando individualmente considerado): Todas as pessoas naturais que utilizarem o sistema Atlas Civitas.

h) Sistema Atlas Civitas: sistema tecnológico institucional destinado ao apoio às atividades de planejamento, monitoramento e gestão da segurança urbana municipal.

i) Atlas Civitas: módulo destinado à visualização georreferenciada da infraestrutura de videomonitoramento.

j) Atlas Civitas Streaming: módulo destinado à visualização em tempo real das imagens captadas pelas câmeras integradas ao sistema.

3. ARCABOUÇO LEGAL:

O arcabouço legal aplicável ao Sistema Atlas Civitas públicas deste instrumento compreende os seguintes atos legislativos e normativos:

a) Lei nº 12.965, de 23 de abril de 2014 - Marco Civil da Internet - Estabelece princípios, garantias, direitos e deveres para o uso da Internet no Brasil.

b) Lei nº 12.527, de 18 de novembro de 2011 - Lei de Acesso à Informação - Regula o acesso a informações previsto na Constituição Federal.

c) Lei nº 13.460, de 26 de junho de 2017 - Dispõe sobre participação, proteção e defesa dos direitos do usuário dos serviços públicos da administração pública.

d) Lei nº 13.709, de 14 de agosto de 2018 - Dispõe sobre o tratamento de dados pessoais, inclusive nos meios digitais, por pessoa natural ou por pessoa jurídica de direito público ou privado, com o objetivo de proteger os direitos fundamentais de liberdade e de privacidade e o livre desenvolvimento da personalidade da pessoa natural.

e) Lei nº 14.129, de 29 de março de 2021 - Princípios, regras e instrumentos para o Governo Digital.

f) Lei nº 12.737, de 30 de novembro de 2012 - Dispõe sobre a tipificação criminal de delitos informáticos.

g) DECRETO RIO Nº 54984 DE 21 DE AGOSTO DE 2024 - Estabelece o Programa Municipal de Proteção de Dados Pessoais, institui a Política Municipal de Proteção de Dados Pessoais, dispõe sobre a aplicação da Lei Federal nº 13.709, de 2018, Lei Geral de Proteção de Dados Pessoais - LGPD, no âmbito da Administração Pública do Município do Rio de Janeiro, acrescenta os §§ 3º e 4º ao Decreto Rio nº 48.972, de 2021, revoga o Decreto Rio nº 49.558, de 2021, e dá outras providências.

h) DECRETO RIO Nº 53.700 DE 8 DE DEZEMBRO DE 2023 - Institui a Política de Segurança da Informação - PSI no âmbito do Poder Executivo Municipal, e dá outras providências.

i) Resolução CVL Nº 216, DE 15 DE DEZEMBRO DE 2023 - Regulamenta as diretrizes da Política de Segurança da Informação - PSI no âmbito do Poder Executivo Municipal.

j) Resolução SEGOVI Nº 91, DE 1º DE AGOSTO DE 2022 - Regulamenta o Programa de Governança em Privacidade e Proteção dos Dados Pessoais - PGPPDP.

k) Decreto Rio nº 54.602, de 03 de junho de 2024 - Institui a Central de Inteligência, Vigilância e Tecnologia em Apoio à Segurança Pública (CIVITAS), com a finalidade de integrar, processar e analisar dados para monitoramento urbano, identificação de padrões e apoio às ações dos órgãos municipais, do sistema de fiscalização, do sistema de justiça e das forças de segurança pública.

l) Decreto Rio nº 57.481, de 12 de janeiro de 2026 - Regulamenta o uso e o compartilhamento de informações no âmbito da CIVITAS - Central de Inteligência, Vigilância e Tecnologia em Apoio à Segurança Pública, estabelecendo regras de acesso, controle, integridade e sigilo dos dados entre órgãos públicos.

4. DESCRIÇÃO:

4.1. Sistema Atlas Civitas

4.2. CIVITAS Rio (Central de Inteligência, Vigilância e Tecnologia em Apoio à Segurança Pública)

4.3. O Sistema Atlas Civitas possui como finalidade subsidiar atividades institucionais de planejamento, análise territorial e apoio estratégico à segurança pública municipal. O Sistema é composta pelos seguintes módulos:

4.3.1. Atlas Civitas - Permite a visualização da localização georreferenciada (latitude e longitude) das câmeras sob gestão da CIVITAS, possibilitando análise territorial e planejamento operacional, sem acesso à visualização de imagens ou fluxos de vídeo.

4.3.2 Atlas Civitas Streaming - Permite a visualização em tempo real das imagens captadas pelas câmeras, exclusivamente para fins de:

monitoramento urbano;
prevenção de ocorrências;
resposta rápida;
apoio às atividades operacionais de segurança pública.


5. DIREITOS DO USUÁRIO DO SERVIÇO: De acordo com a Lei nº 13.460, de 26 de junho de 2017, são direitos básicos do usuário:

5.1. Participação no acompanhamento da prestação e na avaliação dos serviços;

5.2. Obtenção e utilização dos serviços com liberdade de escolha entre os meios oferecidos e sem discriminação;

5.3. Acesso e obtenção de informações relativas à sua pessoa constantes de registros ou bancos de dados, observado o disposto no inciso X do caput do art. 5º da Constituição Federal e na Lei nº 12.527, de 18 de novembro de 2011;

5.4. Proteção de suas informações pessoais, nos termos da Lei nº 12.527, de 18 de novembro de 2011;

5.5. Atuação integrada e sistêmica na expedição de atestados, certidões e documentos comprobatórios de regularidade; e

5.6. Obtenção de informações precisas e de fácil acesso nos locais de prestação do serviço, assim como sua disponibilização na internet, especialmente sobre:

horário de funcionamento das unidades administrativas;
serviços prestados pelo órgão ou entidade, sua localização exata e a indicação do setor responsável pelo atendimento ao público;
acesso ao agente público ou ao órgão encarregado de receber manifestações;
sitação da tramitação dos processos administrativos em que figure como interessado; e
valor das taxas e tarifas cobradas pela prestação dos serviços, contendo informações para a compreensão exata da extensão do serviço prestado.


6. RESPONSABILIDADES DO USUÁRIO:

6.1 - O usuário se responsabiliza pela precisão e pela veracidade dos dados informados e reconhece que a inconsistência deles poderá implicar a impossibilidade de se utilizar o sistema Atlas Civitas.

6.2 - Durante a utilização do serviço, a fim de resguardar e de proteger os direitos de terceiros, o usuário se compromete a fornecer somente seus dados pessoais, e não os de terceiros.

6.3 - O login e senha só poderão ser utilizados pelo usuário cadastrado. Ele se compromete em manter o sigilo da senha, que é pessoal e intransferível, não sendo possível, em qualquer hipótese, a alegação de uso indevido após o ato de compartilhamento.

6.4 - O usuário do serviço é responsável pela atualização dos seus dados pessoais e pelas consequências em caso de omissão ou erros nos dados fornecidos.

6.5 - O Usuário é responsável pela reparação de todos e quaisquer danos, diretos ou indiretos (inclusive decorrentes de violação de quaisquer direitos de outros usuários; de terceiros, inclusive direitos de propriedade intelectual; de sigilo; e de personalidade), que sejam causados à Administração Pública, a qualquer outro Usuário, ou ainda a qualquer terceiro, inclusive em virtude do descumprimento do disposto nestes Termos de Uso e Política de Privacidade ou de qualquer ato praticado a partir de seu acesso ao serviço.

6.6 - A Administração Pública Municipal do Rio de Janeiro não poderá ser responsabilizado pelos seguintes fatos:

Equipamento infectado ou invadido por atacantes;
Equipamento avariado no momento do consumo de serviços;
Proteção do computador;
Proteção das informações baseadas nos computadores dos usuários;
Abuso de uso dos computadores dos usuários;
Monitoração clandestina do computador dos usuários;
Vulnerabilidades ou instabilidades existentes nos sistemas dos usuários;
Perímetro inseguro.

6.7 - Em nenhuma hipótese, a Administração Pública Municipal do Rio de Janeiro será responsável pela instalação, no equipamento do Usuário ou de terceiros, de códigos maliciosos (vírus, trojans, malware, worm, bot, backdoor, spyware, rootkit, ou de quaisquer outros que venham a ser criados), em decorrência da navegação na Internet pelo Usuário.


7. RESPONSABILIDADE DA ADMINISTRAÇÃO PÚBLICA MUNICIPAL DO RIO DE JANEIRO:

7.1 - A Administração Pública Municipal se compromete a cumprir todas as legislações inerentes ao uso correto dos dados pessoais do cidadão de forma a preservar a privacidade dos dados utilizados no sistema Atlas Civitas, bem como a garantir todos os direitos e garantias legais dos titulares dos dados. Ela também se obriga a promover, independentemente de requerimentos, a divulgação em local de fácil acesso, no âmbito de suas competências, de informações de interesse coletivo ou geral por eles produzidas ou custodiadas. É de responsabilidade da Administração Pública Municipal implementar controles de segurança para proteção dos dados pessoais dos titulares.

7.2 - A Administração Pública Municipal poderá, quanto às ordens judiciais de pedido das informações, compartilhar informações necessárias para investigações ou tomar medidas relacionadas a atividades ilegais, suspeitas de fraude ou ameaças potenciais contra pessoas, bens ou sistemas que sustentam o Serviço ou de outra forma necessárias para cumprir com obrigações legais. Caso ocorra, a Administração Pública Municipal notificará os titulares dos dados, salvo quando o processo estiver em segredo de justiça.

8. AVISO DE PRIVACIDADE:

8.1 - O Aviso de Privacidade estabelecida pela CIVITAS Rio e utilizada pelo sistema Atlas Civitas trata da utilização de dados pessoais e faz parte de forma inerente do presente Termo de Uso, ressaltando-se que os dados pessoais mencionados por esse Serviço serão tratados nos termos da legislação em vigor.

8.2 - Para mais informações acesse nosso aviso de privacidade contida no item II deste instrumento;

9. INFORMAÇÕES PARA CONTATO:

9.1. Em caso de dúvidas relacionadas ao sistema Atlas Civitas, entre em contato pelo email civitas.lgpd@prefeitura.com.


AVISO DE PRIVACIDADE

Histórico de Revisões

Versão 1.0
Março/2026


Este Aviso de Privacidade foi elaborado em conformidade com o Marco Civil da Internet e com a Lei Geral de Proteção de Dados Pessoais.

A aplicação deste Aviso será pautada pelo dever de boa-fé e pela observância dos princípios previstos no art. 6º da LGPD dentre eles, o da finalidade, da adequação, da necessidade, do livre acesso; da qualidade dos dados, da transparência, da prevenção, da não discriminação e o da responsabilização e da prestação de contas.

1. DEFINIÇÕES:

Para melhor compreensão deste documento, neste Aviso de Privacidade, consideram-se:

a) Dado Pessoal: Informação relacionada a uma pessoa natural identificada ou identificável.

b) Titular: Pessoa natural a quem se referem os dados pessoais que são objeto de tratamento.

c) Dado Pessoal Sensível: Dado pessoal sobre origem racial ou étnica, convicção religiosa, opinião política, filiação a sindicato ou a organização de caráter religioso, filosófico ou político, dado referente à saúde ou à vida sexual, dado genético ou biométrico, quando vinculado a uma pessoa natural.

d) Agentes de tratamento: O controlador e o operador. Os indivíduos subordinados ou vinculados, como os funcionários, os servidores públicos ou as equipes de trabalho de um órgão ou de uma entidade, que atuam sob o poder diretivo do agente de tratamento não serão considerados como controladores ou operadores.

e) Controlador: órgão da Administração Direta ou entidade da Administração Indireta, do Poder Executivo do Município do Rio de Janeiro, a quem compete as principais decisões relativas aos elementos essenciais para o cumprimento da finalidade do tratamento de dados pessoais, bem como a definição da natureza dos dados pessoais tratados e a duração do tratamento.

f) Controladoria Conjunta: determinação conjunta, comum ou convergente, por dois ou mais controladores, das finalidades e dos elementos essenciais para a realização do tratamento de dados pessoais, por meio de acordo que estabeleça as respectivas responsabilidades quanto ao cumprimento da LGPD.

g) Operador: Pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados pessoais em nome do controlador.

h) Suboperador: contratado pelo operador para auxiliá-lo a realizar o tratamento de dados pessoais em nome do controlador, podendo ser equiparado ao operador perante à LGPD em relação às atividades que foi contratado para executar, no que se refere às responsabilidades.

i) Encarregado: pessoa indicada, mediante ato formal, pelo controlador e pelo operador, cujas identidade e informações de contato estarão divulgadas publicamente, de forma clara e objetiva, preferencialmente no sítio eletrônico do controlador e do operador, sendo responsável por atuar como canal de comunicação entre o controlador, o operador, os titulares dos dados e a Autoridade Nacional de Proteção de Dados - ANPD.

j) Anonimização: Utilização de meios técnicos razoáveis e disponíveis no momento do tratamento, por meio dos quais um dado perde a possibilidade de associação, direta ou indireta, a um indivíduo.

k) Dado Anonimizado: Dado relativo a um titular que não possa ser identificado, considerando a utilização de meios técnicos razoáveis e disponíveis na ocasião de seu tratamento.

l) Autoridade Nacional: Órgão da administração pública responsável por zelar, implementar e fiscalizar o cumprimento desta Lei em todo o território nacional.

m) Banco de Dados: Conjunto estruturado de dados pessoais, estabelecido em um ou em vários locais, em suporte eletrônico ou físico.

n) Consentimento: manifestação livre, informada e inequívoca pela qual o titular concorda com o tratamento de seus dados pessoais para uma finalidade determinada, não sendo a única nem a principal base legal possível para viabilizar o tratamento de dados pessoais.

o) Incidente de segurança com dados pessoais: qualquer evento adverso confirmado, relacionado à violação na segurança de dados pessoais, tais como acesso não autorizado, acidental ou ilícito que resulte na destruição, perda, alteração, vazamento ou ainda, qualquer forma de tratamento de dados inadequada ou ilícita, os quais possam ocasionar risco para os direitos e liberdades do titular dos dados pessoais.

p) Órgão de Pesquisa: Órgão ou entidade da administração pública direta ou indireta ou pessoa jurídica de direito privado sem fins lucrativos, legalmente constituída sob as leis brasileiras e com sede e foro no País, que inclua em sua missão institucional ou em seu objetivo social ou estatutário a pesquisa básica ou aplicada de caráter histórico, científico, tecnológico ou estatístico.

q) Transferência Internacional de Dados: Transferência de dados pessoais para país estrangeiro ou organismo internacional do qual o país seja membro.

r) Tratamento: Toda operação realizada com dados pessoais, como as que se referem à coleta, produção, recepção, classificação, utilização, acesso, reprodução, transmissão, distribuição, processamento, arquivamento, armazenamento, eliminação, avaliação ou controle da informação, modificação, comunicação, transferência, difusão ou extração.

s) Uso Compartilhado de Dados: Comunicação, difusão, transferência internacional, interconexão de dados pessoais ou tratamento compartilhado de bancos de dados pessoais por órgãos e entidades públicos no cumprimento de suas competências legais, ou entre esses e entes privados, reciprocamente, com autorização específica, para uma ou mais modalidades de tratamento permitidas por esses entes públicos, ou entre entes privados.


2. BASE LEGAL PARA TRATAMENTO:

2.1. O tratamento de dados pessoais é realizado com fundamento no art. 7º, incisos II e III da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), relacionados ao cumprimento de obrigação legal ou regulatória pelo controlador e à execução de políticas públicas previstas em leis e regulamentos ou respaldadas em contratos, convênios ou instrumentos congêneres, limitando-se às finalidades descritas no item 8 deste Aviso de Privacidade.

3. CONTROLADOR:

3.1 - Nome do Controlador: CIVITAS Rio - Centro de Inteligência, Vigilância e Tecnologia de Apoio à Segurança Pública - Prefeitura da Cidade do Rio de Janeiro.
3.2 - Endereço do Controlador: Rua Ulysses Guimarães, 300 - Cidade Nova, Rio de Janeiro - RJ, 20211-225.
3.3 - Endereço eletrônico do Controlador: https://civitas.rio.
3.4 - Nome do(a) encarregado(a) de dados do Controlador: Luan Ribeiro da Silva.
3.5.1 - E-mail do(a) encarregado(a) de dados do Controlador: civitas.lgpd@prefeitura.rio.

4. DIREITOS DO TITULAR DE DADOS PESSOAIS:

5.1 - O titular de dados pessoais possui os seguintes direitos, conferidos pela Lei Geral de Proteção de Dados Pessoais (LGPD):

Direito de confirmação e acesso (Art. 18, incisos I e II): é o direito do titular de dados de obter do serviço a confirmação de que os dados pessoais que lhe digam respeito são ou não objeto de tratamento e, se for esse o caso, o direito de acessar os seus dados pessoais.

Direito de retificação (Art. 18, inciso III): é o direito de solicitar a correção de dados incompletos, inexatos ou desatualizados.

Direito à limitação do tratamento dos dados (Art. 18, inciso IV): é o direito do titular de dados de limitar o tratamento de seus dados pessoais, podendo exigir a eliminação de dados desnecessários, excessivos ou tratados em desconformidade com o disposto na Lei Geral de Proteção de Dados Pessoais.

Direito de oposição (Art. 18, § 2º): é o direito do titular de dados de, a qualquer momento, opor-se ao tratamento de dados por motivos relacionados com a sua situação particular, com fundamento em uma das hipóteses de dispensa de consentimento ou em caso de descumprimento ao disposto na Lei Geral de Proteção de Dados Pessoais.

Direito de não ser submetido a decisões automatizadas (Art. 20): o titular dos dados tem direito a solicitar a revisão de decisões tomadas unicamente com base em tratamento automatizado de dados pessoais que afetem seus interesses, incluídas as decisões destinadas a definir o seu perfil pessoal, profissional, de consumo e de crédito ou os aspectos de sua personalidade.

Direito de informação sobre o compartilhamento de dados (Art. 18, inciso VII): é o direito do titular de dados de ser informado sobre as entidades públicas e privadas com as quais o controlador realizou uso compartilhado de seus dados pessoais.

5. QUAIS DADOS PESSOAIS SÃO TRATADOS:

No âmbito da utilização do sistema Atlas Civitas podem ser tratados os seguintes dados pessoais:
a) Dados cadastrais dos usuários autorizados do sistema:
nome completo;
CPF;
e-mail institucional;
matrícula funcional;
órgão de vinculação.

Esses dados são utilizados para a identificação do usuário, autenticação e gestão de acesso ao sistema. O acesso ao sistema é restrito a usuários vinculados a órgãos previamente autorizados, mediante solicitação formal e validação pela autoridade responsável do respectivo órgão.

b) As imagens são visualizadas em tempo real por meio do módulo Atlas Civitas Streaming, podendo, em determinadas situações, possibilitar a identificação direta ou indireta de pessoas naturais, sem utilização de tecnologias de reconhecimento facial.

Considerando que o monitoramento ocorre em espaços públicos, as imagens podem incluir, de forma incidental, crianças e adolescentes, hipótese em que o tratamento observará o disposto no art. 14 da Lei nº 13.709/2018 (LGPD), em atenção ao melhor interesse desses titulares.

6. COMO OS DADOS SÃO COLETADOS:

Os dados pessoais utilizados no serviço são coletados no momento do cadastro de usuários autorizados para acesso ao sistema, realizado mediante solicitação formal por meio de ofício encaminhado pelos órgãos demandantes autorizados. Para fins de autenticação e gestão de acesso, são coletados dados cadastrais como nome completo, CPF, e-mail institucional, matrícula funcional e órgão de vinculação. Adicionalmente, poderão ser tratados dados decorrentes das imagens captadas pelos sistemas de videomonitoramento urbano integrados ao módulo Atlas Civitas Streaming, quando tais imagens possibilitarem a identificação direta ou indireta de pessoas naturais.

7. QUAL O TRATAMENTO REALIZADO E PARA QUAL FINALIDADE:

No âmbito da plataforma Civitas Atlas, são realizadas operações de tratamento de dados pessoais como acesso, armazenamento, arquivamento, coleta, controle, distribuição, eliminação, recepção e utilização de dados.

O tratamento dos dados cadastrais dos usuários autorizados tem como finalidade viabilizar a criação de contas de acesso, autenticação por login e senha, gestão de permissões e registro de logs de utilização do sistema, garantindo o controle e a segurança do acesso ao sistema.

O tratamento relacionado ao módulo Atlas Civitas Streaming ocorre para permitir a visualização em tempo real de imagens provenientes de câmeras de videomonitoramento urbano, com a finalidade de apoiar atividades institucionais de monitoramento da cidade, análise territorial, gestão urbana e suporte às ações de segurança pública.

Esse tratamento fundamenta-se no art. 7º, inciso III, da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), referente à execução de políticas públicas previstas em leis e regulamentos, bem como nas competências atribuídas ao CIVITAS pelo Decreto Rio nº 54.602, de 3 de junho de 2024, especialmente em seus artigos 2º e 4º.

O acesso às imagens é restrito a agentes públicos devidamente autorizados, sendo permitido exclusivamente para visualização em tempo real, não havendo disponibilização de funcionalidades que permitam download, cópia, gravação ou extração das imagens pelos usuários do sistema.

DEFINIÇÃO DE TIPOS DE TRATAMENTO:

a) ACESSO - ato de ingressar, transitar, conhecer ou consultar a informação, bem como possibilidade de usar os ativos de informação de um órgão ou entidade, observada eventual restrição que se aplique.
b) ARMAZENAMENTO - ação ou resultado de manter ou conservar em repositório um dado.
c) ARQUIVAMENTO - ato ou efeito de manter registrado um dado, embora já tenha perdido a validade ou esgotado a sua vigência.
d) COLETA - recolhimento de dados com finalidade específica.
e) CONTROLE - ação ou poder de regular, determinar ou monitorar as ações sobre o dado.
f) DISTRIBUIÇÃO - ato ou efeito de dispor de dados de acordo com algum critério estabelecido.
g) ELIMINAÇÃO - ato ou efeito de excluir ou destruir dado do repositório.
h) RECEPÇÃO - ato de receber os dados ao final da transmissão.
i) UTILIZAÇÃO - ato ou efeito do aproveitamento dos dados.

8. COMPARTILHAMENTO DE DADOS:

Os dados pessoais tratados no âmbito do sistema Atlas Civitas poderão ser compartilhados com órgãos e entidades públicas, especialmente integrantes do Sistema de Justiça e das Forças de Segurança, quando necessário ao desempenho de suas competências institucionais, em conformidade com o Decreto Rio nº 54.733, de 26 de junho de 2024 sobre a criação da CIVITAS e DECRETO RIO Nº 57.481, DE 12 DE JANEIRO DE 2026, que dispõe sobre o compartilhamento, tratamento e proteção de dados e imagens, bem como com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD).

O fluxo regular de acesso às informações ocorre por meio do próprio sistema, sendo que os usuários autorizados possuem acesso restrito apenas à visualização dos dados, não sendo disponibilizadas funcionalidades que permitam download, extração, compartilhamento ou envio das informações para outros órgãos diretamente pelo sistema.

Adicionalmente, poderá ocorrer o compartilhamento com operadores responsáveis pelo desenvolvimento, manutenção e suporte técnico do sistema e sistemas tecnológicos utilizados pela CIVITAS, bem como com prestadores de serviços de infraestrutura tecnológica e armazenamento em nuvem, exclusivamente para fins de viabilizar o funcionamento, a segurança e a continuidade dos serviços.

Poderão ainda ser compartilhados com órgãos de controle, como a Controladoria Geral do Município do Rio de Janeiro e o Tribunal de Contas do Município, para fins de controle interno e externo da Administração Pública, auditoria e fiscalização.

A CIVITAS poderá, ainda, mediante ordem judicial ou requisição de autoridade competente, compartilhar informações necessárias para investigações, apuração de atividades ilícitas, suspeitas de fraude ou situações que representem ameaça à segurança de pessoas, bens ou serviços públicos, ou sempre que necessário para o cumprimento de obrigações legais ou regulatórias aplicáveis.

9. TRANSFERÊNCIA INTERNACIONAL DE DADOS:

Não haverá transferência internacional de dados pessoais. A plataforma Atlas Civitas realiza transferência de dados internacionalmente. Os detalhes sobre essa transferência são exibidos abaixo:

País: Estados Unidos (EUA);
Organização: Provedor de infraestrutura de computação em nuvem responsável pela hospedagem do Data Lake utilizado pela plataforma;
Garantia para a transferência: Art. 33, inciso II, da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), considerando a existência de garantias contratuais que asseguram o cumprimento dos princípios, direitos do titular e do regime de proteção de dados previsto na LGPD;
Dados transferidos: Metadados técnicos e registros operacionais relacionados ao funcionamento da plataforma Atlas Civitas, incluindo informações de geolocalização de câmeras e radares, identificadores técnicos dos dispositivos de monitoramento e registros necessários à operação, monitoramento e análise do sistema.

10. SEGURANÇA DOS DADOS:

Esse Aviso de Privacidade se submete à Política de Segurança da Informação - PSI no âmbito do Poder Executivo Municipal, constante do DECRETO RIO Nº 53.700, de 8 de dezembro de 2023, nos termos da RESOLUÇÃO CVL Nº 216, de 15 de dezembro de 2023.

11. COOKIES:

Não serão utilizados cookies próprios ou de terceiros.

12. TRATAMENTO POSTERIOR DOS DADOS PARA OUTRAS FINALIDADES:

Informações relacionadas ao uso do sistema, como registros de acesso, dados de navegação e logs de sistema, poderão ser utilizadas para fins de segurança da informação, melhoria contínua do sistema Atlas Civitas e aperfeiçoamento das atividades institucionais de planejamento, análise territorial e apoio à formulação e execução de políticas públicas.

13. MUDANÇAS:

13.1. A presente versão 1.0 deste instrumento foi atualizada pela última vez em: março/2026.
13.2. O editor se reserva o direito de modificar no site, a qualquer momento, as presentes normas, especialmente para adaptá-las às evoluções do sistema Atlas Civitas, seja pela disponibilização de novas funcionalidades, seja pela supressão ou modificação daquelas já existentes.
13.3. Qualquer alteração e/ou atualização neste instrumento passará a vigorar a partir da data de sua publicação no sítio do serviço e deverá ser integralmente observada pelos Usuários.

14. FORO:

14.1. Este instrumento será regido pela legislação brasileira. Fica eleito o Foro Central da Comarca da Capital do Estado do Rio de Janeiro para dirimir quaisquer dúvidas, renunciando as partes desde já a qualquer outro, por mais especial ou privilegiado que seja.
`;

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

  useEffect(() => {
    const el = termsBodyRef.current;
    if (!el) return;

    const checkScrollEnd = () => {
      const maxScroll = el.scrollHeight - el.clientHeight;
      if (maxScroll <= 4) {
        setScrolledToEnd(true);
        return;
      }
      setScrolledToEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 6);
    };

    checkScrollEnd();
    el.addEventListener("scroll", checkScrollEnd, { passive: true });
    window.addEventListener("resize", checkScrollEnd);

    return () => {
      el.removeEventListener("scroll", checkScrollEnd);
      window.removeEventListener("resize", checkScrollEnd);
    };
  }, []);

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
          padding: 14px;
          max-height: 62vh;
          overflow: auto;
          color: rgba(255,255,255,0.78);
          font-size: 13px;
          line-height: 1.55;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.24) rgba(8,10,16,0.95);
        }
        .termsBody::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .termsBody::-webkit-scrollbar-track {
          background: rgba(8,10,16,0.95);
          border-left: 1px solid rgba(255,255,255,0.06);
        }
        .termsBody::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.24);
          border-radius: 999px;
          border: 2px solid rgba(8,10,16,0.95);
        }
        .termsBody::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.36);
        }
        .termsPre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font-family: inherit;
          color: inherit;
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
        .termsHint {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(255,255,255,0.62);
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
        }
      `}</style>

      <div className="termsCard">
        <h1 className="termsTitle">TERMOS E CONDIÇÕES</h1>

        <div className="termsBody" ref={termsBodyRef}>
          <pre className="termsPre">{TERMS_DRAFT}</pre>
        </div>
        {!scrolledToEnd && (
          <div className="termsHint">Role até o final do texto para habilitar o aceite.</div>
        )}

        <label className={`termsRow ${!scrolledToEnd ? "termsRowDisabled" : ""}`}>
          <span className="termsCheck" data-checked={agree ? "true" : "false"}>
            {agree ? "✓" : ""}
          </span>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            disabled={!scrolledToEnd}
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
