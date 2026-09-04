import {
  ArrowRight,
  Package,
  PlusCircle,
  Wrench,
  XCircle,
} from "@phosphor-icons/react";

import { Link } from "react-router";

export function AssetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mt-1 text-2xl font-extrabold md:text-[30px]">
          Controle de Patrimônio
        </h1>

        <p className="text-muted-foreground">
          Gerencie os bens patrimoniais da instituição.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Total de bens
            </span>

            <Package size={20} />
          </div>

          <strong className="mt-2 block text-2xl">
            0
          </strong>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Bens em uso
            </span>

            <Package size={20} />
          </div>

          <strong className="mt-2 block text-2xl">
            0
          </strong>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Em manutenção
            </span>

            <Wrench size={20} />
          </div>

          <strong className="mt-2 block text-2xl">
            0
          </strong>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Bens baixados
            </span>

            <XCircle size={20} />
          </div>

          <strong className="mt-2 block text-2xl">
            0
          </strong>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          to="/patrimonio/bens"
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">
                Consultar bens
              </h2>

              <p className="text-sm text-muted-foreground">
                Visualize os bens patrimoniais cadastrados.
              </p>
            </div>

            <ArrowRight size={20} />
          </div>
        </Link>

        <Link
          to="/patrimonio/bens/novo"
          className="rounded-lg border p-5 transition hover:bg-muted"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">
                Cadastrar novo bem
              </h2>

              <p className="text-sm text-muted-foreground">
                Adicione um novo bem ao patrimônio.
              </p>
            </div>

            <PlusCircle size={20} />
          </div>
        </Link>
      </div>
    </div>
  );
}