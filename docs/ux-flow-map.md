# Mapa de fluxos e clareza operacional

Data: 28 de julho de 2026

Escopo: autenticação, hub, Recursos Humanos, férias e administração da
plataforma.

## Princípio

A interface deve nomear a decisão que a pessoa precisa tomar, mostrar a
consequência antes da ação e esconder termos de implementação. Quando um fluxo
termina, a tela seguinte deve explicar claramente o que aconteceu e qual é o
próximo passo.

## Mapa priorizado

| Prioridade | Fluxo                 | Atrito encontrado                                                         | Comportamento esperado                                                                        |
| ---------- | --------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Alta       | Primeiro acesso       | “Salvar e continuar” retorna ao login sem confirmação                     | “Alterar senha” retorna ao login com confirmação e instrução para entrar com a nova senha     |
| Alta       | Visão geral de RH     | A fila mostra pendência de férias, mas o CTA abre o diretório             | O CTA abre a fila que contém a pendência; diretório permanece como ação secundária            |
| Alta       | Diretório             | Três ícones sem texto exigem tentativa e erro                             | Ações usam rótulos visíveis: “Editar”, “Definir chefia” e “Desativar”                         |
| Alta       | Solicitação de férias | Rascunhos aparecem, mas não podem ser enviados                            | A pessoa pode salvar rascunho, enviar rascunho e cancelar enquanto permitido                  |
| Alta       | Decisão de férias     | “Aprovar” vem pré-selecionado                                             | Nenhuma decisão vem selecionada; confirmação exige escolha explícita                          |
| Alta       | Histórico de férias   | “Solicitação aprovada” não distingue chefia e decisão final               | Cada evento informa a etapa e o responsável pela decisão                                      |
| Alta       | Administração         | Contas, perfis, atribuições e auditoria aparecem numa página longa        | Navegação local separa “Contas”, “Perfis e acessos” e “Auditoria”, preservando a seção na URL |
| Média      | Configuração de RH    | “Configurar RH”, “Categorias” e “Unidades” pressupõem vocabulário interno | “Categorias e unidades” explica categoria funcional, lotação e efeito na elegibilidade        |
| Média      | Importação CSV        | O fluxo pede um arquivo sem oferecer formato ou modelo                    | A tela oferece modelo para download e explica validar antes de aplicar                        |
| Média      | Perfis de acesso      | “Papel”, “atribuição” e “escopo” são técnicos                             | A interface usa “Perfil de acesso”, “Conceder acesso” e “Onde o acesso vale”                  |
| Média      | Auditoria             | Tipos de objeto aparecem em inglês técnico                                | Tipos são traduzidos para conceitos do produto                                                |
| Média      | Hub                   | A entrada do módulo é clara, mas não organiza módulos e ferramentas       | A página inicial separa módulos, atalhos reais, ferramentas do sistema e contexto da conta    |

## Contratos por jornada

### 1. Entrar e concluir o primeiro acesso

1. A pessoa entra com e-mail institucional e senha temporária.
2. A aplicação explica que a senha temporária precisa ser substituída.
3. A pessoa informa senha temporária, nova senha e confirmação.
4. Após sucesso, volta ao login com a mensagem “Senha alterada”.
5. A mensagem orienta entrar novamente usando a nova senha.

Critérios:

- erro permanece no formulário que originou a ação;
- botão descreve a ação real;
- senha não é preservada ao voltar ao login;
- teclado e leitor de tela recebem a confirmação.

### 2. Entrar em um módulo

1. O hub mostra somente módulos e ferramentas permitidos.
2. O módulo de Recursos Humanos abre sua visão geral.
3. A navegação expande somente as rotas do módulo ativo.
4. A visão geral mostra pendências e direciona para a fila correspondente.

Critérios:

- o módulo principal e seus atalhos autorizados ficam visíveis sem navegação
  intermediária;
- uma pendência de férias nunca direciona ao diretório;
- módulos sem permissão não aparecem;
- ferramentas administrativas aparecem separadas dos módulos de negócio;
- rotas antigas continuam redirecionando.

### 3. Encontrar e administrar colaboradores

1. A busca aceita nome, unidade e categoria funcional.
2. Cada linha mostra nome, lotação, categoria e matrícula.
3. Ações administrativas possuem texto visível.
4. “Editar” altera dados pessoais e vínculo ativo.
5. “Definir chefia” explica o impacto no fluxo de férias.
6. “Desativar” confirma que vínculo, acesso e sessões serão encerrados.
7. “Foto” permite enviar ou remover uma imagem com formato e limite claros.

Critérios:

- nenhuma ação depende de reconhecer um ícone;
- campos de categoria e unidade explicam o significado;
- ações destrutivas informam a consequência.
- foto inválida, grande demais ou fora do escopo retorna orientação no diálogo.

### 4. Configurar categorias e unidades

1. A área de configuração separa categorias funcionais e unidades de lotação.
2. Categoria explica que pode habilitar o fluxo de férias.
3. Unidade explica sigla e nome usados no diretório.
4. Itens existentes aparecem em listas legíveis, não em texto separado por
   vírgulas.

Critérios:

- campos com o mesmo nome permanecem distinguíveis;
- botões usam “Cadastrar categoria” e “Cadastrar unidade”;
- estado vazio orienta a primeira configuração.

### 5. Importar colaboradores

1. A pessoa pode baixar um CSV modelo.
2. Seleciona o arquivo e executa “Validar arquivo”.
3. A prévia mostra total válido, total com erro e ação por linha.
4. “Aplicar importação” só fica disponível após validação sem bloqueios.
5. O resultado informa o que foi criado, atualizado, desativado ou rejeitado.

Critérios:

- validar nunca altera dados;
- aplicar exige confirmação explícita da prévia;
- erros identificam linha, campo e correção esperada.

### 6. Solicitar férias

1. A pessoa informa o período.
2. Pode salvar como rascunho ou enviar diretamente para a chefia.
3. Um rascunho oferece “Enviar para chefia”.
4. Solicitações enviadas mostram a etapa atual em linguagem direta.
5. Cancelamento permanece disponível apenas enquanto a regra permitir.

Critérios:

- a data final não pode anteceder a inicial;
- envio sem chefia explica onde corrigir;
- saldo oficial e cálculo de direito continuam explicitamente fora da
  intranet.

### 7. Decidir férias

1. Chefia ou RH abre “Analisar solicitação”.
2. Nenhuma decisão vem pré-selecionada.
3. A pessoa escolhe aprovar ou rejeitar.
4. Comentário é obrigatório para rejeição e opcional para aprovação.
5. O histórico distingue aprovação da chefia e aprovação final.

Critérios:

- não existe aprovação acidental por valor padrão;
- ações concorrentes desatualizadas retornam orientação para recarregar;
- decisão registrada desaparece da fila correta.

### 8. Criar colaborador e acesso

1. “Novo acesso” oferece “Novo colaborador” ou “Pessoa já cadastrada”.
2. Novo colaborador combina dados funcionais e conta de acesso.
3. Pessoa existente cria somente a conta.
4. A conta exige troca de senha no primeiro acesso.
5. Falha parcial preserva o colaborador e orienta tentar novamente pelo modo de
   pessoa existente.

Critérios:

- e-mail duplicado é impedido antes da criação;
- ausência de categoria ou unidade direciona à configuração de RH;
- pessoa já vinculada a uma conta não aparece como opção.

### 9. Administrar perfis e acessos

1. A seção “Perfis e acessos” mostra perfis reutilizáveis.
2. Permissões permanecem agrupadas por módulo.
3. “Conceder acesso” escolhe pessoa, perfil e onde o acesso vale.
4. A remoção confirma pessoa, perfil e alcance removido.

Critérios:

- “Global” é explicado como todos os módulos e unidades permitidos pelo perfil;
- unidade limita somente permissões que aceitam lotação;
- alteração de perfil entra em vigor nas próximas requisições.

### 10. Consultar auditoria

1. A seção “Auditoria” mostra eventos recentes.
2. Evento, objeto, resultado e data usam nomes do produto em PT-BR.
3. Exportação deixa claro que baixa CSV respeitando a permissão específica.

Critérios:

- tipos internos não aparecem em inglês;
- datas usam o fuso de Manaus;
- estado vazio explica quando eventos serão registrados.

## Portão de validação

- fluxos críticos cobertos por Playwright com dados de homologação;
- login, mudança de senha, diretório, férias e administração validados em
  390 px, 768 px e 1440 px;
- Axe sem violações WCAG 2.2 AA nas páginas e diálogos críticos;
- ações destrutivas confirmadas;
- nenhum controle depende apenas de ícone, cor ou conhecimento técnico;
- formatação, lint, tipos, testes e build aprovados antes de cada push.

## Resultado da implementação

Todos os fluxos priorizados neste mapa foram implementados em `main`.

- 17 de 17 cenários Playwright aprovados;
- 15 de 15 testes da API aprovados;
- rotas críticas aprovadas pelo Axe em 390 px, 768 px e 1440 px;
- formatação, lint, tipos e builds de produção aprovados.
