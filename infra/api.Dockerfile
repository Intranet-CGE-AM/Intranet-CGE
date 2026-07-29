FROM node:22.22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm --filter @cge/contracts build && pnpm --filter @cge/api build

FROM node:22.22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Instala o pnpm da versão declarada em packageManager já na imagem. Sem isso o
# corepack baixa o pnpm do npmjs.org a cada start do container, o que numa rede
# interna restrita transforma um restart em ponto de falha.
#
# COREPACK_HOME precisa sair de /root: o build instala como root e o processo
# roda como `node`, que não enxergaria o cache padrão.
ENV COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable \
  && corepack install \
  && chmod -R a+rX "$COREPACK_HOME"
COPY --from=build /app/apps/api apps/api
COPY --from=build /app/packages/contracts packages/contracts
COPY --chmod=0755 infra/api-entrypoint.sh infra/api-entrypoint.sh

USER node
EXPOSE 3000
# A decisão de migrar vem do ambiente, não do build: a mesma imagem é
# promovida de homologação para produção.
CMD ["/app/infra/api-entrypoint.sh"]
