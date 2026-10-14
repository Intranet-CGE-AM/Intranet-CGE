# Integração da intranet com o Active Directory

## Conclusão em 14 de outubro de 2026

**A VPN conectou e a autenticação no AD funcionou com LDAPS e validação de CA e
nome do servidor.** O caminho recomendado para o primeiro piloto é validar a
identidade no AD e manter sessões, permissões, pessoas e vínculos funcionais na
intranet. O levantamento não implantou a integração nem alterou configuração de
servidores, contas, DNS ou certificados confiáveis do sistema.

Antes da implantação, é preciso resolver DNS e confiança TLS dos contêineres,
definir a conta técnica de leitura e os usuários permitidos, e revisar o vínculo
entre identidades AD e pessoas já cadastradas. Não depender de e-mail como
identificador de login: a maioria das contas habilitadas no escopo consultado não
possui esse campo no AD.

## Ambiente observado

| Item                   | Resultado confirmado                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VPN                    | Perfil `CGE Protic`, usuário `protic`, servidor `177.66.12.250:1194/UDP`; conectou após correção da senha                                                    |
| Intranet               | SSH autenticado em `10.0.0.9`, hostname `INTRANET-CGEAM`, Ubuntu 26.04 LTS; relógio sincronizado                                                             |
| Windows                | Sessão administrativa autenticada por WinRM com NTLM e criptografia de mensagens em `10.0.0.7`; RDP também alcançável, mas não utilizado                     |
| Domínio DNS            | `cge.lan`                                                                                                                                                    |
| Nome NetBIOS           | `SRV-CGEAD2`                                                                                                                                                 |
| Base do domínio        | `DC=cge,DC=lan`                                                                                                                                              |
| Base inicial de busca  | `OU=CGE,DC=cge,DC=lan`, ainda sujeita ao recorte de usuários permitido pela TI                                                                               |
| DC principal testado   | `CGE-DC01.cge.lan`, `10.0.0.7`, Windows Server 2022 Standard                                                                                                 |
| Outros DCs cadastrados | `CGE-DC02.cge.lan`, `10.0.0.8`, Windows Server 2022; `SRVCGEAM01.cge.lan`, `10.0.0.5`, Windows Server 2012 R2                                                |
| Diretório              | RootDSE, consulta autenticada e bind do usuário por LDAPS concluídos                                                                                         |
| Implantação            | Contêineres de API/web de produção e homologação saudáveis; código compilado de produção ainda usa `LocalAuthenticationService` e verificação local de senha |
| Referência local       | Código revisado no commit `32eb64d`; as imagens implantadas não expõem label de revisão e têm digests distintos entre produção e homologação                 |

As credenciais, hashes de senha e material privado do perfil VPN não fazem parte
deste documento. Certificados públicos de CA foram lidos pela sessão Windows
autenticada e usados apenas nos testes, sem instalar confiança global.

## Rede e certificados

O host da intranet usa `10.0.0.6` como DNS e contém `search 10.0.0.7` em
`/etc/resolv.conf`. Esse resolver retorna NXDOMAIN para `cge.lan`. O nome completo
do host é apresentado como `INTRANET-CGEAM.10.0.0.7`, consistente com o sufixo
inadequado. Não foi alterado durante o levantamento.

Consultas a `10.0.0.7` resolvem o domínio e seus registros SRV. Nas duas APIs,
`dns.lookup("CGE-DC01.cge.lan")` falha com `ENOTFOUND`; uma consulta explícita ao
DNS do AD resolve `10.0.0.7`. A correção deve ser persistente no provisionamento
host/contêiner ou no encaminhamento da zona `cge.lan`. O arquivo do host é marcado
como gerenciado pelo PVE; evitar correção manual que seja perdida ao reiniciar.

| Destino LDAPS            | Resultado a partir das APIs                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CGE-DC01.cge.lan:636`   | Alcançável em produção e homologação. Falha com a confiança padrão; valida CA e hostname quando a CA apropriada é fornecida somente ao processo de teste                                      |
| `CGE-DC02.cge.lan:636`   | Alcançável em ambas. Falha de cadeia com a confiança padrão e com a CA do DC01; uma nova prova em produção com as duas CAs disponíveis no DC01 também falhou. Não está aprovado como failover |
| `SRVCGEAM01.cge.lan:636` | Handshake com CA e hostname validados em ambas; servidor legado e certificado com vencimento próximo. Não proposto como endpoint inicial                                                      |

O certificado do DC01 vence em 16/09/2027 e é emitido por
`cge-SRVCGEAM02-CA`. O DC02 apresenta certificado emitido por
`cge-SRVCGEAM01-CA`, com vencimento em 22/09/2027. O controlador legado apresenta
certificado com vencimento em 05/12/2026. Alguns testes receberam reset depois do
handshake e encerramento; isso não invalida a validação TLS registrada, mas não
constitui prova de bind ou consulta nesses outros DCs.

CAs públicas obtidas do armazenamento confiável do DC01, com SHA-256:

- `cge-SRVCGEAM02-CA`: `0F:B3:AA:63:7D:86:FE:38:3D:12:25:F4:C5:82:42:DF:1A:8F:4A:BE:17:DC:4F:F9:C9:DC:B9:EC:93:29:6C:8F`.
- `cge-SRVCGEAM01-CA`: `0D:C2:67:22:CB:75:66:6B:C0:66:12:55:B1:48:D6:27:3C:15:93:FA:7C:25:18:E6:56:91:00:24:78:4A:F3:8C`.

A TI deve fornecer o conjunto correto de confiança e investigar a cadeia do DC02.
Não aceitar uma CA somente pelo nome e não desabilitar validação para habilitar
failover. A VPN alcançou diretamente LDAPS do DC01; as conexões diretas aos outros
DCs expiraram, embora as APIs os alcancem. A VPN de desenvolvimento não deve ser
uma dependência operacional do backend instalado dentro da rede.

## Organização e qualidade dos dados do AD

A consulta paginada de usuários foi limitada a `OU=CGE,DC=cge,DC=lan` e produziu
somente agregados para o planejamento, sem salvar uma exportação de usuários.

| Medida                                                   | Resultado |
| -------------------------------------------------------- | --------: |
| Objetos de usuário no escopo                             |       184 |
| Contas habilitadas                                       |       128 |
| Habilitadas com UPN                                      |       128 |
| Habilitadas com e-mail                                   |        40 |
| Habilitadas com employeeID                               |         0 |
| Habilitadas com department                               |         0 |
| Valores de UPN ou e-mail duplicados entre as habilitadas |         0 |

Essas 128 contas não equivalem automaticamente a 128 servidores elegíveis para a
intranet: as OUs incluem áreas administrativas, TI, RH e estruturas de alunos,
professores e certificados. Uma busca de grupos com nome contendo `intranet` ou
`protic` não encontrou resultado; isso não exclui grupo existente com outro nome.

A conta fornecida autenticou com UPN `olavo@cge.lan`, pertence a
`OU=TI,OU=CGE,DC=cge,DC=lan`, não possui e-mail e integra `Builtin/Administrators`.
Ela serve à descoberta autorizada, mas não deve ser a credencial permanente da
aplicação. O teste LDAP validou um único resultado para essa identidade.

A política padrão consultada tem senha máxima de 42 dias, mínimo de 7 caracteres
e `LockoutThreshold=0`. A conta de descoberta possui `PasswordNeverExpires=true`
e não retornou política granular resultante. Isso não estabelece a política
individual de todos os usuários. No DC01, `LDAPServerIntegrity=1` e o valor
`LdapEnforceChannelBinding` não estava definido explicitamente no registro.
Nenhuma política foi modificada; a compatibilidade com bind simples sobre TLS
foi comprovada pelo teste autenticado.

Não foi encontrado serviço AD FS no DC01. Isso não exclui AD FS em outro host,
Entra ID ou outro provedor institucional; a existência de SSO/MFA corporativo
permanece uma pergunta para a TI.

## Autenticação anterior à integração

O backend Fastify instancia `LocalAuthenticationService` em
`apps/api/src/server.ts`. O login em `apps/api/src/modules/auth/service.ts`
normaliza o e-mail, exige conta ativa e verifica a senha com Argon2id. O contrato
em `packages/contracts/src/auth.ts` aceita apenas e-mail e senha.

`user_accounts` exige `person_id`, e-mail único e `password_hash` não nulo.
Existe no máximo uma conta por pessoa. As sessões armazenam o hash do token e
expiram, por padrão, em 12 horas. O cookie `cge_session` é assinado, HttpOnly,
SameSite=Strict e Secure em produção. Cada chamada autenticada consulta o estado
local da conta e resolve as permissões atuais.

As permissões incluem papéis, escopos por unidade e regras locais. O AD não deve
atribuir automaticamente administração da intranet a grupos de administradores
Windows. Pessoas, matrículas, unidades, chefias e dados de RH continuam sob o
modelo atual até que cada campo tenha uma fonte de autoridade definida.

## Pendências para fechar o piloto

1. TI: definir a base/grupo de elegibilidade e uma conta de leitura com privilégio
   mínimo; não reutilizar a conta administrativa de descoberta.
2. Infraestrutura: corrigir DNS de forma persistente e disponibilizar a CA ao
   cliente LDAP da API. Investigar a cadeia do DC02 antes de ativar redundância.
3. TI e responsável pela intranet: selecionar pessoas piloto e revisar o vínculo
   com o AD. UPNs estão disponíveis, mas não há matrícula no `employeeID` para
   associação automática.
4. TI: confirmar se há provedor corporativo OIDC/SAML e exigência de SSO/MFA.
   Se não houver, seguir com LDAPS direto, já comprovado tecnicamente.
5. TI e produto: aprovar prazo de revogação de sessões e procedimento corporativo
   para senha expirada, bloqueio e troca obrigatória.

## Escolha do mecanismo

| Ambiente confirmado                             | Caminho proposto                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Provedor OIDC corporativo disponível e aprovado | Authorization Code com PKCE no backend; validar issuer, audience, assinatura, state e nonce; vincular por issuer e subject   |
| AD DS com LDAP protegido e política compatível  | Consulta limitada por conta técnica de leitura e validação da senha por bind do usuário em conexão separada com TLS validado |
| Somente LDAP sem proteção ou TLS inválido       | Corrigir conectividade e certificados antes do piloto; não enviar senhas nessa condição                                      |

Não introduzir Keycloak ou outro servidor de identidade apenas por existir AD.
A integração direta é a alternativa de menor escopo para o ambiente observado,
salvo existência de provedor corporativo adequado. Ela usa a senha de rede, mas não oferece login automático
do Windows nem MFA por si só. Esses requisitos, se necessários, mudam a decisão.

Para LDAP direto, a API deve usar o FQDN do DC, confiar na CA corporativa e rejeitar
certificados inválidos. Não desabilitar validação TLS. A compatibilidade da
biblioteca escolhida precisa ser demonstrada com a política real do servidor.
Simple bind sobre TLS e SASL sobre TLS têm requisitos diferentes de channel
binding; não reduzir a política do domínio para acomodar um cliente.
Referências: [certificados LDAPS](https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/enable-ldap-over-ssl-3rd-certification-authority)
e [channel binding](https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/ldap-channel-binding).

## Mudanças propostas na aplicação

### Contas e vínculo de identidade

Adicionar uma origem de autenticação explícita por conta, inicialmente `local`
ou `ad`, e uma identidade externa única por diretório e `objectGUID`. O GUID
permanece estável quando o objeto é renomeado ou movido; e-mail e DN não devem ser
a chave permanente. Referência: [Microsoft objectGUID](https://learn.microsoft.com/en-us/windows/win32/adschema/a-objectguid).

A migração deve preservar IDs, pessoas, permissões e histórico. Para contas AD,
permitir hash de senha nulo e impor restrições que exijam identidade externa;
contas locais continuam exigindo hash e e-mail. Separar o identificador AD do
e-mail de contato: permitir e-mail nulo somente para contas AD, adaptar os
contratos e apresentar o UPN nas telas quando não houver e-mail. Preservar a
unicidade de e-mails preenchidos e não fabricar endereços a partir do UPN.
A conversão de cada conta deve ser
transacional, auditada, revogar sessões antigas e eliminar seu hash local.
Uma conta AD não pode autenticar pela antiga senha local se o AD falhar.

No piloto, vincular explicitamente usuários do AD a pessoas já cadastradas.
Correspondências por e-mail podem gerar sugestões para revisão, mas não podem
unir contas automaticamente. Não propor correspondência por `employeeID` no
estado atual, pois o campo está vazio nas contas habilitadas consultadas. Ausência de e-mail, colisões e conta
AD recriada com novo GUID exigem resolução explícita. Não criar registros de RH
a partir de um login. Manter uma conta local de emergência separada e controlada.

### Login e sessões

Para LDAP direto, aceitar UPN e nome curto do domínio configurado. O UPN foi
confirmado para todas as contas habilitadas no escopo; o nome curto deve ser
resolvido de forma inequívoca dentro de `cge.lan`. Localizar somente contas vinculadas
ao piloto e buscar o objeto dentro da base autorizada com filtros escapados.
Rejeitar resultado ausente ou ambíguo. Verificar estado e grupo permitido,
autenticar em conexão TLS separada e criar a sessão atual somente após sucesso.
Nunca reutilizar uma conexão compartilhada com bind de usuários concorrentes.
Se a TI usar grupos aninhados, verificar associação transitiva e testá-la
explicitamente; a lista direta de `memberOf` não basta. A conta local deve estar
ativa e vinculada mesmo quando a identidade do AD é válida. Papéis continuam
atribuídos na intranet, sem promoção a administrador por grupos Windows.

Aplicar limites por IP e conta canônica para evitar contornar o limite alternando
UPN, e-mail e nome curto. Usar timeouts, limite de concorrência e mensagens que
não revelem existência de conta. Não repetir automaticamente senha incorreta em
outros DCs. Registrar falhas operacionais separadamente, sem senhas ou tokens.

Proposta inicial de revogação: revalidar estado do AD e grupo permitido a cada
5 minutos para contas com sessão ativa, com cache por conta. Ao desativar ou
remover autorização, revogar sessões. Depois de vencida a verificação, falha do
diretório bloqueia novas requisições dessa conta até uma verificação válida.
Esse prazo é uma proposta a combinar com a TI; o TTL atual de 12 horas sozinho
não atende revogação rápida. Não armazenar senha para revalidar sessões.

Senhas expiradas ou com troca obrigatória devem direcionar ao procedimento
corporativo. Bloquear troca e redefinição local nas APIs e telas de contas AD.
A desativação local continua sendo uma negação adicional de acesso à intranet.

### Arquivos e contratos afetados

| Área           | Arquivos e responsabilidade                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Persistência   | `apps/api/src/modules/auth/schema.ts` e migração Drizzle para origem e identidade externa                                        |
| Autenticação   | `apps/api/src/modules/auth/service.ts`, adaptador AD limitado a verificar identidade e estado, `apps/api/src/server.ts`          |
| API            | `apps/api/src/modules/auth/routes.ts` e `apps/api/src/modules/admin/routes.ts` para login, erros e bloqueio de reset local       |
| Contratos      | `packages/contracts/src/auth.ts` e `packages/contracts/src/admin.ts` para identificador, origem e capacidade de gerir senha      |
| Interface      | `apps/web/src/auth.tsx`, `pages/login.tsx`, `pages/change-password.tsx`, `pages/admin.tsx`                                       |
| Infraestrutura | `apps/api/src/config.ts`, exemplos de ambiente e Compose de homologação e produção para endpoints, base, CA e segredo de leitura |
| Operação       | Documentação de administração, implantação e autorização; diagnóstico de dependência AD separado da disponibilidade do processo  |
| Validação      | Testes de auth/admin/access, fixtures, seeds e bootstrap preservando contas locais; E2E de login e gestão de contas              |

No caminho OIDC, substituir o adaptador LDAP pelas rotas de início e callback e
usar issuer/subject para identidade. Revisar o cookie SameSite=Strict existente
e o armazenamento da transação de login para permitir a volta do provedor com
state e nonce validados, sem enfraquecer a proteção das demais rotas.

## Piloto e critérios de aceite

1. Confirmar domínio, DCs, base, CA, mecanismo, conta de leitura, grupo permitido,
   conta piloto e responsáveis pelo ciclo de vida. A conta técnica deve ter
   somente leitura necessária; nenhuma aplicação precisa de Domain Admin.
2. Validar DNS, TLS e autenticação a partir da API no ambiente de homologação.
   A VPN do desenvolvedor não deve ser dependência operacional da intranet.
3. Ensaiar migração e vínculo com cópia controlada, sem sobrescrever RH. Testar
   conta permitida, conta fora do grupo, credencial errada, conta desativada,
   bloqueada, expirada, senha expirada e troca obrigatória com contas de teste
   preparadas pela TI, sem provocar bloqueio de contas reais.
4. Testar renomeação e movimentação do mesmo GUID, GUID diferente com mesmo
   e-mail, duplicidade, ausência de e-mail, grupo aninhado, entrada com caracteres de filtro LDAP, falha de DNS,
   timeout, CA incorreta e certificado expirado. Nenhuma falha pode ativar login
   local para uma conta AD ou conceder papel adicional.
5. Verificar revogação dentro do prazo acordado, permissões por unidade,
   concorrência de logins, ausência de credenciais em logs, logout e ações de
   administração. Para OIDC, incluir state/nonce/PKCE, issuer/audience e replay.
6. Liberar grupo piloto pequeno, observar erros e validar com usuários reais.
   Ampliar somente depois de demonstrar login e acesso autorizado na interface.

O retorno operacional deve manter a migração aditiva e a conta de emergência.
Desativar a entrada AD e revogar suas sessões não significa reativar senhas locais
dos usuários convertidos. Não executar uma versão antiga que suponha hash não
nulo sem comprovar compatibilidade com o novo schema. Guardar backup e ensaiar o
procedimento antes da implantação.

## Estado da implementação local

A branch `codex/ad-integration` parte de `origin/dev` no commit `19fa220`, a
versão integrada mais recente obtida em 14/10/2026. A branch anterior foi
preservada. O adaptador LDAPS, a migração 0009, o vínculo explícito pela interface,
o login por nome curto/UPN e a revalidação de sessões foram implementados.

A verificação ao vivo usou o adaptador Node/ldapts da aplicação contra o DC01,
com CA e hostname validados: consulta por nome, consulta pelo mesmo GUID binário
e bind de usuário passaram. Também passaram login HTTP 200, restauração de sessão
200, logout 204 e rejeição posterior 401, usando o backend novo e banco local
isolado. A identidade sem e-mail retornou `email: null`, provedor `ad` e nenhuma
permissão adicional. Apenas a conta já fornecida para investigação foi usada
nessa prova temporária; nenhum usuário ou atributo do AD foi alterado.

Os testes de interface usam diretório simulado e PostgreSQL real; os testes ao
vivo usam o AD real e backend local. Isso comprova partes complementares do fluxo,
mas não é implantação ou aceite de homologação. O túnel VPN precisou ser
reconectado após apresentar timeout apesar do estado conectado na interface.

A implantação continua dependendo da conta técnica dedicada, definição dos
usuários piloto e instalação dos arquivos de segredo/CA. O overlay opcional de
Compose configura DNS somente na API. DC02 não foi incluído no runtime porque a
cadeia ainda precisa de correção. Ver [operação e validação](active-directory.md).

### Complemento: teste com contas próprias

A validação posterior criou duas contas temporárias comuns no AD usando o acesso
fornecido: usuário piloto e leitor separado. O fluxo de vínculo/login pela interface
foi executado com o AD real. Também passaram rejeição de senha incorreta, desativação,
expiração, troca obrigatória, revogação de sessão, recuperação e renomeação por GUID.
Ambas as contas foram desabilitadas ao final. Isso confirma que é possível
provisionar e validar as contas com o acesso disponível; a preparação da credencial
permanente continua sendo uma etapa de implantação, não uma falta de acesso para
testar. Ver [resultados e limites](active-directory.md#validação-com-contas-de-teste-no-ad-real).
