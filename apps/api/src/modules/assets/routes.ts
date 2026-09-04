import {
  assetCreateSchema,
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
  };