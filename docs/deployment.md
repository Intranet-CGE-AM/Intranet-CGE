# Implantação interna

## Topologia

O Compose de produção executa três serviços na mesma máquina:

- `web`: arquivos Vite e proxy reverso interno;
- `api`: Fastify, migrações e logs JSON estruturados;
- `postgres`: PostgreSQL 17 sem porta publicada.

Somente o web é publicado, por padrão em `127.0.0.1:8080`. Um proxy do host
deve terminar TLS e encaminhar para essa porta. HTTPS é obrigatório porque os
cookies de sessão são `Secure`, `HttpOnly` e `SameSite=Strict`.

## Preparação

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

Defina senhas aleatórias longas, `DATABASE_URL` coerente com a senha do
PostgreSQL, `SESSION_SECRET` com pelo menos 32 caracteres e `WEB_ORIGIN` com a
URL HTTPS exata. Caracteres reservados da senha devem ser percent-encoded na
URL do banco.

O host precisa de Docker Engine com Compose v2, DNS e certificado internos
confiáveis, horário sincronizado e armazenamento persistente para o volume.
Nenhum CDN ou serviço público é necessário em runtime.

## Subida e verificação

```bash
docker compose --env-file .env.production \
  -f docker-compose.production.yml up -d --build

docker compose --env-file .env.production \
  -f docker-compose.production.yml ps

curl --fail https://intranet.cge.am.gov.br/healthz
curl --fail https://intranet.cge.am.gov.br/readyz
```

`healthz` comprova o processo. `readyz` também consulta o PostgreSQL. A API
aplica migrações antes de iniciar.

## Backup

```bash
./infra/scripts/backup.sh
./infra/scripts/verify-backup.sh backups/intranet-cge-AAAAmmddTHHMMSSZ.dump
```

O backup usa formato custom do `pg_dump`. A verificação restaura em
`intranet_cge_restore_check`, conta as tabelas e remove apenas esse banco.
Agende o backup, copie-o para mídia separada do host, retenha versões conforme a
política da CGE e verifique restaurações regularmente.

Para usar outro arquivo de ambiente ou diretório:

```bash
ENV_FILE=/caminho/seguro/intranet.env \
BACKUP_DIR=/mnt/backup-cge \
./infra/scripts/backup.sh
```

## Restauração

A restauração substitui integralmente o banco de produção e exige confirmação
explícita:

```bash
CONFIRM_RESTORE=replace-production-database \
./infra/scripts/restore.sh backups/intranet-cge-AAAAmmddTHHMMSSZ.dump
```

O script força o encerramento das conexões, recria o banco, executa
`pg_restore`, reinicia a API e consulta a prontidão. Antes de executar:

1. coloque a intranet em janela de manutenção;
2. preserve um backup do estado atual;
3. confira o arquivo com `verify-backup.sh`;
4. confirme `readyz`, login e um registro de auditoria após a restauração.

## Atualização e retorno

Antes de atualizar, gere e verifique um backup. Faça checkout do commit
aprovado e execute `up -d --build`. Para retornar, restaure o commit anterior,
reconstrua as imagens e, se a migração não for retrocompatível, restaure também
o backup correspondente. Nunca faça downgrade de schema sem backup validado.
