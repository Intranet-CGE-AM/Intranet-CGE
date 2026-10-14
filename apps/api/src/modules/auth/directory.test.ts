import {
  AndFilter,
  BerWriter,
  Client,
  EqualityFilter,
  InvalidCredentialsError,
  type Entry,
} from "ldapts";
import { describe, expect, it, vi } from "vitest";
import {
  ActiveDirectory,
  directoryIdentity,
  escapeLdapFilter,
  guidBuffer,
  guidFromBuffer,
  type DirectoryOptions,
} from "./directory.js";

const guid = "00112233-4455-4677-8899-aabbccddeeff";
const entry: Entry = {
  dn: "CN=Test,OU=CGE,DC=cge,DC=lan",
  objectGUID: Buffer.from("33221100554477468899aabbccddeeff", "hex"),
  userPrincipalName: "Test@cge.lan",
  sAMAccountName: "TEST",
  displayName: "Test User",
  userAccountControl: "512",
  "msDS-User-Account-Control-Computed": "0",
  accountExpires: "0",
  pwdLastSet: "133000000000000000",
};
const options: DirectoryOptions = {
  id: "cge.lan",
  url: "ldaps://dc.cge.lan:636",
  baseDN: "OU=CGE,DC=cge,DC=lan",
  bindDN: "reader@cge.lan",
  bindPassword: "service-secret",
  ca: "test-ca",
  netbios: "SRV-CGEAD2",
  recheckSeconds: 300,
};
function setup(overrides: Partial<DirectoryOptions> = {}) {
  const client = {
    bind: vi.fn().mockResolvedValue(undefined),
    unbind: vi.fn().mockResolvedValue(undefined),
    search: vi
      .fn()
      .mockResolvedValue({ searchEntries: [entry], searchReferences: [] }),
  };
  const factory = vi.fn(() => client as unknown as Client);
  return {
    client,
    factory,
    directory: new ActiveDirectory({ ...options, ...overrides }, factory),
  };
}

describe("Active Directory adapter", () => {
  it("round trips the Windows GUID byte order and escapes LDAP metacharacters", () => {
    expect(guidFromBuffer(entry.objectGUID as Buffer)).toBe(guid);
    expect(guidBuffer(guid)).toEqual(entry.objectGUID);
    expect(escapeLdapFilter("a*)(x=\\\0")).toBe("a\\2a\\29\\28x=\\5c\\00");
    expect(() => guidBuffer("*)(x=*)")).toThrow();
  });
  it("accepts missing email without fabricating one", () => {
    expect(directoryIdentity(entry)).toMatchObject({
      guid,
      upn: "test@cge.lan",
      samAccountName: "test",
      email: null,
      eligible: true,
    });
  });
  it.each<Record<string, string>>([
    { userAccountControl: "514" },
    { "msDS-User-Account-Control-Computed": "16" },
    { "msDS-User-Account-Control-Computed": "8388608" },
    { pwdLastSet: "0" },
    { accountExpires: "1" },
    { accountExpires: "unknown" },
    { userAccountControl: "" },
    { "msDS-User-Account-Control-Computed": "" },
  ])(
    "rejects disabled, locked, expired and incomplete account state: %j",
    (change) => {
      expect(directoryIdentity({ ...entry, ...change }).eligible).toBe(false);
    },
  );
  it("scopes lookups, supports the confirmed NetBIOS prefix and nested groups", async () => {
    const { directory, client } = setup({
      allowedGroupDN: "CN=Allowed,DC=cge,DC=lan",
    });
    await directory.findByLogin("SRV-CGEAD2\\TEST");
    expect(client.search).toHaveBeenCalledWith(
      options.baseDN,
      expect.objectContaining({
        filter:
          "(&(objectCategory=person)(objectClass=user)(sAMAccountName=test)(memberOf:1.2.840.113556.1.4.1941:=CN=Allowed,DC=cge,DC=lan))",
        sizeLimit: 2,
        explicitBufferAttributes: ["objectGUID"],
      }),
    );
    await expect(directory.findByLogin("OTHER\\test")).resolves.toBeNull();
    await expect(directory.findByLogin("test@other.lan")).resolves.toBeNull();
    expect(client.search).toHaveBeenCalledTimes(1);
  });
  it("preserves GUID bytes above 0x7f in the LDAP wire filter", async () => {
    const { directory, client } = setup();
    await directory.findByGuid(guid);
    const filter = client.search.mock.calls[0]![1].filter as AndFilter;
    expect(filter).toBeInstanceOf(AndFilter);
    expect((filter.filters[1] as EqualityFilter).value).toEqual(
      entry.objectGUID,
    );
    const writer = new BerWriter();
    filter.write(writer);
    expect(writer.buffer.includes(entry.objectGUID as Buffer)).toBe(true);
  });
  it("rejects ambiguous results and referrals and closes the connection", async () => {
    const { directory, client } = setup();
    client.search.mockResolvedValueOnce({
      searchEntries: [entry, entry],
      searchReferences: [],
    });
    await expect(directory.findByLogin("test")).rejects.toMatchObject({
      statusCode: 503,
    });
    client.search.mockResolvedValueOnce({
      searchEntries: [entry],
      searchReferences: ["ldap://other"],
    });
    await expect(directory.findByLogin("test")).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(client.unbind).toHaveBeenCalledTimes(2);
  });
  it("uses a separate bind, rejects empty passwords and never retries bad credentials", async () => {
    const { directory, client, factory } = setup();
    const identity = directoryIdentity(entry);
    expect(await directory.verifyPassword(identity, "")).toBe(false);
    expect(factory).not.toHaveBeenCalled();
    client.bind.mockRejectedValueOnce(new InvalidCredentialsError());
    expect(await directory.verifyPassword(identity, "wrong")).toBe(false);
    expect(client.bind).toHaveBeenCalledTimes(1);
    expect(client.unbind).toHaveBeenCalledTimes(1);
  });
  it("sanitizes connection and service-account failures", async () => {
    const { directory, client } = setup();
    client.bind.mockRejectedValueOnce(
      new Error("private diagnostic with service-secret"),
    );
    await expect(directory.findByGuid(guid)).rejects.toMatchObject({
      code: "DIRECTORY_UNAVAILABLE",
      message:
        "O acesso corporativo está indisponível. Tente novamente em instantes.",
    });
    expect(client.unbind).toHaveBeenCalled();
  });
});
