# Documentos de auditoria

Módulo da Subcontroladoria de Controle Interno (SCI) para as equipes de
auditoria enviarem relatórios, notas técnicas e papéis de trabalho, e para a
Subcontroladoria analisar, pedir correção e aprovar. Os termos seguem o
glossário em `CONTEXT.md`.

## Fluxo

O documento nasce em análise com a versão 1. Cada ação avança o campo
`version` do documento; quem age com uma versão desatualizada recebe `409` e
precisa recarregar.

| Situação atual         | Ação                                | Quem               | Nova situação       | Evento                 |
| ---------------------- | ----------------------------------- | ------------------ | ------------------- | ---------------------- |
| (novo)                 | enviar                              | equipe (`submit`)  | em análise          | `submitted`            |
| em análise             | pedir correção (justificativa)      | revisão (`review`) | correção solicitada | `correction_requested` |
| em análise             | aprovar                             | revisão            | aprovado            | `approved`             |
| em análise             | salvar versão editada               | revisão            | em análise          | `edited`               |
| correção solicitada    | enviar nova versão (arquivo/editor) | equipe             | em análise          | `resubmitted`          |
| em análise ou correção | cancelar (justificativa)            | equipe ou revisão  | cancelado           | `cancelled`            |
| aprovado               | reabrir (justificativa)             | revisão            | em análise          | `reopened`             |

Cancelado é final. A máquina de estados é uma função pura em
`packages/contracts/src/audit-documents.ts` (`nextAuditDocumentStatus`), usada
pela API e pela interface.

Abrir um arquivo registra o evento `read` uma única vez por pessoa e versão.
Essa é a confirmação de leitura; não há botão de ciência.

### Segregação de funções

Quem enviou a versão atual como equipe não pode aprová-la, pedir correção dela
nem editá-la no navegador como revisão. A revisora que apenas editou a versão
pode aprová-la. Cada versão guarda
`uploaded_as` (`team` ou `reviewer`) para essa regra.

## Papéis e permissões

Todas as chaves aceitam escopo global ou por unidade (equipe).

| Permissão                 | Uso                                           |
| ------------------------- | --------------------------------------------- |
| `audit_documents.read`    | consultar documentos e arquivos da equipe     |
| `audit_documents.submit`  | enviar documentos, novas versões e cancelar   |
| `audit_documents.review`  | analisar, editar, aprovar, cancelar e reabrir |
| `audit_documents.reports` | consultar os indicadores                      |

Perfis de homologação: Assessor(a) de auditoria (`read`, `submit` na equipe),
Coordenador(a) de equipe de auditoria (`read`, `submit`, `reports` na equipe) e
Subcontrolador(a) (`read`, `review`, `reports` globais). `audit_documents.review`
pode ser delegada em substituições temporárias.

A configuração de gargalo (`bottleneck_rounds`, padrão 3) só muda com `review`
global ou `access.manage` global.

## Arquivos

- Aceitos: `.docx` e PDF, até 20 MB (20 971 520 bytes). Acima disso a API responde `413`.
- Extensão, MIME declarado e assinatura do arquivo precisam concordar.
- `.docx` é verificado pelo diretório central do zip: partes obrigatórias,
  sem macros (`vbaProject.bin` ou tipo `macroEnabled`), limite de entradas e de
  tamanho descompactado.
- PDF precisa ter camada de texto nas 3 primeiras páginas (PDF com OCR). PDF só
  com imagem é recusado com orientação para aplicar OCR ou enviar em `.docx`.
- Não há antivírus: risco aceito pela memória disponível na VPS.
- O objeto no MinIO usa a chave `audit-documents/<uuid>`, nunca o nome enviado.
  O nome original fica só para exibição. O SHA-256 é gravado em cada versão.

## Visualização e edição no navegador

Os arquivos passam sempre pela API (`GET /api/audit-documents/:id/files/:fileId`,
`Cache-Control: no-store`), sem URL pré-assinada. `?disposition=attachment`
baixa o arquivo; o padrão `inline` abre na tela. A auditoria registra
`file-viewed` ou `file-downloaded`.

- PDF abre no visualizador nativo do navegador.
- `.docx` é convertido no navegador e exibido em iframe com `sandbox` sem
  scripts.
- O editor converte o `.docx` em HTML, permite edição de texto simples e gera um
  novo `.docx` no navegador, enviado como nova versão com `source: editor`. O
  servidor valida o arquivo gerado como qualquer outro envio.

Limite de fidelidade: a conversão para HTML perde parte da formatação do Word
(estilos personalizados, cabeçalhos e rodapés, campos, comentários, controle de
alterações, layout de página). O editor serve para ajustes de texto. Mudanças
de formatação devem ser feitas no Word e enviadas como arquivo. Se as queixas
de fidelidade na visualização crescerem, a alternativa prevista é gerar
prévia em PDF no servidor (Gotenberg).

## Indicadores

`GET /api/audit-documents/metrics?from&to&unitId` exige
`audit_documents.reports` e registra `audit-document.metrics-read`. O período usa
dias de Manaus, com `to` inclusivo.

| Indicador                   | Definição                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Pendências por equipe       | agora: em análise (com a revisão) e em correção (com a equipe), com a data mais antiga   |
| Enviados                    | documentos com o primeiro envio no período (coorte)                                      |
| Aprovados agora, cancelados | da coorte, os que estão aprovados ou cancelados hoje                                     |
| Eventos de aprovação        | ações de aprovar no período; documento reaberto e aprovado de novo conta duas vezes      |
| Taxa de entrega             | aprovados agora dividido pelos enviados da coorte, no total e por equipe                 |
| Resposta da revisão         | da entrada em análise até a próxima aprovação ou pedido de correção (média e mediana, h) |
| Resposta da equipe          | do pedido de correção até a nova versão (média e mediana, h)                             |
| Rodadas de correção         | distribuição e os 10 documentos com mais rodadas, com o sinal de gargalo da configuração |
| Primeira leitura            | do envio de cada versão até a primeira abertura pela revisão                             |
| Confirmação de leitura      | versões enviadas no período já abertas pela revisão                                      |

"Revisão" nos indicadores de leitura é quem já aprovou, pediu correção ou
reabriu algum documento. É uma aproximação: se alguém com `review` só ler e
nunca decidir, a leitura não conta. A correção prevista é gravar no evento de
leitura se o leitor tinha `review` naquele momento.

## Avisos e caixa de pendências

- Envio e nova versão avisam as contas ativas com `review` na equipe, incluindo
  substitutos em vigor.
- Pedido de correção, aprovação, cancelamento, reabertura e edição da revisão
  avisam quem enviou alguma versão e ainda tem acesso ao documento (quem
  enviou como substituto deixa de ser avisado quando a substituição termina).
- Quem executou a ação não recebe aviso.
- A caixa de pendências mostra à revisão os documentos em análise do seu
  escopo e à equipe os documentos com correção solicitada.

## Controles de segurança

- Documento fora do escopo responde `404` e grava auditoria `denied`.
- Toda ação grava evento no documento e linha de auditoria, com delegação
  quando houver substituição.
- Transições usam `FOR UPDATE` e versão otimista.
- Envio de arquivos tem limite de 20 requisições por minuto.
- Respostas com conteúdo usam `Cache-Control: no-store`.

## Fase 2

Envio ao Apoena/SIGED por tabela de saída (outbox) e novo evento `dispatched`
(acréscimo ao enum, sem migração destrutiva). As unidades gestoras estaduais
entram pelo mesmo `unit_id`.
