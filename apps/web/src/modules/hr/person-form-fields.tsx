import type {
  EmploymentCategory,
  OrganizationUnit,
  Person,
  PersonInput,
} from "@cge/contracts";
import { FormField, Input, Select } from "@cge/ui";

import { manausToday } from "../../lib/dates";

export function PersonFormFields({
  categories,
  idPrefix,
  person,
  units,
}: {
  categories: EmploymentCategory[];
  idPrefix: string;
  person?: Person | null;
  units: OrganizationUnit[];
}) {
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      <FormField
        className="sm:col-span-2"
        htmlFor={fieldId("fullName")}
        label="Nome completo"
      >
        <Input
          autoComplete="name"
          defaultValue={person?.fullName ?? ""}
          id={fieldId("fullName")}
          minLength={2}
          name="fullName"
          required
        />
      </FormField>
      <FormField
        htmlFor={fieldId("preferredName")}
        label="Nome social ou preferido"
      >
        <Input
          autoComplete="off"
          defaultValue={person?.preferredName ?? ""}
          id={fieldId("preferredName")}
          name="preferredName"
        />
      </FormField>
      <FormField htmlFor={fieldId("birthDate")} label="Data de nascimento">
        <Input
          defaultValue={person?.birthDate ?? ""}
          id={fieldId("birthDate")}
          name="birthDate"
          type="date"
        />
      </FormField>
      <FormField htmlFor={fieldId("employeeNumber")} label="Matrícula">
        <Input
          autoComplete="off"
          defaultValue={person?.employment?.employeeNumber ?? ""}
          id={fieldId("employeeNumber")}
          name="employeeNumber"
          required
        />
      </FormField>
      <FormField htmlFor={fieldId("startDate")} label="Data de início">
        <Input
          defaultValue={person?.employment?.startDate ?? manausToday()}
          id={fieldId("startDate")}
          name="startDate"
          required
          type="date"
        />
      </FormField>
      <FormField
        hint="Tipo de vínculo, como servidor efetivo, comissionado ou terceirizado."
        htmlFor={fieldId("categoryId")}
        label="Categoria funcional"
      >
        <Select
          defaultValue={person?.employment?.categoryId ?? ""}
          id={fieldId("categoryId")}
          name="categoryId"
          options={categories.map((category) => ({
            label: category.name,
            value: category.id,
          }))}
          placeholder="Selecione a categoria"
          required
        />
      </FormField>
      <FormField
        hint="Área da CGE em que a pessoa ficará lotada."
        htmlFor={fieldId("unitId")}
        label="Unidade de lotação"
      >
        <Select
          defaultValue={person?.employment?.unitId ?? ""}
          id={fieldId("unitId")}
          name="unitId"
          options={units.map((unit) => ({
            label: `${unit.code} — ${unit.name}`,
            value: unit.id,
          }))}
          placeholder="Selecione a unidade"
          required
        />
      </FormField>
      <FormField
        className="sm:col-span-2"
        htmlFor={fieldId("jobTitle")}
        label="Cargo"
      >
        <Input
          autoComplete="organization-title"
          defaultValue={person?.employment?.jobTitle ?? ""}
          id={fieldId("jobTitle")}
          name="jobTitle"
        />
      </FormField>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          className="size-4"
          defaultChecked={person?.birthdayVisible ?? false}
          name="birthdayVisible"
          type="checkbox"
        />
        Autoriza exibição do aniversário (somente dia e mês)
      </label>
    </>
  );
}

export function personInputFromForm(data: FormData): PersonInput {
  const supervisorRelationshipId = String(
    data.get("supervisorRelationshipId") ?? "",
  );
  return {
    fullName: String(data.get("fullName")),
    preferredName: String(data.get("preferredName") || "") || null,
    birthDate: String(data.get("birthDate") || "") || null,
    birthdayVisible: data.get("birthdayVisible") === "on",
    employment: {
      employeeNumber: String(data.get("employeeNumber")),
      categoryId: String(data.get("categoryId")),
      unitId: String(data.get("unitId")),
      ...(data.has("supervisorRelationshipId")
        ? {
            supervisorRelationshipId:
              supervisorRelationshipId &&
              supervisorRelationshipId !== "no-supervisor"
                ? supervisorRelationshipId
                : null,
          }
        : {}),
      startDate: String(data.get("startDate")),
      jobTitle: String(data.get("jobTitle") || "") || null,
    },
  };
}
