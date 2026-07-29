import type {
  AccountCandidate,
  AccountCreate,
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
  PasswordReset,
  PermissionKey,
} from "@cge/contracts";
import { argon2id, hash, verify } from "argon2";
import { and, eq, gt, ilike, isNull, notExists, or, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "../people/schema.js";
import { avatarUrl } from "../people/avatar.js";
import type { AuditInput } from "../audit/service.js";
import { sessions, userAccounts } from "./schema.js";
import { createSessionToken, hashSessionToken } from "./token.js";

export interface AuthenticationService {
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  createAccount(
    personId: string,
    input: AccountCreate,
    actorAccountId: string,
  ): Promise<{ id: string; email: string }>;
  changePassword(
    accountId: string,
    input: ChangePasswordRequest,
  ): Promise<"changed" | "invalid-current-password">;
  login(
    input: LoginRequest,
  ): Promise<{ token: string; user: AuthenticatedUser } | null>;
  listAccountCandidates(
    query?: string,
    limit?: number,
  ): Promise<AccountCandidate[]>;
  listAccounts(): Promise<
    Array<{
      id: string;
      email: string;
      status: "active" | "disabled";
      person: { id: string; displayName: string };
      employment: { unitId: string; unitName: string } | null;
    }>
  >;
  logout(token: string): Promise<void>;
  resetPassword(
    accountId: string,
    input: PasswordReset,
    actorAccountId: string,
  ): Promise<boolean>;
  deactivateAccount(
    accountId: string,
    actorAccountId: string,
  ): Promise<boolean>;
  deactivateAccountForPerson(
    personId: string,
    actorAccountId: string,
  ): Promise<void>;
}

export class LocalAuthenticationService implements AuthenticationService {
  constructor(
    private readonly db: Database,
    private readonly sessionTtlHours: number,
    private readonly resolvePermissions: (
      accountId: string,
    ) => Promise<
      Array<{ key: PermissionKey; unitId: string | null }>
    > = async () => [],
    private readonly recordEvent: (
      input: AuditInput,
    ) => Promise<void> = async () => {},
  ) {}

  async authenticate(token: string) {
    const tokenHash = hashSessionToken(token);
    const [record] = await this.db
      .select({
        accountId: userAccounts.id,
        email: userAccounts.email,
        forcePasswordChangeAt: userAccounts.forcePasswordChangeAt,
        personId: people.id,
        fullName: people.fullName,
        preferredName: people.preferredName,
        avatarObjectKey: people.avatarObjectKey,
        avatarUpdatedAt: people.avatarUpdatedAt,
        employmentId: employmentRelationships.id,
        jobTitle: employmentRelationships.jobTitle,
        unitId: organizationUnits.id,
        unitCode: organizationUnits.code,
        unitName: organizationUnits.name,
        categoryId: employmentCategories.id,
        categoryName: employmentCategories.name,
      })
      .from(sessions)
      .innerJoin(userAccounts, eq(sessions.accountId, userAccounts.id))
      .innerJoin(people, eq(userAccounts.personId, people.id))
      .leftJoin(
        employmentRelationships,
        and(
          eq(employmentRelationships.personId, people.id),
          isNull(employmentRelationships.endDate),
        ),
      )
      .leftJoin(
        organizationUnits,
        eq(employmentRelationships.unitId, organizationUnits.id),
      )
      .leftJoin(
        employmentCategories,
        eq(employmentRelationships.categoryId, employmentCategories.id),
      )
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
          eq(userAccounts.status, "active"),
        ),
      )
      .limit(1);

    if (!record) {
      return null;
    }

    return {
      ...this.toAuthenticatedUser(record),
      permissions: await this.resolvePermissions(record.accountId),
    };
  }

  async createAccount(
    personId: string,
    input: AccountCreate,
    actorAccountId: string,
  ) {
    const [account] = await this.db
      .insert(userAccounts)
      .values({
        personId,
        email: input.email.trim().toLowerCase(),
        passwordHash: await this.hashPassword(input.temporaryPassword),
        forcePasswordChangeAt: new Date(),
      })
      .returning({ id: userAccounts.id, email: userAccounts.email });
    if (!account) {
      throw new Error("Account was not created");
    }
    await this.recordEvent({
      actorAccountId,
      action: "account.created",
      objectType: "account",
      objectId: account.id,
      outcome: "success",
      metadata: { personId },
    });
    return account;
  }

  async login(input: LoginRequest) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const [account] = await this.db
      .select({
        id: userAccounts.id,
        passwordHash: userAccounts.passwordHash,
        status: userAccounts.status,
      })
      .from(userAccounts)
      .where(sql`lower(${userAccounts.email}) = ${normalizedEmail}`)
      .limit(1);

    if (
      !account ||
      account.status !== "active" ||
      !(await verify(account.passwordHash, input.password))
    ) {
      await this.recordEvent({
        action: "auth.login",
        objectType: "account",
        outcome: "failure",
        metadata: { email: normalizedEmail },
      });
      return null;
    }

    await this.recordEvent({
      actorAccountId: account.id,
      action: "auth.login",
      objectType: "account",
      objectId: account.id,
      outcome: "success",
    });
    const token = createSessionToken();
    const expiresAt = new Date(
      Date.now() + this.sessionTtlHours * 60 * 60 * 1000,
    );

    await this.db.insert(sessions).values({
      accountId: account.id,
      expiresAt,
      tokenHash: hashSessionToken(token),
    });

    const user = await this.authenticate(token);
    if (!user) {
      throw new Error("Session was created but could not be authenticated");
    }

    return { token, user };
  }

  async listAccounts() {
    const accounts = await this.db
      .select({
        id: userAccounts.id,
        email: userAccounts.email,
        status: userAccounts.status,
        personId: people.id,
        fullName: people.fullName,
        preferredName: people.preferredName,
        unitId: organizationUnits.id,
        unitName: organizationUnits.name,
      })
      .from(userAccounts)
      .innerJoin(people, eq(userAccounts.personId, people.id))
      .leftJoin(
        employmentRelationships,
        and(
          eq(employmentRelationships.personId, people.id),
          isNull(employmentRelationships.endDate),
        ),
      )
      .leftJoin(
        organizationUnits,
        eq(employmentRelationships.unitId, organizationUnits.id),
      )
      .orderBy(people.fullName);

    return accounts.map((account) => ({
      id: account.id,
      email: account.email,
      status: account.status,
      person: {
        id: account.personId,
        displayName: account.preferredName ?? account.fullName,
      },
      employment:
        account.unitId && account.unitName
          ? { unitId: account.unitId, unitName: account.unitName }
          : null,
    }));
  }

  async listAccountCandidates(query?: string, limit = 20) {
    const term = query?.trim();
    const search = term
      ? or(
          ilike(people.fullName, `%${term}%`),
          ilike(people.preferredName, `%${term}%`),
          ilike(organizationUnits.name, `%${term}%`),
          ilike(organizationUnits.code, `%${term}%`),
          ilike(employmentRelationships.employeeNumber, `%${term}%`),
        )
      : undefined;
    const rows = await this.db
      .select({
        id: people.id,
        fullName: people.fullName,
        preferredName: people.preferredName,
        unitName: organizationUnits.name,
      })
      .from(people)
      .leftJoin(
        employmentRelationships,
        and(
          eq(employmentRelationships.personId, people.id),
          isNull(employmentRelationships.endDate),
        ),
      )
      .leftJoin(
        organizationUnits,
        eq(employmentRelationships.unitId, organizationUnits.id),
      )
      .where(
        and(
          notExists(
            this.db
              .select({ id: userAccounts.id })
              .from(userAccounts)
              .where(eq(userAccounts.personId, people.id)),
          ),
          search,
        ),
      )
      .orderBy(people.fullName)
      .limit(limit);

    return rows.map((person) => ({
      id: person.id,
      displayName: person.preferredName ?? person.fullName,
      unitName: person.unitName,
    }));
  }

  async logout(token: string) {
    const tokenHash = hashSessionToken(token);
    const [session] = await this.db
      .select({ accountId: sessions.accountId })
      .from(sessions)
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
    if (session) {
      await this.recordEvent({
        actorAccountId: session.accountId,
        action: "auth.logout",
        objectType: "account",
        objectId: session.accountId,
        outcome: "success",
      });
    }
  }

  async changePassword(accountId: string, input: ChangePasswordRequest) {
    const [account] = await this.db
      .select({ passwordHash: userAccounts.passwordHash })
      .from(userAccounts)
      .where(eq(userAccounts.id, accountId))
      .limit(1);

    if (
      !account ||
      !(await verify(account.passwordHash, input.currentPassword))
    ) {
      await this.recordEvent({
        actorAccountId: accountId,
        action: "auth.password-change",
        objectType: "account",
        objectId: accountId,
        outcome: "failure",
      });
      return "invalid-current-password" as const;
    }

    const passwordHash = await this.hashPassword(input.newPassword);

    await this.db.transaction(async (transaction) => {
      await transaction
        .update(userAccounts)
        .set({
          forcePasswordChangeAt: null,
          passwordChangedAt: new Date(),
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(userAccounts.id, accountId));
      await transaction
        .delete(sessions)
        .where(eq(sessions.accountId, accountId));
    });
    await this.recordEvent({
      actorAccountId: accountId,
      action: "auth.password-change",
      objectType: "account",
      objectId: accountId,
      outcome: "success",
    });

    return "changed" as const;
  }

  async resetPassword(
    accountId: string,
    input: PasswordReset,
    actorAccountId: string,
  ) {
    const [account] = await this.db
      .update(userAccounts)
      .set({
        passwordHash: await this.hashPassword(input.temporaryPassword),
        forcePasswordChangeAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userAccounts.id, accountId))
      .returning({ id: userAccounts.id });
    if (!account) {
      return false;
    }
    await this.db.delete(sessions).where(eq(sessions.accountId, accountId));
    await this.recordEvent({
      actorAccountId,
      action: "account.password-reset",
      objectType: "account",
      objectId: accountId,
      outcome: "success",
    });
    return true;
  }

  async deactivateAccount(accountId: string, actorAccountId: string) {
    const [account] = await this.db
      .update(userAccounts)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(eq(userAccounts.id, accountId))
      .returning({ id: userAccounts.id });
    if (!account) {
      return false;
    }
    await this.db.delete(sessions).where(eq(sessions.accountId, accountId));
    await this.recordEvent({
      actorAccountId,
      action: "account.deactivated",
      objectType: "account",
      objectId: accountId,
      outcome: "success",
    });
    return true;
  }

  async deactivateAccountForPerson(personId: string, actorAccountId: string) {
    const [account] = await this.db
      .select({ id: userAccounts.id })
      .from(userAccounts)
      .where(eq(userAccounts.personId, personId))
      .limit(1);
    if (account) {
      await this.deactivateAccount(account.id, actorAccountId);
    }
  }

  private hashPassword(password: string) {
    return hash(password, {
      memoryCost: 65_536,
      parallelism: 1,
      timeCost: 3,
      type: argon2id,
    });
  }

  private toAuthenticatedUser(record: {
    accountId: string;
    avatarObjectKey: string | null;
    avatarUpdatedAt: Date | null;
    categoryId: string | null;
    categoryName: string | null;
    email: string;
    employmentId: string | null;
    forcePasswordChangeAt: Date | null;
    fullName: string;
    jobTitle: string | null;
    personId: string;
    preferredName: string | null;
    unitCode: string | null;
    unitId: string | null;
    unitName: string | null;
  }): AuthenticatedUser {
    const hasEmployment =
      record.employmentId &&
      record.unitId &&
      record.unitCode &&
      record.unitName &&
      record.categoryId &&
      record.categoryName;

    return {
      account: {
        email: record.email,
        id: record.accountId,
        mustChangePassword: record.forcePasswordChangeAt !== null,
      },
      person: {
        avatarUrl: record.avatarObjectKey
          ? avatarUrl(record.personId, record.avatarUpdatedAt)
          : null,
        displayName: record.preferredName ?? record.fullName,
        id: record.personId,
      },
      employment: hasEmployment
        ? {
            category: {
              id: record.categoryId!,
              name: record.categoryName!,
            },
            id: record.employmentId!,
            jobTitle: record.jobTitle,
            unit: {
              code: record.unitCode!,
              id: record.unitId!,
              name: record.unitName!,
            },
          }
        : null,
      permissions: [],
    };
  }
}
