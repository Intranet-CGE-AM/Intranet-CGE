# Prontidão para UAT e piloto

Data-base: 28 de julho de 2026

Este documento separa o que já foi provado tecnicamente do que ainda depende de
decisão ou aceite da CGE. Campo sem assinatura não é aprovação.

## Estado atual

- build, migrações, saúde e prontidão aprovados em Compose isolado;
- backup e restauração destrutiva aprovados para PostgreSQL e objetos;
- login do administrador aprovado depois da restauração;
- 16 testes da API, 3 testes de contratos e 19 cenários Playwright aprovados;
- auditoria das dependências de produção sem vulnerabilidade conhecida;
- seed de homologação reproduz 10 contas, 10 pessoas, 5 papéis e 7 estados de
  férias;
- UAT com usuários da CGE, TLS/DNS internos e aceite da solução de object storage
  ainda estão pendentes.

## Decisões que a CGE precisa fechar

| Decisão                                               | Responsável sugerido | Evidência esperada                     | Estado   |
| ----------------------------------------------------- | -------------------- | -------------------------------------- | -------- |
| prazo e substituição para decisão da chefia           | RH                   | regra aprovada                         | Pendente |
| momento limite para cancelamento de férias            | RH                   | regra aprovada                         | Pendente |
| autoridade e prazo da decisão final                   | RH                   | regra aprovada                         | Pendente |
| retenção de auditoria, importações, backups e fotos   | RH + Segurança       | tabela de retenção                     | Pendente |
| responsabilidade pelo opt-out de aniversário          | RH + Encarregado     | orientação de privacidade              | Pendente |
| termos oficiais para categoria, lotação e chefia      | RH                   | glossário validado                     | Pendente |
| MinIO atual ou outro servidor compatível com S3       | TI + Segurança       | aceite de risco ou produto substituto  | Pendente |
| dono operacional, janela e canal de suporte do piloto | TI                   | nomes, horários e contatos registrados | Pendente |

## Roteiro de UAT

Use uma cópia anonimizada do CSV real e registre resultado, evidência e
responsável para cada linha.

| Persona       | Jornada                                                               | Aceite |
| ------------- | --------------------------------------------------------------------- | ------ |
| Administrador | criar colaborador com conta, perfil global e perfil por unidade       | ☐      |
| RH            | validar/aplicar CSV, corrigir vínculo, foto e chefia, decidir férias  | ☐      |
| Chefia        | ver somente sua unidade e aprovar/rejeitar solicitação                | ☐      |
| Colaborador   | primeiro acesso, diretório, aniversário, rascunho/envio/cancelamento  | ☐      |
| Segurança     | negar rota e ação fora do escopo; conferir auditoria e exportação     | ☐      |
| Operação      | atualizar, gerar backup, restaurar, entrar e consultar objeto privado | ☐      |

Critério de saída: nenhuma falha crítica ou alta, todas as jornadas acima
assinadas e falhas médias com responsável e prazo.

## Segurança e operação

- [ ] DNS e certificado internos definidos; HTTP redireciona para HTTPS.
- [ ] segredos aleatórios estão fora do Git e com acesso mínimo.
- [ ] credencial de bootstrap foi removida depois do primeiro acesso.
- [ ] conta do object storage tem acesso somente ao bucket da intranet.
- [ ] solução S3-compatible e sua política de atualização foram aprovadas.
- [ ] backup sai do host, possui retenção definida e restauração agendada.
- [ ] alertas cobrem indisponibilidade de web, API, PostgreSQL e object storage.
- [ ] host possui horário sincronizado, capacidade e responsável de plantão.
- [ ] incidente, reversão e comunicação possuem dono e contato.
- [ ] base legal, transparência e retenção dos dados pessoais foram validadas.

## Piloto

Começar com uma unidade evita ampliar suporte antes de validar vocabulário e
regras reais.

Entrada:

- decisões e checklist acima aprovados;
- usuários reais da unidade importados e conferidos pelo RH;
- responsáveis de suporte e retorno definidos;
- backup inicial gerado e verificado.

Saída:

- 100% das jornadas críticas concluídas;
- nenhuma falha crítica ou alta;
- permissões conferidas por amostragem de colaborador, chefia, RH e admin;
- feedback classificado em correção, treinamento ou nova necessidade;
- decisão formal de ampliar, repetir ou interromper o piloto.

## Próximo módulo

O protótipo legado sugere mural, documentos, eventos, catálogo de sistemas e
chamados de TI. A sequência mínima recomendada é:

1. **Catálogo de sistemas e links úteis** dentro da intranet geral: alto valor,
   baixa regra de negócio e não precisa virar módulo isolado.
2. **Comunicados e mural** como próximo módulo: publicação, período de exibição,
   audiência por unidade e auditoria reutilizam a plataforma atual.
3. **Eventos** depois de comunicados, reaproveitando autoria e audiência.
4. **Documentos** somente após definir autoria, versão, retenção e busca.
5. **Chamados de TI** somente após decidir se haverá integração com uma
   ferramenta de atendimento existente.

Antes de iniciar o item 2, confirmar dono do conteúdo, aprovação editorial,
segmentação, prazo de expiração e métricas de leitura.
