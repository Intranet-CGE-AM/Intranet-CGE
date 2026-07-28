import "dotenv/config";

import { type PermissionKey } from "@cge/contracts";
import { argon2id, hash } from "argon2";
import { eq, inArray, sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";

import { createDatabase, type Database } from "../db/client.js";
import {
  roleAssignments,
  rolePermissions,
  roles,
} from "../modules/access/schema.js";
import { auditEvents } from "../modules/audit/schema.js";
import { sessions, userAccounts } from "../modules/auth/schema.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "../modules/people/schema.js";
import {
  vacationRequestEvents,
  vacationRequests,
} from "../modules/vacations/schema.js";

const confirmation = "SEED_CGE_HOMOLOG";
const accountDomain = "homolog.cge.am.gov.br";
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type FixturePerson = {
  birthDate: string;
  birthdayVisible: boolean;
  categoryId: string;
  employeeNumber: string;
  fullName: string;
  jobTitle: string;
  preferredName: string;
  startDate: string;
  unitId: string;
};

export function assertHomologSeedEnvironment(environment: NodeJS.ProcessEnv) {
  const databaseUrl = environment.DATABASE_URL ?? "";
  const password = environment.HOMOLOG_SEED_PASSWORD ?? "";
  let databaseName: string;
  try {
    databaseName = new URL(databaseUrl).pathname.slice(1);
  } catch {
    throw new Error("DATABASE_URL inválida.");
  }
  if (
    environment.NODE_ENV === "production" ||
    environment.HOMOLOG_SEED_CONFIRM !== confirmation ||
    !/(homolog|hml|test|e2e)/i.test(databaseName)
  ) {
    throw new Error(
      `Seed bloqueado. Use banco de homologação/teste e HOMOLOG_SEED_CONFIRM=${confirmation}.`,
    );
  }
  if (password.length < 12) {
    throw new Error("HOMOLOG_SEED_PASSWORD deve ter no mínimo 12 caracteres.");
  }
  return { databaseUrl, password };
}

async function seedHomolog() {
  const { databaseUrl, password } = assertHomologSeedEnvironment(process.env);
  const { client, db } = createDatabase(databaseUrl);
  try {
    const passwordHash = await hash(password, {
      memoryCost: 65_536,
      parallelism: 1,
      timeCost: 3,
      type: argon2id,
    });

    const result = await db.transaction(async (transaction) => {
      const eligible = await ensureCategory(
        transaction,
        "Servidor efetivo",
        true,
      );
      const commissioned = await ensureCategory(
        transaction,
        "Servidor comissionado",
        true,
      );
      const contractor = await ensureCategory(
        transaction,
        "Colaborador terceirizado",
        false,
      );
      const cgrh = await ensureUnit(transaction, "CGRH", "Gestão de Pessoas");
      const cgti = await ensureUnit(
        transaction,
        "CGTI",
        "Tecnologia da Informação",
      );
      const control = await ensureUnit(transaction, "CCI", "Controle Interno");
      const cabinet = await ensureUnit(transaction, "GAB", "Gabinete");
      const ombudsman = await ensureUnit(
        transaction,
        "OUV",
        "Ouvidoria e Transparência",
      );

      const today = manausDate();
      const tomorrow = addDays(today, 1);
      const fixtures = [
        {
          employeeNumber: "HOM-001",
          fullName: "Marina de Souza Rocha",
          preferredName: "Marina Rocha",
          birthDate: birthdayFor(today, 1984),
          birthdayVisible: true,
          categoryId: eligible.id,
          unitId: cgrh.id,
          jobTitle: "Coordenadora de Gestão de Pessoas",
          startDate: "2018-03-12",
        },
        {
          employeeNumber: "HOM-002",
          fullName: "Helena Monteiro Ferreira",
          preferredName: "Helena Monteiro",
          birthDate: birthdayFor(tomorrow, 1987),
          birthdayVisible: true,
          categoryId: commissioned.id,
          unitId: cgti.id,
          jobTitle: "Gerente de Tecnologia",
          startDate: "2019-08-05",
        },
        {
          employeeNumber: "HOM-003",
          fullName: "Caio Nascimento Almeida",
          preferredName: "Caio Nascimento",
          birthDate: birthdayFor(addDays(today, 12), 1991),
          birthdayVisible: true,
          categoryId: eligible.id,
          unitId: cgti.id,
          jobTitle: "Analista de Sistemas",
          startDate: "2021-02-18",
        },
        {
          employeeNumber: "HOM-004",
          fullName: "Leonardo Araújo Campos",
          preferredName: "Leonardo Araújo",
          birthDate: birthdayFor(addDays(today, 21), 1989),
          birthdayVisible: false,
          categoryId: eligible.id,
          unitId: control.id,
          jobTitle: "Auditor Governamental",
          startDate: "2017-06-20",
        },
        {
          employeeNumber: "HOM-005",
          fullName: "Patrícia Silva Mota",
          preferredName: "Patrícia Mota",
          birthDate: "1982-11-04",
          birthdayVisible: true,
          categoryId: commissioned.id,
          unitId: cabinet.id,
          jobTitle: "Assessora Técnica",
          startDate: "2020-01-10",
        },
        {
          employeeNumber: "HOM-006",
          fullName: "Dandara Costa Ribeiro",
          preferredName: "Dandara Ribeiro",
          birthDate: "1994-09-23",
          birthdayVisible: true,
          categoryId: contractor.id,
          unitId: cgti.id,
          jobTitle: "Especialista em Infraestrutura",
          startDate: "2024-04-01",
        },
        {
          employeeNumber: "HOM-007",
          fullName:
            "Ana Beatriz de Oliveira Albuquerque e Vasconcelos Sobrinho",
          preferredName: "Ana Beatriz Vasconcelos",
          birthDate: "1986-12-19",
          birthdayVisible: true,
          categoryId: eligible.id,
          unitId: control.id,
          jobTitle:
            "Assessora Especial de Monitoramento e Integridade Institucional",
          startDate: "2016-10-03",
        },
        {
          employeeNumber: "HOM-008",
          fullName: "Luiza Barreto Sampaio",
          preferredName: "Luiza Barreto",
          birthDate: "1993-02-16",
          birthdayVisible: true,
          categoryId: eligible.id,
          unitId: cgti.id,
          jobTitle: "Analista de Tecnologia",
          startDate: "2025-01-13",
        },
        {
          employeeNumber: "HOM-009",
          fullName: "Thiago Freitas Lima",
          preferredName: "Thiago Freitas",
          birthDate: "1988-06-08",
          birthdayVisible: true,
          categoryId: eligible.id,
          unitId: cabinet.id,
          jobTitle: "Assessor de Gabinete",
          startDate: "2022-05-09",
        },
        {
          employeeNumber: "HOM-010",
          fullName: "Renata Martins Queiroz",
          preferredName: "Renata Martins",
          birthDate: "1990-03-27",
          birthdayVisible: true,
          categoryId: commissioned.id,
          unitId: cabinet.id,
          jobTitle: "Assessora Administrativa",
          startDate: "2020-07-06",
        },
      ] satisfies FixturePerson[];

      const seededPeople = new Map<
        string,
        { employmentId: string; personId: string }
      >();
      for (const fixture of fixtures) {
        seededPeople.set(
          fixture.employeeNumber,
          await ensurePerson(transaction, fixture),
        );
      }
      const supervisor = required(seededPeople.get("HOM-002"));
      const worker = required(seededPeople.get("HOM-003"));
      await transaction
        .update(employmentRelationships)
        .set({ supervisorRelationshipId: null, updatedAt: new Date() })
        .where(
          inArray(
            employmentRelationships.id,
            [...seededPeople.values()].map((person) => person.employmentId),
          ),
        );
      for (const employmentId of [
        worker.employmentId,
        required(seededPeople.get("HOM-006")).employmentId,
      ]) {
        await transaction
          .update(employmentRelationships)
          .set({
            supervisorRelationshipId: supervisor.employmentId,
            updatedAt: new Date(),
          })
          .where(eq(employmentRelationships.id, employmentId));
      }
      await transaction
        .update(employmentRelationships)
        .set({ endDate: addDays(today, -1), updatedAt: new Date() })
        .where(
          eq(
            employmentRelationships.id,
            required(seededPeople.get("HOM-010")).employmentId,
          ),
        );

      const accounts = {
        hr: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-001")).personId,
          `marina.rocha@${accountDomain}`,
          passwordHash,
        ),
        supervisor: await ensureAccount(
          transaction,
          supervisor.personId,
          `helena.monteiro@${accountDomain}`,
          passwordHash,
        ),
        worker: await ensureAccount(
          transaction,
          worker.personId,
          `caio.nascimento@${accountDomain}`,
          passwordHash,
        ),
        viewer: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-004")).personId,
          `leonardo.araujo@${accountDomain}`,
          passwordHash,
        ),
        disabled: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-005")).personId,
          `patricia.mota@${accountDomain}`,
          passwordHash,
          "disabled",
        ),
        contractor: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-006")).personId,
          `dandara.ribeiro@${accountDomain}`,
          passwordHash,
        ),
        noAccess: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-007")).personId,
          `ana.vasconcelos@${accountDomain}`,
          passwordHash,
        ),
        firstAccess: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-008")).personId,
          `luiza.barreto@${accountDomain}`,
          passwordHash,
          "active",
          true,
        ),
        emptyScope: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-009")).personId,
          `thiago.freitas@${accountDomain}`,
          passwordHash,
        ),
        inactiveEmployment: await ensureAccount(
          transaction,
          required(seededPeople.get("HOM-010")).personId,
          `renata.martins@${accountDomain}`,
          passwordHash,
        ),
      };

      const seededAccountIds = Object.values(accounts).map(
        (account) => account.id,
      );
      await transaction
        .delete(sessions)
        .where(inArray(sessions.accountId, seededAccountIds));

      const roleFixtures: Array<{
        description: string;
        key: string;
        name: string;
        permissions: PermissionKey[];
      }> = [
        {
          key: "hr",
          name: "RH Homologação",
          description: "Administração de pessoas e decisão final de férias.",
          permissions: [
            "people.read",
            "people.manage",
            "people.import",
            "birthdays.read",
            "vacations.review.final",
          ],
        },
        {
          key: "supervisor",
          name: "Chefia Homologação",
          description: "Diretório e decisões de chefia por unidade.",
          permissions: [
            "people.read",
            "birthdays.read",
            "vacations.review.supervisor",
          ],
        },
        {
          key: "worker",
          name: "Colaborador Homologação",
          description: "Diretório, aniversários e solicitação de férias.",
          permissions: ["people.read", "birthdays.read", "vacations.create"],
        },
        {
          key: "viewer",
          name: "Consulta Homologação",
          description: "Consulta ao diretório por unidade.",
          permissions: ["people.read"],
        },
        {
          key: "audit",
          name: "Auditoria Homologação",
          description: "Consulta e exportação da auditoria da plataforma.",
          permissions: ["audit.read", "audit.export"],
        },
      ];
      const seededRoles = new Map<string, { id: string }>();
      for (const fixture of roleFixtures) {
        seededRoles.set(fixture.key, await ensureRole(transaction, fixture));
      }
      await transaction
        .delete(roleAssignments)
        .where(inArray(roleAssignments.accountId, seededAccountIds));
      await transaction.insert(roleAssignments).values([
        {
          accountId: accounts.hr.id,
          roleId: required(seededRoles.get("hr")).id,
        },
        {
          accountId: accounts.supervisor.id,
          roleId: required(seededRoles.get("supervisor")).id,
          unitId: cgti.id,
        },
        {
          accountId: accounts.worker.id,
          roleId: required(seededRoles.get("worker")).id,
          unitId: cgti.id,
        },
        {
          accountId: accounts.viewer.id,
          roleId: required(seededRoles.get("viewer")).id,
          unitId: control.id,
        },
        {
          accountId: accounts.disabled.id,
          roleId: required(seededRoles.get("worker")).id,
          unitId: cabinet.id,
        },
        {
          accountId: accounts.contractor.id,
          roleId: required(seededRoles.get("worker")).id,
          unitId: cgti.id,
        },
        {
          accountId: accounts.firstAccess.id,
          roleId: required(seededRoles.get("worker")).id,
          unitId: cgti.id,
        },
        {
          accountId: accounts.firstAccess.id,
          roleId: required(seededRoles.get("audit")).id,
        },
        {
          accountId: accounts.emptyScope.id,
          roleId: required(seededRoles.get("viewer")).id,
          unitId: ombudsman.id,
        },
        {
          accountId: accounts.inactiveEmployment.id,
          roleId: required(seededRoles.get("worker")).id,
          unitId: cabinet.id,
        },
      ]);

      await transaction
        .delete(vacationRequests)
        .where(
          eq(vacationRequests.employmentRelationshipId, worker.employmentId),
        );
      const states = [
        "draft",
        "submitted",
        "supervisor_approved",
        "supervisor_rejected",
        "final_approved",
        "final_rejected",
        "cancelled",
      ] as const;
      for (const [index, status] of states.entries()) {
        const [request] = await transaction
          .insert(vacationRequests)
          .values({
            employmentRelationshipId: worker.employmentId,
            supervisorRelationshipId:
              status === "draft" ? null : supervisor.employmentId,
            startDate: addDays(today, 32 + index * 24),
            endDate: addDays(today, 41 + index * 24),
            status,
            version: status === "draft" ? 1 : status === "submitted" ? 2 : 3,
          })
          .returning({ id: vacationRequests.id });
        if (!request) throw new Error("Solicitação de homologação não criada.");
        await transaction
          .insert(vacationRequestEvents)
          .values(eventsFor(status, request.id, accounts));
      }

      await transaction
        .delete(auditEvents)
        .where(eq(auditEvents.objectType, "homolog-fixture"));
      await transaction.insert(auditEvents).values([
        {
          actorAccountId: accounts.hr.id,
          action: "people.updated",
          objectType: "homolog-fixture",
          outcome: "success",
          metadata: { fixture: true, person: "Caio Nascimento" },
        },
        {
          actorAccountId: accounts.worker.id,
          action: "vacation.submitted",
          objectType: "homolog-fixture",
          outcome: "success",
          metadata: { fixture: true },
        },
        {
          actorAccountId: null,
          action: "auth.login",
          objectType: "homolog-fixture",
          outcome: "failure",
          metadata: { fixture: true, reason: "invalid-credentials" },
        },
        {
          actorAccountId: accounts.supervisor.id,
          action: "vacation.supervisor-approved",
          objectType: "homolog-fixture",
          outcome: "success",
          metadata: { fixture: true },
        },
        {
          actorAccountId: accounts.hr.id,
          action: "vacation.final-approved",
          objectType: "homolog-fixture",
          outcome: "success",
          metadata: { fixture: true },
        },
      ]);

      return {
        accounts: Object.keys(accounts).length,
        people: fixtures.length,
        roles: roleFixtures.length,
        vacationStates: states.length,
      };
    });

    console.log("Homologação preparada:", result);
    console.log(
      `Senha comum: HOMOLOG_SEED_PASSWORD (${password.length} caracteres)`,
    );
    console.log(`Usuário RH: marina.rocha@${accountDomain}`);
    console.log(`Chefia: helena.monteiro@${accountDomain}`);
    console.log(`Colaborador: caio.nascimento@${accountDomain}`);
    console.log(`Consulta: leonardo.araujo@${accountDomain}`);
    console.log(`Não elegível: dandara.ribeiro@${accountDomain}`);
    console.log(`Sem acesso: ana.vasconcelos@${accountDomain}`);
    console.log(`Primeiro acesso: luiza.barreto@${accountDomain}`);
    console.log(`Escopo vazio: thiago.freitas@${accountDomain}`);
    console.log(`Vínculo encerrado: renata.martins@${accountDomain}`);
  } finally {
    await client.end();
  }
}

async function ensureCategory(
  db: Transaction,
  name: string,
  vacationEligible: boolean,
) {
  const [existing] = await db
    .select({ id: employmentCategories.id })
    .from(employmentCategories)
    .where(eq(employmentCategories.name, name))
    .limit(1);
  if (existing) {
    await db
      .update(employmentCategories)
      .set({ active: true, vacationEligible })
      .where(eq(employmentCategories.id, existing.id));
    return existing;
  }
  const [created] = await db
    .insert(employmentCategories)
    .values({ name, vacationEligible })
    .returning({ id: employmentCategories.id });
  return required(created);
}

async function ensureUnit(db: Transaction, code: string, name: string) {
  const [existing] = await db
    .select({ id: organizationUnits.id })
    .from(organizationUnits)
    .where(eq(organizationUnits.code, code))
    .limit(1);
  if (existing) {
    await db
      .update(organizationUnits)
      .set({ active: true, name })
      .where(eq(organizationUnits.id, existing.id));
    return existing;
  }
  const [created] = await db
    .insert(organizationUnits)
    .values({ code, name })
    .returning({ id: organizationUnits.id });
  return required(created);
}

async function ensurePerson(db: Transaction, fixture: FixturePerson) {
  const [existing] = await db
    .select({
      employmentId: employmentRelationships.id,
      personId: people.id,
    })
    .from(employmentRelationships)
    .innerJoin(people, eq(employmentRelationships.personId, people.id))
    .where(eq(employmentRelationships.employeeNumber, fixture.employeeNumber))
    .limit(1);
  if (existing) {
    await db
      .update(people)
      .set({
        birthDate: fixture.birthDate,
        birthdayVisible: fixture.birthdayVisible,
        fullName: fixture.fullName,
        preferredName: fixture.preferredName,
        updatedAt: new Date(),
      })
      .where(eq(people.id, existing.personId));
    await db
      .update(employmentRelationships)
      .set({
        categoryId: fixture.categoryId,
        endDate: null,
        jobTitle: fixture.jobTitle,
        startDate: fixture.startDate,
        unitId: fixture.unitId,
        updatedAt: new Date(),
      })
      .where(eq(employmentRelationships.id, existing.employmentId));
    return existing;
  }
  const [person] = await db
    .insert(people)
    .values({
      birthDate: fixture.birthDate,
      birthdayVisible: fixture.birthdayVisible,
      fullName: fixture.fullName,
      preferredName: fixture.preferredName,
    })
    .returning({ id: people.id });
  const [employment] = await db
    .insert(employmentRelationships)
    .values({
      categoryId: fixture.categoryId,
      employeeNumber: fixture.employeeNumber,
      jobTitle: fixture.jobTitle,
      personId: required(person).id,
      startDate: fixture.startDate,
      unitId: fixture.unitId,
    })
    .returning({ id: employmentRelationships.id });
  return {
    employmentId: required(employment).id,
    personId: required(person).id,
  };
}

async function ensureAccount(
  db: Transaction,
  personId: string,
  email: string,
  passwordHash: string,
  status: "active" | "disabled" = "active",
  mustChangePassword = false,
) {
  const passwordState = mustChangePassword
    ? { forcePasswordChangeAt: new Date(), passwordChangedAt: null }
    : { forcePasswordChangeAt: null, passwordChangedAt: new Date() };
  const [existing] = await db
    .select({ id: userAccounts.id })
    .from(userAccounts)
    .where(sql`lower(${userAccounts.email}) = ${email}`)
    .limit(1);
  if (existing) {
    await db
      .update(userAccounts)
      .set({
        ...passwordState,
        passwordHash,
        personId,
        status,
        updatedAt: new Date(),
      })
      .where(eq(userAccounts.id, existing.id));
    return existing;
  }
  const [created] = await db
    .insert(userAccounts)
    .values({
      email,
      ...passwordState,
      passwordHash,
      personId,
      status,
    })
    .returning({ id: userAccounts.id });
  return required(created);
}

async function ensureRole(
  db: Transaction,
  fixture: {
    description: string;
    name: string;
    permissions: PermissionKey[];
  },
) {
  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, fixture.name))
    .limit(1);
  const role =
    existing ??
    required(
      (
        await db
          .insert(roles)
          .values({
            description: fixture.description,
            name: fixture.name,
          })
          .returning({ id: roles.id })
      )[0],
    );
  await db
    .update(roles)
    .set({ description: fixture.description })
    .where(eq(roles.id, role.id));
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  await db.insert(rolePermissions).values(
    fixture.permissions.map((permission) => ({
      permission,
      roleId: role.id,
    })),
  );
  return role;
}

function eventsFor(
  status:
    | "draft"
    | "submitted"
    | "supervisor_approved"
    | "supervisor_rejected"
    | "final_approved"
    | "final_rejected"
    | "cancelled",
  vacationRequestId: string,
  accounts: {
    hr: { id: string };
    supervisor: { id: string };
    worker: { id: string };
  },
) {
  const events = [
    {
      actorAccountId: accounts.worker.id,
      type: "created",
      vacationRequestId,
    },
  ];
  if (status === "draft") return events;
  events.push({
    actorAccountId: accounts.worker.id,
    type: "submitted",
    vacationRequestId,
  });
  if (status === "submitted") return events;
  if (status === "cancelled") {
    events.push({
      actorAccountId: accounts.worker.id,
      type: "cancelled",
      vacationRequestId,
    });
    return events;
  }
  const supervisorRejected = status === "supervisor_rejected";
  events.push({
    actorAccountId: accounts.supervisor.id,
    type: supervisorRejected ? "supervisor-rejected" : "supervisor-approved",
    vacationRequestId,
  });
  if (supervisorRejected || status === "supervisor_approved") return events;
  events.push({
    actorAccountId: accounts.hr.id,
    type: status === "final_approved" ? "final-approved" : "final-rejected",
    vacationRequestId,
  });
  return events;
}

function manausDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Manaus",
    year: "numeric",
  }).format(new Date());
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function birthdayFor(isoDate: string, year: number) {
  return `${year}-${isoDate.slice(5)}`;
}

function required<T>(value: T | null | undefined): T {
  if (!value) throw new Error("Registro obrigatório não foi criado.");
  return value;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await seedHomolog();
}
