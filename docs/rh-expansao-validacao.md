# Expansão de RH — execução e evidências

Base: `origin/main` em `93a2ad3`, branch `codex/rh-expansao`.

Interfaces de teste confirmadas pelo usuário: APIs HTTP públicas com banco
isolado e jornadas Playwright. Cada fluxo segue vermelho → verde, sem mocks
dos serviços internos. O script E2E usa exclusivamente `intranet_cge_e2e`.

## Escopo de entrega

| Card ClickUp    | Fluxo                            | Situação            |
| --------------- | -------------------------------- | ------------------- |
| 86e2yxq8t       | Meu dossiê                       | Validado localmente |
| 86e2yxq9a       | Documentos privados              | Validado localmente |
| 86e2yxq8z       | Solicitações funcionais          | Validado localmente |
| 86e2yxq8m       | Correções cadastrais             | Validado localmente |
| 86e2yxq96       | Ocorrências e afastamentos       | Validado localmente |
| 86e2yxq9f       | Disponibilidade da equipe        | Validado localmente |
| 86e2yxq9m       | Capacitações                     | Validado localmente |
| 86e2yxq9j       | Indicadores operacionais         | Validado localmente |
| 86e2yych4       | Histórico de vínculos            | Validado localmente |
| 86e2yychg       | Checklists                       | Validado localmente |
| 86e2yychv       | Pendências e substituições       | Validado localmente |
| 86e2yycjm       | Estrutura e força de trabalho    | Validado localmente |
| 86e2z2bgg       | Comunicados segmentados          | Validado localmente |
| 86e2z2bg4       | Políticas e formulários          | Validado localmente |
| 86e2z2bh1       | Notificações internas            | Validado localmente |
| Épico 86e2yxq7q | Simplificação do fluxo de férias | Validado localmente |

## Limites preservados

Autosserviço e rotinas internas; não calcular direitos, folha ou saldos oficiais.
Reutilizar cadastro, permissões por unidade, auditoria, componentes e storage.
Documentos sensíveis não são automaticamente acessíveis à chefia.
Não concluir cards antes dos critérios de aceite e testes correspondentes.

## Base verificada

- Notificações: vermelho inicial confirmou ausência do aviso de férias. Férias
  e atribuição de checklists agora gravam avisos na mesma transação do evento.
  Documentos com ciência reproduziram rejeição do novo campo; implementação
  registra titular/data, confirmação concorrente idempotente e auditoria única.
  Rodada integrada: sete testes passaram cobrindo também avisos de solicitações,
  correções, ocorrências e capacitações, sem incluir conteúdo privado.
  Falha real de persistência do aviso reverteu a decisão de férias; repetir a
  mesma versão após recuperar o banco passou. Migrações 0023–0024 somente E2E.
  Tela passou leitura individual/em lote, contador sem recarga, falha na
  consulta posterior sem perder leitura, recuperação e entrada pela Minha conta.
  Paginação de 51 avisos e isolamento da leitura entre contas passaram. Revisão
  encontrou dois P2: página indicada divergente dos resultados em caso de falha
  e carregamento permanente após erro inicial. Vermelho reproduzido; ambos
  corrigidos e considerados resolvidos no verdict pass `ship`, com regressão de
  paginação atrasada/falha e recuperação inicial. Ciência no dossiê passou em
  dois E2E de documentos (publicação, confirmação por teclado, recarga e
  download privado) e revisão `ship`. Axe sem violações/overflow em 1280/390 px.
- Biblioteca: primeiro vermelho por rota ausente; publicação HTTPS, busca por
  título/resumo/categoria, tipo, público e vigência passaram. PDF reproduziu
  upload rejeitado antes da implementação; aceita arquivo válido acima de 5 MB,
  recusa acima de 10 MB, MIME inválido e PDF falso. Download autenticado e
  administrativo auditado, sem expor chave de storage. Falhas de gravação
  parcial e restrição real no banco isolado não deixam objetos ou metadados.
  Nova versão reproduziu 404; rodada integrada de quatro testes passou com
  conteúdo anterior imutável, PDF histórico preservado, concorrência 201/409,
  ciência idempotente por versão e arquivamento sem reativar versões antigas.
  Typecheck/eslint passaram; migrações 0020–0022 aplicadas somente no E2E.
  Interface passou no E2E: publicação de PDF, download, revisão com falha 503
  preservando campos, histórico, ciência por teclado persistida após recarga e
  arquivamento. Axe sem violações e sem overflow em 1280/390 px. Revisão final
  `ship`; uso do DateInput compartilhado também revalidado. DESIGN.md e sidecar
  receberam somente regra aditiva de preservação da busca/filtros/página ao
  navegar entre lista e detalhe. Concluído localmente, sem deploy.
- Comunicados: primeiro vermelho HTTP 404; publicação segmentada e ciência
  idempotente passaram. Segundo vermelho na edição ausente; dois testes de API
  passaram juntos com público geral/unidades/categorias, confirmação de mudança
  de público, edição concorrente 200/409, invalidação da ciência anterior,
  agendamento/expiração automáticos, arquivamento e auditoria. Markdown usa
  micromark com HTML e protocolos perigosos desabilitados. Migração 0019 aplicada
  somente no banco E2E; typecheck e eslint passaram.
  Interface reproduziu ausência da página e passou com rascunho, publicação,
  falha 503 preservando campos, leitura no início/RH, ciência persistida,
  teclado, Axe e overflow em 1280/390 px. Detector `[]`. Revisão independente
  encontrou modo administrativo indevido ao gestor abrir link de leitura;
  reproduzido em vermelho e corrigido usando a URL como fonte do modo.
  Rodada integrada: quatro testes passaram, incluindo gestor lendo/confirmando
  ciência, recarregando e alternando explicitamente para gestão. Typecheck/eslint
  passaram; revisor marcou P2 resolvido (`ship` no escopo do achado).
  Capturas renovadas e documentação visual sincronizada após a correção.
- Estrutura e cargos: primeiro fluxo HTTP reproduziu 404 e passou após a
  implementação. Ocupação/vagas derivadas de vínculos ativos, cargo descritivo
  preservado, associação versionada e auditada. Segundo ciclo reproduziu a
  ausência da edição e passou com confirmação para redução abaixo da ocupação,
  bloqueio de inativação ocupada, código único por unidade e concorrência 200/409.
  `pnpm typecheck` passou. Movimentações, hierarquia, escopo e interface ainda
  em implementação; o card não está concluído.
- Estrutura: rodada integrada de três testes HTTP passou com ciclos diretos e
  concorrentes bloqueados, leitura/gestão por unidade, totais sem vazamento,
  transferência liberando a associação de origem e desligamento liberando
  ocupação. A transferência reproduziu erro 500 antes da correção no ponto
  compartilhado por movimentações manuais e importação; liberação auditada.
  Interface passou com criação/edição, associação, redução confirmada,
  inativação, hierarquia e recuperação de 503 por teclado; Axe e overflow
  em 1280/390 px passaram. Revisão identificou conflito que exigia descartar
  edição; reproduzido em vermelho e corrigido com atualização da referência
  sem perder campos nem salvar automaticamente. Revisor marcou o achado
  resolvido (`ship`). Rodada integrada final: seis testes passaram, incluindo
  conflitos de cargo, associação e hierarquia. Typecheck/eslint passaram;
  capturas em 1280/390 px e documentação visual sincronizadas.
- `pnpm test`: 26 testes passaram antes das alterações.
- Arquivos locais preexistentes em `.scratch/hr-expansao-cge/` preservados.
- Dossiê: vermelho inicial (404); verde com vínculo, sessão inválida, rejeição
  de identificador externo, Axe e overflow em 1280/390 px. Caso sem vínculo passou.
- Typecheck da API e web passaram após implementação do dossiê.
- Revisão visual independente: `ship`, sem achados materiais no escopo.
- Detector visual do dossiê: `[]`.
- Card de dossiê concluído com comentários de evidência; nenhum deploy realizado.
- Férias: vermelho na ausência de “Data inicial”; verde com datas nativas,
  duração, envio e Axe mobile. Calendário adicional removido; rascunho preservado.
- Corrida após importação reproduzida em E2E e trace; recarga do diretório usa
  filtros atuais e ignora respostas antigas. Jornada completa passou após a correção.
- `pnpm test:e2e tests/e2e/hr-requests.spec.ts tests/e2e/intranet.spec.ts`:
  5 passaram (previsões, solicitações, importação/férias, teclado, rate limit).
- `pnpm typecheck`: passou com solicitações e notificações.
- Complementos e notificações de solicitações: jornada HTTP/browser passou.
- Solicitações: ainda faltam casos negativos adicionais
  e integração de substituições. Notificações: integração inicial com solicitações;
  os demais fluxos serão integrados nas próprias entregas.
- Solicitações: duas regressões de interface reproduzidas em vermelho e corrigidas:
  ação de cancelamento mostrada ao gestor em registro de outro titular e resposta
  HTTP atrasada sobrescrevendo a fila escolhida. Lista e acompanhamento agora
  carregam separadamente, com cancelamento de consultas antigas; ações de titular
  usam a conta real. Rodada integrada com complementos e correções: 5 passaram.
  Typecheck e eslint passaram; substituições ainda pendentes.
  Revisão independente `ship` no escopo do refinamento de segurança; padrões
  já cobertos em DESIGN.md, sem nova regra ou alteração de identidade.
- Regressão unitária após checklists: `pnpm test`, 26 testes passaram.
- Documentos: publicação na interface, download privado, arquivamento, unidade
  incorreta, permissões sensíveis, MIME, limite de 5 MB e PDF falso passaram.
  PDF falso reproduzido em vermelho (201 indevido), corrigido com parsing isolado
  por worker, limite de 5 segundos e memória de 128 MB.
- Falhas de storage e de FK real após upload: 500 sem metadado ou objeto órfão.
  Banco real isolado; somente a fronteira de storage foi simulada nesse teste.
- Formulário de publicação recolhe após sucesso; Axe e overflow passaram em
  1280/390 px. Detector de documentos/notificações: `[]`.
- Revisão independente de documentos encontrou seleção residual ao trocar a
  busca de titular. Reproduzida em vermelho; correção passou em E2E e o revisor
  marcou o P1 como resolvido (`ship` no escopo revisto).
- Histórico: primeiro teste vermelho por rota ausente. Implementação inicial
  de ingresso, movimentação atômica e versão passou; não concluído.
- Histórico: recuperação das opções e distinção entre gravação salva e releitura
  falha reproduzidas em vermelho e corrigidas. Jornada de navegador, Axe e
  overflow passaram em 1280/390 px; revisão independente dos dois P2: `ship`.
- Proveniência: reimportação preserva a data da última alteração do campo manual;
  teste reproduziu a data indevidamente alterada antes da correção e passou depois.
- Correções: 3 testes passaram (API, interface, rejeição, unidades de origem/destino
  e duas aprovações concorrentes: 200/409). Decisão e PeopleService compartilham
  a transação; envio/rejeição não alteram cadastro. Somente diferenças persistidas.
  Reconciliação explícita na prévia da importação validada; indicador agregado
  de divergências ainda depende da entrega de indicadores.
- Rodada integrada de histórico/correções/reconciliação: 10 testes passaram.
  Limite de login gerava 429 em testes independentes; clientes E2E agora têm
  identificadores de rede isolados. Limite real preservado e teste da sexta
  tentativa bloqueada passou. Sem mudanças no rate limiter da aplicação.
- Reconciliação: os três achados da revisão foram marcados como resolvidos
  (`ship` no escopo): desligamento legado só após confirmação, arquivo bloqueado
  durante validação e aplicação parcial/zero sem falso sucesso. Capturas renovadas
  em 1280/390 px; documentação visual atualizada após as correções.
- Histórico concluído no ClickUp com evidências locais, sem deploy.
- Ocorrências: catálogo/envio passou após vermelho 404; cobre escopo de criação,
  tipo inativo, datas inválidas e comprovante obrigatório. Decisões versionadas,
  cancelamento, rejeição, privacidade, anexos e sobreposição com férias passaram.
- Ocorrências: 8 testes de API/browser nas respectivas rodadas passaram, incluindo
  falha de upload com retomada do mesmo rascunho, troca de chefia antes/depois do
  envio, RH em unidade incorreta e leitura privada auditada com permissão distinta.
  Concorrência de confirmação: 201/409. Interface, Axe e overflow em 1280/390 px;
  detector `[]`; revisão independente `ship`, documentação atualizada. Sem deploy.
- Disponibilidade: primeiro teste vermelho por rota ausente (404).
  Três testes passaram em conjunto: composição férias/ocorrências, motivos
  protegidos, ausência sem impacto excluída, cancelamento, escopo do RH por unidade
  e equipe atual após troca de chefia. Interface com datas nativas, navegação mensal,
  teclado, recuperação de falha, Axe e overflow em 1280/390 px. Link direto abre
  a análise de férias; primeiro vermelho reproduziu link sem abertura do diálogo.
  Detector `[]` e revisão visual independente `ship`.
- Capacitações: teste inicial vermelho por rota ausente (404); fluxo em implementação.
  Três testes HTTP passaram juntos: envio, carga horária/período, validação e
  concorrência 200/409, rejeição justificada, arquivamento e histórico validado.
  Certificado com política definida pelo RH usa os documentos privados; PDF falso
  e MIME incorreto bloqueados. Falha de storage após gravação parcial e falha real
  de FK deixam listas HTTP de capacitações/documentos sem registro parcial e
  removem o objeto. Interface/dossiê passaram no E2E, incluindo confirmação de
  arquivamento e retirada do dossiê. Typecheck passou. Revisão independente apontou
  perda de foco ao abrir o acompanhamento; reproduzida com resposta atrasada,
  corrigida com carregamento independente e atributos de expansão. E2E passou
  preservando foco antes/depois da resposta; revisão do achado: resolvido, `ship`.
  Capturas renovadas em 1280/390 px, documentação visual sincronizada.
- Indicadores: vermelho inicial 404; primeiro teste HTTP passou com contagens
  de solicitações, isolamento de unidade, conteúdo privado omitido, ausência de
  acesso distinta de ausência de dados e datas inválidas bloqueadas.
  Teste de média passou: dois atendimentos de quatro e dois dias resultam em
  72 horas; conclusão após meia-noite de Manaus fica fora. Reconciliação passou
  com contador agregado de divergências mudando de 1 para 0.
  Quatro testes de indicadores passaram juntos, incluindo transições das filas,
  UI, teclado, recuperação de falha, Axe e overflow. Detector `[]` e typecheck/
  eslint passaram. Revisão independente pediu explicitar unidade consultada e
  separar validação de filtros do retry de consulta. Ambos reproduzidos em
  vermelho, corrigidos e aprovados no verdict pass (`ship`, dois resolvidos).
  Cinco testes de indicadores passaram nas rodadas correspondentes; capturas
  atualizadas em 1280/390 px. O agregado conclui o critério restante de correções.
- Checklists: primeiro teste vermelho por rota ausente (404), antes da implementação.
  Primeiro teste HTTP passou: cópia do modelo preservada após edição, responsáveis,
  dispensa obrigatória, progresso, auditoria e concorrência 200/409. Typecheck e
  eslint passaram. Interface e alerta de desligamento em implementação.
  Jornada de navegador passou: criar modelo, atribuir responsáveis, iniciar,
  registrar desligamento com alerta não bloqueante e concluir/dispensar depois.
  Rodada integrada adicional: 3 testes passaram (escopo de vínculos/responsáveis,
  revogação de permissão, checklist UI e regressão do histórico). Typecheck,
  eslint, Axe/overflow em 1280/390 px passaram; detector `[]`, revisão independente
  `ship` e documentação visual sincronizada. Nenhum provisionamento externo.
- Pendências: vermelho inicial 404; primeiro teste HTTP passou com solicitações
  acionáveis, pedido de complemento ao titular, retorno ao RH, conclusão,
  isolamento por conta e ausência do conteúdo privado. Sem tabela de tarefas.
  Typecheck/eslint passaram. Demais fontes, interface e substituições em andamento.
  As cinco fontes passaram juntas nos testes HTTP (2 testes). Interface adicionada
  ao painel e à página de pendências, com o mesmo total, filtros e paginação.
  Atalhos agora respeitam as filas de solicitações, capacitações e ocorrências.
  Rodada integrada: 4 testes passaram, incluindo erro HTTP com recuperação por
  teclado, Axe/overflow em 1280/390 px e indisponibilidade real da tabela de
  capacitações no banco descartável: demais fontes preservadas, aviso parcial,
  auditoria e recuperação após restabelecimento. Typecheck/eslint passaram;
  detector `[]`. Capturas do painel com cinco itens e da caixa nos dois tamanhos
  aprovadas na revisão independente (`ship` no escopo caixa/painel); regra visual
  de consulta parcial sincronizada no DESIGN.md e no sidecar. Substituições em implementação;
  não concluir o card da caixa nem o de atendimento por esta entrega parcial.
  Substituições: primeiro teste vermelho por rota inexistente (404). Migração
  0017 adiciona substituições explícitas por conta, unidade, período e fluxo.
  Primeiro teste HTTP passou: criação autorizada, encaminhamento com origem,
  retirada da caixa original, fila da chefia substituta, documentos/atendimento
  não herdados e cancelamento com retorno da pendência à chefia. Somente chefia
  de férias coberta nesta etapa; decisão, demais fluxos, edição e interface
  permanecem em implementação. Typecheck/eslint e 26 testes unitários passaram.
  Decisão delegada passou na rodada integrada com as cinco fontes (4 testes):
  ator real e origem registrados no evento; autoaprovação bloqueada e pendência
  mantida na chefia original nesse caso. Teste de edição/período passou: retorno
  à chefia quando o substituto recebe negativa explícita, períodos futuros e
  vencidos, edição versionada concorrente 200/409, sobreposição bloqueada e
  impossibilidade de redelegar autoridade temporária. Typecheck/eslint passaram.
  Cobertura ampliada: cinco fluxos de gestão passaram juntos (atendimento,
  decisão final de férias e ocorrências, capacitação e gestão de checklists),
  com encaminhamento, execução e ator real na auditoria. Regressão de férias
  impede a própria solicitação na fila delegada. Chefia de ocorrências passou
  em teste separado: fila/detalhe/decisão compartilham a autoridade, preservam
  conteúdo privado e registram a origem; revogar a permissão original retira
  o acesso imediatamente. Responsável de checklist também passou: somente
  itens atribuídos são delegados, sem gestão da unidade; cancelamento revoga
  o detalhe e a auditoria mantém o substituto e a origem. Typecheck passou.
  Interface administrativa e regressão integrada permanecem em andamento.
  Etapa concluída: tela de cadastro/edição/cancelamento com busca de contas,
  datas nativas e fluxos explícitos. Dois E2E de interface passaram, incluindo
  origem visível na caixa e atualização de acesso sem recarregar a página.
  Revisão visual aprovou composição e encontrou risco de perda de campos por
  ações simultâneas. Reproduzido em vermelho, corrigido e marcado resolvido
  no verdict pass (`ship`); os dois E2E passaram novamente com PUT retido,
  falha 503, preservação dos campos e retomada por teclado. Axe/overflow em
  1280/390, detector `[]`, typecheck e eslint passaram; documentação sincronizada.
  Rodada integrada final desta etapa: 10 testes passaram (sete de substituições,
  duas fontes de pendências e casos negativos de atendimento). Cobre todos os
  oito fluxos selecionáveis, período/revogação, isolamento por unidade, ausência
  de delegação em cadeia, autoaprovação, auditoria com ator/origem e conflitos.
  Atendimento validou também entrada estrita, estados inválidos, complemento
  sem solicitação, prazo passado, rejeição concorrente 200/409 e cancelamento
  pelo titular. Fecha os critérios restantes de atendimento e pendências.

## Sincronização pendente do ClickUp

Em 08/09/2026, após iniciar o card de indicadores, o conector retornou
`RATE_LIMIT_EXCEEDED` com espera aproximada de 20 horas. Não repetir chamadas
durante o bloqueio nem considerar movimentações futuras como realizadas.
Registrar abaixo as entregas locais validadas para sincronização posterior.

- `86e2yxq9m` — mover para concluído após desbloqueio, com as evidências locais
  de capacitações acima. Código/testes prontos; card ainda em progresso no ClickUp.
- `86e2yxq9j` e `86e2yxq8m` — mover para concluído após desbloqueio, com evidências
  de indicadores e reconciliação acima; cards ainda em progresso no ClickUp.
- `86e2yychg` — mover para concluído após desbloqueio, com evidências dos três
  testes de checklists e da regressão do histórico acima; card ainda pendente
  no ClickUp. Implementação e validação locais concluídas, sem deploy.
- `86e2yxq8z` e `86e2yychv` — mover para concluído após desbloqueio com a rodada
  integrada de 10 testes, os dois E2E de interface e o verdict pass acima.
  Concluídos localmente, sem deploy; estados remotos não foram alterados.
- `86e2yycjm` — mover para concluído após desbloqueio com os seis testes
  integrados de estrutura/cargos, revisão e recuperação de conflitos acima.
  Concluído localmente, sem deploy; estado remoto não foi alterado.
- `86e2z2bgg` — mover para concluído após desbloqueio com os quatro testes
  integrados de comunicados, segurança de Markdown e correção do modo de leitura.
  Concluído localmente, sem deploy; estado remoto não foi alterado.
- `86e2z2bg4` — mover para concluído após desbloqueio com os quatro testes de
  API/storage, E2E de publicação/revisão/ciência e revisão `ship` da biblioteca.
  Concluído localmente, sem deploy; estado remoto não foi alterado.
- `86e2z2bh1` — mover para concluído após desbloqueio com os sete testes de
  origens, rollback real, paginação/isolamento, E2E de leitura/contador/recuperação
  e ciência documental. Dois P2 da revisão resolvidos; concluído localmente,
  sem deploy; estado remoto não foi alterado.
