import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogTrigger,
  EmptyState,
  FormField,
  Input,
  SearchableSelect,
  Select,
  Skeleton,
} from "@cge/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@cge/ui/tooltip";
import { Plus, Question } from "@phosphor-icons/react";

export function UiKitPage() {
  return (
    <div className="page-enter space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Somente desenvolvimento
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
          Biblioteca compartilhada
        </h1>
      </div>
      <Card>
        <CardHeader>
          <h2 className="font-bold">Controles</h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="quiet">Discreto</Button>
            <Button variant="danger">Destrutivo</Button>
          </div>
          <Input aria-label="Campo de exemplo" placeholder="Campo de texto" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField htmlFor="example-select" label="Lista de opções">
              <Select
                id="example-select"
                name="example-select"
                options={[
                  { label: "Toda a organização", value: "organization" },
                  { label: "Gestão de Pessoas", value: "people" },
                ]}
                placeholder="Selecione o escopo"
              />
            </FormField>
            <FormField
              htmlFor="example-searchable-select"
              label="Lista pesquisável"
            >
              <SearchableSelect
                id="example-searchable-select"
                name="example-searchable-select"
                options={[
                  {
                    keywords: ["Tecnologia da Informação"],
                    label: "Helena Monteiro",
                    value: "helena",
                  },
                  {
                    keywords: ["Gestão de Pessoas"],
                    label: "Marina Rocha",
                    value: "marina",
                  },
                ]}
                placeholder="Pesquise uma pessoa"
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Neutro</Badge>
            <Badge variant="brand">Em análise</Badge>
            <Badge variant="success">Aprovado</Badge>
            <Badge variant="warning">Pendente</Badge>
            <Badge variant="danger">Rejeitado</Badge>
          </div>
          <Alert title="Atenção">
            Mensagens explicam o impacto e a próxima ação sem depender apenas de
            cor.
          </Alert>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Plus aria-hidden="true" size={16} />
                Abrir diálogo
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Exemplo de diálogo"
              description="Foco, descrição e fechamento são acessíveis."
            >
              <Button>Confirmar</Button>
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            confirmLabel="Confirmar ação"
            description="A confirmação explicita o impacto antes de executar uma ação destrutiva."
            onConfirm={() => undefined}
            title="Confirmar ação?"
          >
            <Button variant="danger">Abrir confirmação</Button>
          </ConfirmDialog>
          <TooltipProvider delayDuration={350}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="quiet">
                  <Question aria-hidden="true" size={16} />
                  Ver explicação
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Tooltips complementam rótulos visíveis sem esconder instruções
                essenciais.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <EmptyState
            title="Nenhum item encontrado"
            description="Ajuste os filtros ou crie o primeiro registro."
          />
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
