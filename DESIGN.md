---
name: Intranet CGE Amazonas
description: Sistema institucional existente para serviços internos em português.
colors:
  brand: "#075f63"
  brand-strong: "#044b4e"
  brand-soft: "#e5f3f2"
  canvas: "#f4f6f6"
  surface: "#ffffff"
  surface-subtle: "#f1f4f4"
  border: "#dde4e4"
  text: "#102326"
  text-muted: "#536568"
  text-faint: "#637174"
  success: "#087a54"
  success-soft: "#e2f8ef"
  warning-soft: "#fff6dd"
  warning-border: "#f0d999"
  warning-strong: "#7a5a08"
  danger: "#a92952"
  danger-strong: "#8d1f44"
  danger-soft: "#fdeaf0"
typography:
  headline:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "24px"
    fontWeight: 800
    lineHeight: "32px"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "28px"
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "14px"
    lineHeight: "20px"
  label:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
rounded:
  badge: "6px"
  small-control: "8px"
  navigation: "9px"
  control: "10px"
  surface: "14px"
spacing:
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.control}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
  badge-neutral:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  navigation-active:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-strong}"
    rounded: "{rounded.navigation}"
---

# Design System: Intranet CGE Amazonas

## Overview

Intranet institucional, calma e precisa, com texto em português e ações diretas. Preservar o sistema visual existente e evitar formulários desnecessariamente complexos.

Registro extraído de `packages/ui/src/styles.css`, dos componentes compartilhados e de `apps/web/src/components/app-shell.tsx`. Os valores acima documentam a implementação; alterações futuras devem partir dessas fontes. Não constituem uma nova identidade visual.

## Colors

O verde-petróleo `brand` identifica ações principais; `brand-strong` reforça estados e `brand-soft` destaca navegação ativa. Os aliases CSS `action`, `action-hover` e `action-soft` apontam para esses tokens.

Fundos claros, bordas discretas e três níveis de texto organizam o conteúdo. Sucesso, aviso e perigo têm tokens semânticos próprios: acompanham texto de estado, sem depender apenas da cor. O foco compartilhado está documentado no sidecar.

## Typography

Manrope Variable é a família existente, carregada pelo aplicativo. Títulos de página usam a hierarquia headline; títulos de seção usam title; descrições e campos usam body e label. Metadados e badges também usam texto de 12px/16px. Não há família de exibição separada.

O espaçamento entre letras varia por título na implementação; essa escolha local não é um token global.

## Layout

O shell mantém cabeçalho de 68px, conteúdo central com largura máxima de 1440px e margens internas de 16px, aumentando para 24px a partir de md. Em lg, a navegação lateral ocupa 272px, ou 72px recolhida; abaixo disso abre em painel.

As páginas de RH usam larguras e ritmos conforme o conteúdo: Dossiê e Documentos limitam a leitura, Solicitações usa lista com divisórias e Férias mantém tabelas e diálogos. Essas composições são locais, não modelos obrigatórios para outros módulos. Grupos de ações podem quebrar linha e campos empilhados podem formar duas colunas em sm.

## Elevation & Depth

Cards são superfícies brancas com borda, sem sombra no componente base. Botões principais têm sombra curta; diálogos recebem sombra ampla e sobreposição escurecida. Valores exatos de sombra estão no sidecar. Reutilizar os componentes preserva seus estados.

## Shapes

Cantos moderados diferenciam controles, navegação, badges e superfícies conforme a escala acima. Bordas finas e divisórias organizam listas e campos; não há necessidade de envolver cada bloco em um card.

## Components

- Botões: variantes primary, secondary, quiet e danger; altura mínima padrão de 40px, pequena de 36px e ícone de 40px. Foco visível, deslocamento de 1px ao pressionar e estado desabilitado pertencem ao componente compartilhado.
- Campos: Input e Textarea têm borda, foco com anel e borda de marca, erro por `aria-invalid` e tratamento desabilitado. DateInput usa o campo nativo de data com mínimo de 44px. FormField associa rótulo e apresenta orientação ou erro.
- Cards: CardHeader usa 20px na horizontal e 16px na vertical; CardContent usa 20px. Card não impõe espaçamento interno sozinho.
- Badges: variantes neutral, success, warning, danger e brand identificam estados. São rótulos, não botões.
- Navegação: estado ativo em fundo suave de marca, texto escuro e foco visível; módulos e administração permanecem separados no shell.
- Diálogos: reutilizar DialogContent para título, descrição, rolagem, fechamento acessível e limite de altura relativo à janela.
- RH: Documentos e Solicitações usam disclosure nativo para ações e detalhes secundários. Na correção cadastral, os dados do vínculo começam recolhidos; no Histórico, a origem dos campos fica em detalhes. É um padrão observado nessas telas, não uma obrigação global.
- Comparações de RH: valores anterior e seguinte aparecem juntos no Histórico; Solicitações identifica Atual e Proposto; reconciliação CSV identifica Local e Importado, com matrícula, campo e origem. Texto longo quebra linha; a composição de cada comparação permanece local.
- Confirmações de RH: checkboxes com consequências explícitas autorizam a substituição de cada campo manual pelo CSV e o desligamento com desativação da conta e encerramento das sessões. Reutilizar os controles existentes.
- Anexos contextuais: em Ocorrências, o campo nativo de PDF aparece conforme a política do tipo escolhido, com obrigatoriedade, limite e privacidade junto ao campo. O acompanhamento permite retomar o envio no mesmo rascunho; o acesso administrativo informa a restrição de conteúdo privado.
- Ações entre módulos: os links de análise em Disponibilidade abrem o registro no fluxo existente de Férias ou Ocorrências. O destino apresenta a decisão disponível ou o histórico conforme o estado e o acesso, sem criar um segundo formulário de decisão na consulta.

## Do's and Don'ts

- Do preservar os tokens e componentes compartilhados antes de criar novas variantes.
- Do manter linguagem PT-BR, rótulos semânticos, foco visível e estados compreensíveis.
- Do validar a composição móvel a 390px e respeitar a preferência de movimento reduzido.
- Do apresentar valores comparados com rótulos compreensíveis e a consequência junto da confirmação em fluxos sensíveis de RH.
- Do distinguir falha, aplicação parcial e gravação concluída com consulta desatualizada, oferecendo a recuperação adequada ao estado.
- Do manter o registro salvo acessível quando uma etapa posterior falha, orientando a retomada no mesmo rascunho.
- Do identificar o período e a unidade efetivamente consultados, mantendo os resultados associados aos filtros aplicados enquanto o formulário é editado; distinguir resultados confirmados de pedidos ainda sujeitos a decisão.
- Do orientar a correção de filtros inválidos e oferecer nova tentativa para falhas da consulta, como em Indicadores.
- Do identificar fontes indisponíveis em consultas agregadas, explicar que o total considera apenas as fontes disponíveis e preservar seus resultados com uma ação para tentar novamente, como em Pendências.
- Do preservar o foco no acionador ao carregar detalhes em linha, anunciar o carregamento e associar o controle à região expandida, como no acompanhamento de Capacitações.
- Do preservar os campos em edição e desabilitar ações concorrentes que substituam ou desmontem o formulário em linha, como atualização, paginação e edição de outro registro em Substituições.
- Do oferecer atualização explícita dos dados de referência após conflito de edição, preservando o rascunho para comparação com os dados atuais, limpando confirmações dependentes e orientando um novo salvar deliberado, como em Estrutura organizacional.
- Do explicar junto à ação quando um aviso permite prosseguir e quais providências podem ser concluídas depois, mantendo a confirmação exigida pelo fluxo.
- Do preservar na navegação o modo de leitura ou gestão escolhido; a permissão administrativa não deve ocultar ações do leitor, como confirmar ciência em Comunicados.
- Do preservar busca, filtros aplicados e página ao abrir detalhes e voltar à lista, como na biblioteca de Políticas e formulários.
- Do distinguir contagem indisponível de zero, inclusive no nome acessível do indicador, como no sino de Notificações.
- Don't transformar a composição de uma página de RH em regra global.
- Don't acrescentar decoração, metáforas visuais ou formulários complexos sem necessidade do fluxo.
