import type {
  AuthenticatedUser,
  ChangePasswordRequest,
  LoginRequest,
} from "@cge/contracts";
import { argon2id, hash, verify } from "argon2";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

import type { Database } from "../../db/client.js";
import {
  employmentCategories,
  employmentRelationships,
  organizationUnits,
  people,
} from "../people/schema.js";
import { sessions, userAccounts } from "./schema.js";
import { createSessionToken, hashSessionToken } from "./token.js";

export interface AuthenticationService {
  authenticate(token: string): Promise<AuthenticatedUser | null>;
  changePassword(
    accountId: string,
    input: ChangePasswordRequest,
  ): Promise<"changed" | "invalid-current-password">;
  login(
    input: LoginRequest,
  ): Promise<{ token: string; user: AuthenticatedUser } | null>;
  logout(token: string): Promise<void>;
}

export class LocalAuthenticationService implements AuthenticationService {
  constructor(
    private readonly db: Database,
    private readonly sessionTtlHours: number,
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

    return this.toAuthenticatedUser(record);
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
      return null;
    }

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

  async logout(token: string) {
    await this.db
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
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
      return "invalid-current-password" as const;
    }

    const passwordHash = await hash(input.newPassword, {
      memoryCost: 65_536,
      parallelism: 1,
      timeCost: 3,
      type: argon2id,
    });

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

    return "changed" as const;
  }

  private toAuthenticatedUser(record: {
    accountId: string;
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
