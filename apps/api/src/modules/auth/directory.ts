import {
  AndFilter,
  Client,
  EqualityFilter,
  FilterParser,
  InvalidCredentialsError,
  type Entry,
  type Filter,
} from "ldapts";
import { z } from "zod";

export class AuthenticationError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function directoryUnavailable() {
  return new AuthenticationError(
    503,
    "DIRECTORY_UNAVAILABLE",
    "O acesso corporativo está indisponível. Tente novamente em instantes.",
  );
}

export type DirectoryIdentity = {
  guid: string;
  dn: string;
  upn: string;
  samAccountName: string;
  displayName: string;
  email: string | null;
  eligible: boolean;
};

export interface Directory {
  readonly id: string;
  readonly recheckSeconds: number;
  findByLogin(identifier: string): Promise<DirectoryIdentity | null>;
  findByGuid(guid: string): Promise<DirectoryIdentity | null>;
  verifyPassword(
    identity: DirectoryIdentity,
    password: string,
  ): Promise<boolean>;
}

export type DirectoryOptions = {
  id: string;
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  ca: string;
  netbios?: string;
  allowedGroupDN?: string;
  recheckSeconds: number;
};

export function escapeLdapFilter(value: string) {
  return value.replace(
    /[\\*()\0]/g,
    (character) => `\\${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
  );
}

export function guidFromBuffer(value: Buffer) {
  if (value.length !== 16) throw directoryUnavailable();
  const hex = Buffer.from(value);
  hex.subarray(0, 4).reverse();
  hex.subarray(4, 6).reverse();
  hex.subarray(6, 8).reverse();
  const s = hex.toString("hex");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function guidBuffer(guid: string) {
  if (!z.uuid().safeParse(guid).success) throw directoryUnavailable();
  const bytes = Buffer.from(guid.replaceAll("-", ""), "hex");
  bytes.subarray(0, 4).reverse();
  bytes.subarray(4, 6).reverse();
  bytes.subarray(6, 8).reverse();
  return bytes;
}

function text(entry: Entry, key: string): string {
  const value = entry[key];
  return typeof value === "string" ? value : "";
}

export function directoryIdentity(
  entry: Entry,
  now = Date.now(),
): DirectoryIdentity {
  const guid = entry.objectGUID;
  if (
    !Buffer.isBuffer(guid) ||
    !text(entry, "userPrincipalName") ||
    !text(entry, "sAMAccountName")
  )
    throw directoryUnavailable();
  const flags = Number(text(entry, "userAccountControl"));
  const computed = Number(text(entry, "msDS-User-Account-Control-Computed"));
  const expires = text(entry, "accountExpires");
  const neverExpires = expires === "0" || expires === "9223372036854775807";
  const validExpiry =
    /^\d+$/.test(expires) &&
    (neverExpires ||
      BigInt(expires) > BigInt(now) * 10000n + 116444736000000000n);
  const mail = text(entry, "mail");
  return {
    guid: guidFromBuffer(guid),
    dn: entry.dn,
    upn: text(entry, "userPrincipalName").toLowerCase(),
    samAccountName: text(entry, "sAMAccountName").toLowerCase(),
    displayName: text(entry, "displayName") || text(entry, "sAMAccountName"),
    email: z.email().safeParse(mail).success ? mail.toLowerCase() : null,
    eligible:
      Boolean(text(entry, "userAccountControl")) &&
      Boolean(text(entry, "msDS-User-Account-Control-Computed")) &&
      Number.isInteger(flags) &&
      Number.isInteger(computed) &&
      !(flags & 2) &&
      !(computed & (16 | 8388608)) &&
      Boolean(validExpiry) &&
      /^[1-9]\d*$/.test(text(entry, "pwdLastSet")),
  };
}

const attributes = [
  "objectGUID",
  "userPrincipalName",
  "sAMAccountName",
  "displayName",
  "mail",
  "userAccountControl",
  "msDS-User-Account-Control-Computed",
  "accountExpires",
  "pwdLastSet",
];

export class ActiveDirectory implements Directory {
  readonly id: string;
  readonly recheckSeconds: number;
  private active = 0;

  constructor(
    private readonly options: DirectoryOptions,
    private readonly createClient = () =>
      new Client({
        url: options.url,
        timeout: 5000,
        connectTimeout: 5000,
        tlsOptions: {
          ca: options.ca,
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
          servername: new URL(options.url).hostname,
        },
      }),
  ) {
    if (!options.bindPassword.trim() || !options.ca.trim())
      throw new Error("AD password and CA files must not be empty");
    this.id = options.id.toLowerCase();
    this.recheckSeconds = options.recheckSeconds;
  }

  async findByLogin(identifier: string) {
    let login = identifier.trim().toLowerCase();
    if (login.includes("\\")) {
      const [domain, name, extra] = login.split("\\");
      if (
        extra !== undefined ||
        domain !== this.options.netbios?.toLowerCase() ||
        !name
      )
        return null;
      login = name;
    }
    if (login.includes("@")) {
      if (!login.endsWith(`@${this.id}`)) return null;
      return this.search(`(userPrincipalName=${escapeLdapFilter(login)})`);
    }
    return this.search(`(sAMAccountName=${escapeLdapFilter(login)})`);
  }

  findByGuid(guid: string) {
    // Binary values must stay bytes: ldapts string filters re-encode high bytes as UTF-8.
    return this.search(
      new EqualityFilter({ attribute: "objectGUID", value: guidBuffer(guid) }),
    );
  }

  private async search(identityFilter: string | Filter) {
    return this.withClient(async (client) => {
      await client.bind(this.options.bindDN, this.options.bindPassword);
      const group = this.options.allowedGroupDN
        ? `(memberOf:1.2.840.113556.1.4.1941:=${escapeLdapFilter(this.options.allowedGroupDN)})`
        : "";
      const result = await client.search(this.options.baseDN, {
        scope: "sub",
        filter:
          typeof identityFilter === "string"
            ? `(&(objectCategory=person)(objectClass=user)${identityFilter}${group})`
            : new AndFilter({
                filters: [
                  FilterParser.parseString(
                    `(&(objectCategory=person)(objectClass=user)${group})`,
                  ),
                  identityFilter,
                ],
              }),
        attributes,
        explicitBufferAttributes: ["objectGUID"],
        sizeLimit: 2,
        timeLimit: 5,
      });
      if (result.searchReferences.length || result.searchEntries.length > 1)
        throw directoryUnavailable();
      return result.searchEntries[0]
        ? directoryIdentity(result.searchEntries[0])
        : null;
    });
  }

  async verifyPassword(identity: DirectoryIdentity, password: string) {
    if (!password || !identity.eligible) return false;
    return this.withClient(async (client) => {
      try {
        await client.bind(identity.dn, password);
        return true;
      } catch (error) {
        if (error instanceof InvalidCredentialsError) return false;
        throw error;
      }
    });
  }

  private async withClient<T>(
    operation: (client: Client) => Promise<T>,
  ): Promise<T> {
    if (this.active >= 10) throw directoryUnavailable();
    this.active += 1;
    let client: Client | undefined;
    try {
      client = this.createClient();
      return await operation(client);
    } catch {
      throw directoryUnavailable();
    } finally {
      await client?.unbind().catch(() => undefined);
      this.active -= 1;
    }
  }
}
