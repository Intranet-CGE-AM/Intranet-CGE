# Implantação interna

## Topologia

O Compose de produção executa cinco serviços na mesma máquina:

- `web`: arquivos Vite e proxy reverso interno;
- `api`: Fastify e logs JSON estruturados;
- `postgres`: PostgreSQL 17 sem porta publicada.
- `minio`: objetos privados, hoje usados pelas fotos, sem porta publicada.
- `watchtower`: aplica a tag `production` quando o digest muda.

Homologação roda o mesmo desenho em paralelo, pelo
`docker-compose.homolog.yml`, com nome de projeto, volumes, rede, porta e
escopo de Watchtower próprios. Os dois ambientes convivem na mesma máquina sem
compartilhar estado. Ver [CI/CD](cicd.md).

Produção **não aplica migrações ao subir**. Um restart do Watchtower nunca
altera o schema; a migração é operação deliberada, descrita em [CI/CD](cicd.md).

O perfil `tools` adiciona o cliente de object storage somente durante backup ou
restauração. Somente o web é publicado, por padrão em `127.0.0.1:8080`. Um proxy
do host deve terminar TLS e encaminhar para essa porta. HTTPS é obrigatório
porque os cookies de sessão são `Secure`, `HttpOnly` e `SameSite=Strict`.

## Preparação

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Defina senhas aleatórias longas, `DATABASE_URL` coerente com a senha do
PostgreSQL, `SESSION_SECRET` com pelo menos 32 caracteres, credenciais do object
storage e `WEB_ORIGIN` com a URL HTTPS exata. Caracteres reservados da senha
devem ser percent-encoded na URL do banco. Crie o bucket antes de restringir a
credencial da aplicação e limite essa credencial ao bucket da intranet.

O host precisa de Docker Engine com Compose v2, DNS e certificado internos
confiáveis, horário sincronizado e armazenamento persistente para o volume.
Nenhum CDN ou serviço público é necessário em runtime.

## Subida e verificação

As imagens vêm do GHCR; nada é construído na máquina. Autentique uma vez para
que o Watchtower e o `pull` enxerguem o pacote privado:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u <usuario> --password-stdin
```

```bash
docker compose --env-file .env.production \
  -f docker-compose.production.yml up -d

docker compose --env-file .env.production \
  -f docker-compose.production.yml ps

curl --fail https://intranet.cge.am.gov.br/healthz
curl --fail https://intranet.cge.am.gov.br/readyz
```

`healthz` comprova o processo. `readyz` também consulta o PostgreSQL e o bucket.
A API aplica migrações antes de iniciar.

## Backup

```bash
./infra/scripts/backup.sh
./infra/scripts/verify-backup.sh backups/intranet-cge-AAAAmmddTHHMMSSZ
```

Cada backup é um diretório com `database.dump`, `objects/` e
`checksums.sha256`. A verificação confere os hashes, restaura o PostgreSQL em
`intranet_cge_restore_check`, conta as tabelas e remove apenas esse banco.
Agende o backup, copie o diretório inteiro para mídia separada do host, retenha
versões conforme a política da CGE e verifique restaurações regularmente.

Para usar outro arquivo de ambiente ou diretório:

```bash
ENV_FILE=/caminho/seguro/intranet.env \
BACKUP_DIR=/mnt/backup-cge \
./infra/scripts/backup.sh
```

## Restauração

A restauração substitui integralmente o banco e o bucket de produção e exige
confirmação explícita:

```bash
CONFIRM_RESTORE=replace-production-data \
./infra/scripts/restore.sh backups/intranet-cge-AAAAmmddTHHMMSSZ
```

O script força o encerramento das conexões, recria o banco, executa
`pg_restore`, reinicia a API e consulta a prontidão. Antes de executar:

1. coloque a intranet em janela de manutenção;
2. preserve um backup do estado atual;
3. confira o arquivo com `verify-backup.sh`;
4. confirme `readyz`, login e um registro de auditoria após a restauração.

## Ensaio isolado

```bash
./infra/scripts/rehearse-production.sh
```

O ensaio usa projeto, volumes e segredos temporários. Ele constrói as imagens,
aplica migrações, provisiona o administrador, valida prontidão, gera e verifica
o backup, remove um objeto, faz a restauração destrutiva e comprova login e
retorno do objeto. Nada é reutilizado como segredo ou dado de produção.

## Decisão sobre object storage

A imagem oficial disponível no Compose está fixada em
`RELEASE.2025-09-07T16-13-09Z`. O
[projeto MinIO](https://github.com/minio/minio/releases) foi arquivado e a
correção de segurança posterior não recebeu imagem oficial pronta. Antes do
piloto, TI e Segurança devem registrar uma destas decisões:

1. construir internamente a imagem da última revisão de segurança;
2. aprovar temporariamente a revisão fixada, com controles e prazo de troca;
3. trocar o endpoint por outro servidor S3-compatible mantido.

O módulo de pessoas depende apenas do contrato interno de object storage; a
troca não altera as rotas ou telas de RH.

## Atualização e retorno

A atualização é automática: o merge em `main` reaponta a tag `production` para
o digest já validado em homologação e o Watchtower aplica. Ver
[CI/CD](cicd.md).

Para retornar a uma versão anterior, reaponte a tag para o digest antigo — a
imagem continua publicada:

```bash
docker buildx imagetools create \
  -t ghcr.io/intranet-cge-am/intranet-cge-api:production \
  ghcr.io/intranet-cge-am/intranet-cge-api:tree-<árvore-anterior>
```

O Watchtower aplica o retorno no ciclo seguinte. Como produção não migra ao
subir, voltar a imagem não desfaz schema já aplicado: se a versão anterior for
incompatível com o schema atual, restaure também o backup correspondente.
Nunca faça downgrade de schema sem backup validado.
