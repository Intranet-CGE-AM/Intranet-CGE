# Active Directory: operação e validação

A integração é opcional e começa desabilitada (`AD_ENABLED=false`). O login local
existente continua funcionando. Quando habilitada, a API valida a senha no AD por
LDAPS; permissões, cadastro de pessoas e dados de RH continuam na intranet.

## Preparação para homologação

1. Provisionar uma conta de leitura dedicada, com acesso apenas aos atributos
   necessários dentro da base permitida. Não usar a conta administrativa da
   investigação como credencial permanente. A conta deve ler `objectGUID`,
   `userPrincipalName`, `sAMAccountName`, `displayName`, `mail`,
   `userAccountControl`, `msDS-User-Account-Control-Computed`, `accountExpires`
   e `pwdLastSet`.
2. Definir base e, opcionalmente, grupo de elegibilidade. O filtro de grupo aceita
   associação transitiva. Sem grupo, a elegibilidade exige o estado válido no AD,
   a base configurada e um vínculo explícito criado na intranet.
3. Instalar a senha de leitura e a CA corporativa em arquivos fora do repositório.
   A senha deve ser legível somente pelo operador e pelo UID 1000 do processo da
   API (por exemplo, proprietário 1000 e modo 0400). A CA pública pode ter modo 0444. Um único terminador de linha é removido do arquivo de senha.
4. Usar `CGE-DC01.cge.lan:636` com a CA `cge-SRVCGEAM02-CA`, cuja cadeia foi
   validada. Confirmar DNS e TLS dentro da API. O overlay usa DNS `10.0.0.7`
   somente nesse serviço. Não usar IP na URL LDAPS nem desativar TLS.
5. Preservar uma conta local administrativa de emergência. Selecionar pessoas
   piloto e confirmar o vínculo com os responsáveis, pois o AD não fornece
   matrícula em `employeeID` no escopo observado.

Acrescentar ao arquivo de ambiente de homologação, sem armazenar a senha nele:

```dotenv
AD_BIND_DN=<UPN da conta técnica dedicada>
AD_BIND_PASSWORD_PATH=/caminho/seguro/ad-bind-password
AD_CA_CERT_PATH=/caminho/seguro/ad-ca.pem
AD_BASE_DN=OU=CGE,DC=cge,DC=lan
# Se definido pela TI:
# AD_ALLOWED_GROUP_DN=CN=Intranet,OU=Grupos,DC=cge,DC=lan
AD_RECHECK_SECONDS=300
```

Usar a imagem construída desta branch. A tag `homolog` existente não implica que
ela contenha esta implementação. Validar o Compose antes de iniciar:

```sh
docker compose --env-file .env.homolog \
  -f docker-compose.homolog.yml -f docker-compose.ad.yml config --quiet
```

Depois de backup e preparação do ambiente, o comando de implantação é:

```sh
docker compose --env-file .env.homolog \
  -f docker-compose.homolog.yml -f docker-compose.ad.yml up -d api web
```

Esse comando é uma instrução operacional; não foi executado nos servidores.
Homologação aplica a migração pelo entrypoint. Produção exige o procedimento de
migração explícita já existente no projeto. A migração 0009 mantém contas locais,
hashes, sessões e permissões, permite e-mail ausente em contas AD e impede hash
local em contas AD por uma restrição no banco.

## Vincular e entrar

Em **Administração → Pessoas e acessos**, um administrador com `accounts.manage`
pode selecionar **Novo acesso AD** para uma pessoa sem conta ou **Vincular AD**
para uma conta local existente. Consulte o usuário, confira nome/UPN e pessoa,
e confirme. Não há associação automática por nome ou e-mail. O GUID consultado
é confirmado novamente pelo servidor antes da gravação.

A conversão mantém o ID da conta, os papéis e os escopos, remove a senha local e
encerra as sessões anteriores. Novas contas AD começam sem permissões. A API
recusa a conversão da própria conta administrativa e vínculos duplicados. Não
existe conversão automática de volta para local.

O usuário vinculado entra com nome curto, UPN ou `SRV-CGEAD2\usuario` e sua senha
corporativa. Não é necessário ter e-mail no AD. Senha incorreta, conta bloqueada,
desativada, expirada ou exigindo troca de senha não autentica. A troca e a
recuperação de senha seguem o procedimento da TI; a API e a tela impedem reset
local de contas AD.

As sessões revalidam o estado do objeto por GUID a cada 300 segundos, ou prazo
menor configurado. A revalidação inclui o escopo/grupo. Objeto ausente ou inelegível
revoga as sessões. Se a consulta falhar depois do prazo, as requisições AD recebem
503 até a recuperação; contas locais continuam independentes. Desativação local
tem efeito na próxima requisição. A troca de senha, sozinha, não revoga sessões
já abertas se o objeto continuar elegível.

Renomear o usuário mantém o vínculo por GUID. Uma conta excluída e recriada recebe
outro GUID e não herda o vínculo. A resolução de conflitos ou de um vínculo errado
exige procedimento administrativo específico; não há botão para trocar a
identidade de uma conta já vinculada neste piloto.

## Limites e diagnóstico

- Apenas um DC está configurado. Não há failover automático, nem repetição de
  senha incorreta em outros controladores. A cadeia do DC02 precisa ser corrigida
  e testada antes de incluir redundância.
- O cliente exige CA e hostname válidos, TLS 1.2 ou superior, timeout de 5 segundos
  por operação e no máximo 10 operações simultâneas.
- Login aplica limites por IP, por identificador e por IP/conta canônica, reunindo
  aliases no último limite. Os contadores são locais ao processo; múltiplas
  réplicas exigem armazenamento compartilhado. A API deve ficar acessível somente
  pelo proxy confiável, que normaliza `X-Forwarded-For`.
- O endpoint de prontidão mantém os testes de banco/storage e não depende do AD,
  para preservar o acesso local em uma indisponibilidade do diretório. Diagnosticar
  uma falha AD verificando DNS, certificado, validade da conta técnica e escopo.
- O navegador nunca recebe senha de leitura, DN técnico ou certificado privado.
  Senhas corporativas não são persistidas. Eventos de vínculo e login registram
  a identidade e o resultado, sem senhas ou tokens.
- A VPN é necessária para desenvolvimento remoto; não deve ser necessária para a
  comunicação entre a API hospedada e o AD dentro da rede institucional.

Para suspender AD, remover o overlay e manter esta versão da aplicação. Isso não
restaura senhas locais nem concede acesso às contas convertidas. Não reimplantar
uma versão antiga que suponha e-mail/hash sempre presentes. O retorno para uma
versão anterior precisa de ensaio e plano de dados próprio.

## Verificação reproduzível

Usar Node >=22.22 e instalar com `pnpm install --frozen-lockfile`.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
./infra/scripts/check-migrations.sh
```

A suíte de integração AD usa PostgreSQL real e diretório simulado, e exige banco
local separado cujo nome começa por `intranet_cge_ad_test`. Ela adiciona somente
pessoas e contas de teste nesse banco:

```sh
docker compose up -d --wait postgres
docker compose exec -T postgres createdb -U cge intranet_cge_ad_test
DATABASE_URL=postgresql://cge:cge@127.0.0.1:5432/intranet_cge_ad_test \
  pnpm --filter @cge/api db:migrate
CGE_AUTH_TEST_DATABASE_URL=postgresql://cge:cge@127.0.0.1:5432/intranet_cge_ad_test \
  pnpm --filter @cge/api exec vitest run src/modules/auth/directory.integration.test.ts
pnpm test:ad
pnpm test:e2e tests/e2e/intranet.spec.ts
```

`pnpm test:ad` também prepara e remove um banco isolado para a suíte de integração.
O CI executa esse comando depois da suíte E2E existente.

O teste de navegador AD inicia uma API com diretório simulado e banco temporário
próprio, que remove ao encerrar. Esse servidor de teste está fora de `src`, não é
importado nem incluído no build da aplicação, e exige `NODE_ENV=test`.

Na verificação de 14/10/2026, o download da imagem MinIO fixada na branch ficou
parado. A jornada HR foi executada usando um contêiner MinIO de teste isolado com
imagem em cache `minio/minio:RELEASE.2025-09-07T16-13-09Z`; a imagem do repositório
não foi alterada. Isso limita a prova da configuração exata de storage em Docker.

A prova live do AD usou CA/hostname validados, o adaptador real e banco local
isolado. Não foram testados estados destrutivos em contas reais. O aceite de
homologação ainda exige conta técnica dedicada, piloto real e estados de teste
preparados pela TI. Detalhes do levantamento: [plano de integração](ad-integration-plan.md).

## Resultado da validação local (14/10/2026)

| Verificação                  | Resultado                                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base atualizada              | `origin/dev`, `19fa220`; branch de trabalho `codex/ad-integration`                                                                                                                  |
| Tipos, lint e build          | Passaram com Node 24.21.0                                                                                                                                                           |
| Testes unitários             | 200 passaram                                                                                                                                                                        |
| Integração AD com PostgreSQL | 9 passaram                                                                                                                                                                          |
| Navegador                    | Fluxo AD e 3 verificações existentes de HR/login passaram                                                                                                                           |
| Upgrade 0008 → 0009          | Conta local, hash, sessão e permissão preservados; restrição de credenciais locais validada                                                                                         |
| Guarda de migrações          | 10 migrações e 6 casos de segurança passaram                                                                                                                                        |
| Compose com overlay AD       | Configuração de homologação validada com valores de teste, sem implantação                                                                                                          |
| AD real                      | Busca por nome/GUID, bind, login HTTP, sessão e logout passaram com TLS validado                                                                                                    |
| Formatação                   | Arquivos do projeto passaram; o comando global ainda aponta o rascunho preexistente `.scratch/hr-expansao-cge/pesquisas/lacunas-finais-plataforma-rh.md`, preservado sem alterações |

O build também reporta o aviso já existente de chunks grandes no frontend. A
validação de navegador cobriu o fluxo central HR e a integração AD; não foi uma
execução de todas as jornadas funcionais existentes. A imagem MinIO fixada no
Compose e o aceite no servidor permanecem fora desta prova, conforme limites acima.

## Validação com contas de teste no AD real

Em 14/10/2026, o acesso administrativo fornecido permitiu criar uma conta de usuário
para teste e uma conta separada para consultas. Ambas foram verificadas com
`primaryGroupID=513` (Domain Users) e `memberOf` vazio. Nenhum grupo administrativo
ou permissão adicional foi atribuído. O runtime de validação usou a conta de leitura
nova, sem usar a conta administrativa fornecida para fazer consultas LDAP.

A interface local vinculou explicitamente a pessoa piloto ao usuário real do AD,
fez login com a senha gerada e exibiu as orientações de senha corporativa. O usuário
sem e-mail recebeu `email: null`, provedor `ad` e nenhuma permissão adicional.

Passaram 15 verificações ao vivo: vínculo/login pelo navegador; senha incorreta;
revogação de sessão e recusa de login após desativação; login após reativação;
revogação e recusa após expiração da conta; login após limpar expiração;
revogação e recusa quando a troca de senha é obrigatória; login após reset da senha
do teste; login e sessão após renomear o usuário, mantendo o GUID; logout e recusa
da sessão encerrada. [Resultados estruturados](validation/ad-live-2026-10-14.json).

A revalidação foi configurada em 1 segundo somente no processo local de teste.
O padrão da aplicação permanece em 300 segundos. O bloqueio por tentativas não foi
provocado: `LockoutThreshold=0` no domínio e nenhuma política foi alterada.

Ao concluir, ambas as contas foram desabilitadas e tiveram expiração definida
para 15/10/2026. A conta de usuário passou a se chamar `it-ad-u-aec453r` durante o
teste de renomeação; a conta de consultas é `it-ad-r-aec453`. As senhas geradas e
os cookies foram removidos do computador, e o banco de teste foi excluído.
As contas permanecem desabilitadas no AD para rastreabilidade. Não houve implantação
no servidor da intranet. Para uso permanente, provisionar ou preparar uma conta
dedicada com segredo gerenciado, proprietário e ciclo de vida definidos.
