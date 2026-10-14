import type {
  AccountCandidate,
  AccountCreate,
  AdminUser,
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
  PasswordReset,
  PermissionKey,
} from "@cge/contracts";
import { argon2id, hash, verify } from "argon2";
import { and, eq, gt, ilike, isNull, notExists, or, sql } from "drizzle-orm";

import type { Database, Transaction } from "../../db/client.js";
import { auditEvents } from "../audit/schema.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "../people/schema.js";
import { avatarUrl } from "../people/avatar.js";
import type { AuditInput } from "../audit/service.js";
import {
  AuthenticationError,
  directoryUnavailable,
  type Directory,
} from "./directory.js";
import { sessions, userAccounts } from "./schema.js";
import { createSessionToken, hashSessionToken } from "./token.js";

export interface AuthenticationService {
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  createAccount(
    personId: string,
    input: AccountCreate,
    actorAccountId: string,
  ): Promise<{ id: string; email: string | null }>;
  changePassword(
    accountId: string,
    input: ChangePasswordRequest,
  ): Promise<"changed" | "invalid-current-password">;
  login(
    input: LoginRequest,
    clientIp?: string,
  ): Promise<{ token: string; user: AuthenticatedUser } | null>;
  listAccountCandidates(
    query?: string,
    limit?: number,
  ): Promise<AccountCandidate[]>;
  listAccounts(): Promise<AdminUser[]>;
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

export async function deactivateAccountInTransaction(
  tx: Transaction,
  accountId: string,
  actorAccountId: string,
) {
  const [account] = await tx
    .update(userAccounts)
    .set({ status: "disabled", updatedAt: new Date() })
    .where(eq(userAccounts.id, accountId))
    .returning({ id: userAccounts.id });
  if (!account) return false;
  await tx.delete(sessions).where(eq(sessions.accountId, accountId));
  await tx.insert(auditEvents).values({
    actorAccountId,
    action: "account.deactivated",
    objectType: "account",
    objectId: accountId,
    outcome: "success",
  });
  return true;
}

export class LocalAuthenticationService implements AuthenticationService {
  private readonly refreshing = new Map<string, Promise<boolean>>();
  private readonly attempts = new Map<
    string,
    { count: number; until: number }
  >();
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
    private readonly directory?: Directory,
  ) {}

  async authenticate(token: string): Promise<AuthenticatedUser | null> {
    const tokenHash = hashSessionToken(token);
    const [record] = await this.db
      .select({
        accountId: userAccounts.id,
        email: userAccounts.email,
        authProvider: userAccounts.authProvider,
        directoryId: userAccounts.directoryId,
        directoryGuid: userAccounts.directoryGuid,
        directoryUpn: userAccounts.directoryUpn,
        directoryCheckedAt: userAccounts.directoryCheckedAt,
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

    if (record.authProvider === "ad") {
      if (
        !this.directory ||
        record.directoryId !== this.directory.id ||
        !record.directoryGuid
      )
        throw directoryUnavailable();
      if (
        !record.directoryCheckedAt ||
        Date.now() - record.directoryCheckedAt.getTime() >=
          this.directory.recheckSeconds * 1000
      ) {
        if (
          !(await this.refreshDirectoryAccount(
            record.accountId,
            record.directoryGuid,
          ))
        )
          return null;
        return this.authenticate(token);
      }
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

  async login(input: LoginRequest, clientIp = "unknown") {
    const identifier = (input.identifier ?? input.email ?? "")
      .trim()
      .toLowerCase();
    let candidates = await this.db
      .select()
      .from(userAccounts)
      .where(
        or(
          and(
            eq(userAccounts.authProvider, "local"),
            sql`lower(${userAccounts.email}) = ${identifier}`,
          ),
          this.directory
            ? and(
                eq(userAccounts.authProvider, "ad"),
                eq(userAccounts.directoryId, this.directory.id),
                or(
                  sql`lower(${userAccounts.directoryUpn}) = ${identifier}`,
                  sql`lower(${userAccounts.directorySam}) = ${identifier}`,
                ),
              )
            : sql`false`,
        ),
      )
      .limit(2);
    // Resolve renamed AD logins by GUID, without creating or linking an account.
    if (!candidates.length && this.directory) {
      const identity = await this.directory.findByLogin(identifier);
      if (identity)
        candidates = await this.db
          .select()
          .from(userAccounts)
          .where(
            and(
              eq(userAccounts.authProvider, "ad"),
              eq(userAccounts.directoryId, this.directory.id),
              eq(userAccounts.directoryGuid, identity.guid),
            ),
          )
          .limit(2);
    }
    const account = candidates.length === 1 ? candidates[0] : undefined;
    let valid = false;
    let identity = null;
    if (account?.status === "active") {
      if (account.authProvider === "ad") {
        this.limitDirectoryLogin(`${clientIp}:${account.id}`);
        if (
          !this.directory ||
          account.directoryId !== this.directory.id ||
          !account.directoryGuid
        )
          throw directoryUnavailable();
        identity = await this.directory.findByGuid(account.directoryGuid);
        valid = Boolean(
          identity?.eligible &&
          (await this.directory.verifyPassword(identity, input.password)),
        );
      } else if (account.passwordHash) {
        valid = await verify(account.passwordHash, input.password);
      }
    }
    if (!valid || !account) {
      await this.recordEvent({
        action: "auth.login",
        objectType: "account",
        outcome: "failure",
        metadata: { identifier },
      });
      return null;
    }
    const token = createSessionToken();
    const created = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(userAccounts)
        .where(eq(userAccounts.id, account.id))
        .for("update");
      if (
        !current ||
        current.status !== "active" ||
        current.authProvider !== account.authProvider ||
        current.passwordHash !== account.passwordHash ||
        current.directoryGuid !== account.directoryGuid ||
        current.directoryId !== account.directoryId
      )
        return false;
      if (identity)
        await tx
          .update(userAccounts)
          .set({
            directoryCheckedAt: new Date(),
            directoryUpn: identity.upn,
            directorySam: identity.samAccountName,
          })
          .where(eq(userAccounts.id, account.id));
      await tx.insert(sessions).values({
        accountId: account.id,
        expiresAt: new Date(Date.now() + this.sessionTtlHours * 3600000),
        tokenHash: hashSessionToken(token),
      });
      return true;
    });
    if (!created) return null;
    const user = await this.authenticate(token);
    if (!user) {
      await this.db
        .delete(sessions)
        .where(eq(sessions.tokenHash, hashSessionToken(token)));
      return null;
    }
    await this.recordEvent({
      actorAccountId: account.id,
      action: "auth.login",
      objectType: "account",
      objectId: account.id,
      outcome: "success",
    });
    return { token, user };
  }

  private limitDirectoryLogin(key: string) {
    const now = Date.now();
    for (const [oldKey, entry] of this.attempts)
      if (entry.until <= now) this.attempts.delete(oldKey);
    const entry = this.attempts.get(key) ?? { count: 0, until: now + 60000 };
    if (entry.count >= 5 || this.attempts.size >= 10000)
      throw new AuthenticationError(
        429,
        "TOO_MANY_ATTEMPTS",
        "Muitas tentativas. Aguarde um minuto.",
      );
    entry.count += 1;
    this.attempts.set(key, entry);
  }

  private refreshDirectoryAccount(accountId: string, guid: string) {
    const pending = this.refreshing.get(accountId);
    if (pending) return pending;
    const refresh = (async () => {
      const identity = await this.directory!.findByGuid(guid);
      if (!identity?.eligible) {
        await this.db.delete(sessions).where(eq(sessions.accountId, accountId));
        await this.recordEvent({
          actorAccountId: accountId,
          action: "auth.directory-revoked",
          objectType: "account",
          objectId: accountId,
          outcome: "denied",
        });
        return false;
      }
      const updated = await this.db
        .update(userAccounts)
        .set({
          directoryCheckedAt: new Date(),
          directoryUpn: identity.upn,
          directorySam: identity.samAccountName,
        })
        .where(
          and(
            eq(userAccounts.id, accountId),
            eq(userAccounts.directoryGuid, guid),
            eq(userAccounts.authProvider, "ad"),
            eq(userAccounts.status, "active"),
          ),
        )
        .returning({ id: userAccounts.id });
      return updated.length === 1;
    })().finally(() => this.refreshing.delete(accountId));
    this.refreshing.set(accountId, refresh);
    return refresh;
  }

  async listAccounts() {
    const accounts = await this.db
      .select({
        id: userAccounts.id,
        email: userAccounts.email,
        authProvider: userAccounts.authProvider,
        directoryUpn: userAccounts.directoryUpn,
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
      authProvider: account.authProvider as "local" | "ad",
      directoryUsername: account.directoryUpn,
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
        unitId: organizationUnits.id,
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
      unitId: person.unitId,
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
      .select({
        passwordHash: userAccounts.passwordHash,
        authProvider: userAccounts.authProvider,
      })
      .from(userAccounts)
      .where(eq(userAccounts.id, accountId))
      .limit(1);

    if (account?.authProvider === "ad")
      throw new AuthenticationError(
        409,
        "DIRECTORY_PASSWORD_MANAGED",
        "A senha corporativa deve ser alterada pelo procedimento da TI.",
      );
    if (
      !account ||
      !account.passwordHash ||
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
        .where(
          and(
            eq(userAccounts.id, accountId),
            eq(userAccounts.authProvider, "local"),
          ),
        );
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
    const [existing] = await this.db
      .select({ provider: userAccounts.authProvider })
      .from(userAccounts)
      .where(eq(userAccounts.id, accountId));
    if (existing?.provider === "ad")
      throw new AuthenticationError(
        409,
        "DIRECTORY_PASSWORD_MANAGED",
        "A senha corporativa deve ser redefinida pela TI.",
      );
    const [account] = await this.db
      .update(userAccounts)
      .set({
        passwordHash: await this.hashPassword(input.temporaryPassword),
        forcePasswordChangeAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userAccounts.id, accountId),
          eq(userAccounts.authProvider, "local"),
        ),
      )
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
    return this.db.transaction((tx) =>
      deactivateAccountInTransaction(tx, accountId, actorAccountId),
    );
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
    email: string | null;
    authProvider: string;
    directoryUpn: string | null;
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
        authProvider: record.authProvider as "local" | "ad",
        directoryUsername: record.directoryUpn,
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
