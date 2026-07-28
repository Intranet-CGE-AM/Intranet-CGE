FROM node:22-alpine AS build

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

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/apps/api apps/api
COPY --from=build /app/packages/contracts packages/contracts

USER node
EXPOSE 3000
CMD ["sh", "-c", "pnpm --filter @cge/api db:migrate && pnpm --filter @cge/api start"]
