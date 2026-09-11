import {
  assetCreateSchema,
  assetDisposalCreateSchema,
  assetMovementCreateSchema,
  assetUpdateSchema,
} from "@cge/contracts";

import type {
  FastifyPluginAsync,
} from "fastify";

import type {
  ZodTypeProvider,
} from "fastify-type-provider-zod";

import {
  requireAnyPermission,
} from "../access/authorize.js";

import type {
  AccessService,
} from "../access/service.js";

import type {
  AuthenticationService,
} from "../auth/service.js";

import type {
  AssetService,
} from "./service.js";

import {
  z,
} from "zod";


export const assetRoutes:
  FastifyPluginAsync<{
    accessService:
      AccessService;

    authenticationService:
      AuthenticationService;

    assetService:
      AssetService;
  }> =
  async (
    app,
    options,
  ) => {
    const typedApp =
      app.withTypeProvider<ZodTypeProvider>();

          /* LISTAR BENS */

          typedApp.get(
            "/api/assets",

            async (
              request,
              reply,
            ) => {
              const user =
                await requireAnyPermission(
                  request,
                  reply,
                  options.authenticationService,
                  "assets.read",
                );

              if (!user) {
                return;
              }

              return options
                .assetService
                .list();
            },
          );

            /* CONSULTAR BEM */

        typedApp.get(
          "/api/assets/:id",

          {
            schema: {
              params:
                z.object({
                  id: z.uuid(),
                }),
            },
          },

          async (
            request,
            reply,
          ) => {
            const user =
              await requireAnyPermission(
                request,
                reply,
                options.authenticationService,
                "assets.read",
              );

            if (!user) {
              return;
            }

            const asset =
              await options
                .assetService
                .findById(
                  request.params.id,
                );

            if (!asset) {
              return reply
                .status(404)
                .send({
                  code:
                    "ASSET_NOT_FOUND",

                  message:
                    "Bem patrimonial não encontrado.",
                });
            }

            return asset;
          },
        );

        /* EDITAR BEM */

        typedApp.patch(
          "/api/assets/:id",

          {
            schema: {
              params:
                z.object({
                  id: z.uuid(),
                }),

              body:
                assetUpdateSchema,
            },
          },

          async (
            request,
            reply,
          ) => {
            const user =
              await requireAnyPermission(
                request,
                reply,
                options.authenticationService,
                "assets.manage",
              );

            if (!user) {
              return;
            }

            const updated =
              await options
                .assetService
                .update(
                  request.params.id,
                  request.body,
                );

            if (!updated) {
              return reply
                .status(404)
                .send({
                  code:
                    "ASSET_NOT_FOUND",

                  message:
                    "Bem patrimonial não encontrado.",
                });
            }

            return updated;
          },
        );

        /* MOVIMENTAR BEM */

      typedApp.post(
        "/api/assets/:id/movements",

        {
          schema: {
            params:
              z.object({
                id: z.uuid(),
              }),

            body:
              assetMovementCreateSchema,
          },
        },

        async (
          request,
          reply,
        ) => {
          const user =
            await requireAnyPermission(
              request,
              reply,
              options.authenticationService,
              "assets.manage",
            );

          if (!user) {
            return;
          }

          const result =
            await options
              .assetService
              .move(
                request.params.id,
                request.body,
              );

          if (!result.success) {
            switch (
              result.reason
            ) {
              case "ASSET_NOT_FOUND":
                return reply
                  .status(404)
                  .send({
                    code:
                      "ASSET_NOT_FOUND",

                    message:
                      "Bem patrimonial não encontrado.",
                  });

              case "UNIT_NOT_FOUND":
                return reply
                  .status(404)
                  .send({
                    code:
                      "ORGANIZATION_UNIT_NOT_FOUND",

                    message:
                      "Setor de destino não encontrado.",
                  });

              case "UNIT_INACTIVE":
                return reply
                  .status(400)
                  .send({
                    code:
                      "ORGANIZATION_UNIT_INACTIVE",

                    message:
                      "O setor de destino está inativo.",
                  });

              case "SAME_UNIT":
                return reply
                  .status(400)
                  .send({
                    code:
                      "ASSET_ALREADY_IN_UNIT",

                    message:
                      "O bem já está localizado nesse setor.",
                  });
            }
          }

          return reply
            .status(201)
            .send({
              movement:
                result.movement,

              asset:
                result.asset,
            });
        },
      );


    /* CADASTRAR BEM */

    typedApp.post(
      "/api/assets",

      {
        schema: {
          body:
            assetCreateSchema,
        },
      },

      async (
        request,
        reply,
      ) => {
        const user =
          await requireAnyPermission(
            request,
            reply,
            options.authenticationService,
            "assets.manage",
          );

        if (!user) {
          return;
        }

        const created =
          await options
            .assetService
            .create(
              request.body,
            );

        return reply
          .status(201)
          .send(
            created,
          );
      },
    );

    /* HISTÓRICO DE MOVIMENTAÇÕES */

      typedApp.get(
        "/api/assets/:id/movements",

        {
          schema: {
            params:
              z.object({
                id: z.uuid(),
              }),
          },
        },

        async (
          request,
          reply,
        ) => {
          const user =
            await requireAnyPermission(
              request,
              reply,
              options.authenticationService,
              "assets.read",
            );

          if (!user) {
            return;
          }

          const asset =
            await options
              .assetService
              .findById(
                request.params.id,
              );

          if (!asset) {
            return reply
              .status(404)
              .send({
                code:
                  "ASSET_NOT_FOUND",

                message:
                  "Bem patrimonial não encontrado.",
              });
          }

          const movements =
            await options
              .assetService
              .listMovements(
                request.params.id,
              );

          return {
            movements,
          };
        },
      );

      /* ALTERAR SITUAÇÃO DO BEM */

      typedApp.patch(
        "/api/assets/:id/status",

        {
          schema: {
            params:
              z.object({
                id: z.uuid(),
              }),

            body:
              z.object({
                status:
                  z.enum([
                    "active",
                    "maintenance",
                  ]),
              }),
          },
        },

        async (
          request,
          reply,
        ) => {
          const user =
            await requireAnyPermission(
              request,
              reply,
              options.authenticationService,
              "assets.manage",
            );

          if (!user) {
            return;
          }

          const updated =
            await options
              .assetService
              .setStatus(
                request.params.id,
                request.body.status,
              );

          if (!updated) {
            return reply
              .status(404)
              .send({
                code:
                  "ASSET_NOT_FOUND",

                message:
                  "Bem patrimonial não encontrado.",
              });
          }

          return updated;
        },
      );

      /* BAIXA PATRIMONIAL */

      typedApp.post(
        "/api/assets/:id/disposal",

        {
          schema: {
            params:
              z.object({
                id: z.uuid(),
              }),

            body:
              assetDisposalCreateSchema,
          },
        },

        async (
          request,
          reply,
        ) => {
          const user =
            await requireAnyPermission(
              request,
              reply,
              options.authenticationService,
              "assets.manage",
            );

          if (!user) {
            return;
          }

          const result =
            await options
              .assetService
              .dispose(
                request.params.id,
                request.body,
              );

          if (!result.success) {
            switch (
              result.reason
            ) {
              case "ASSET_NOT_FOUND":
                return reply
                  .status(404)
                  .send({
                    code:
                      "ASSET_NOT_FOUND",

                    message:
                      "Bem patrimonial não encontrado.",
                  });

              case "ALREADY_DISPOSED":
                return reply
                  .status(400)
                  .send({
                    code:
                      "ASSET_ALREADY_DISPOSED",

                    message:
                      "Este bem já possui baixa patrimonial.",
                  });
            }
          }

          return reply
            .status(201)
            .send({
              disposal:
                result.disposal,

              asset:
                result.asset,
            });
        },
      );
  };