import { describe, expect, it } from "vitest";
import {
  CREATE_ADMIN_USAGE,
  CreateAdminArgsError,
  DEFAULT_ADMIN_ROLE_KEY,
  parseCreateAdminArgs,
  resolveAdminRoleKey,
} from "./admin-bootstrap";
import { ADMIN_ROLE_KEYS, requiresTwoFactor } from "./admin-roles";

describe("parseCreateAdminArgs", () => {
  it("accepts the --flag=value form", () => {
    expect(
      parseCreateAdminArgs([
        "--email=Dad@CityComputer.com.np",
        "--password=a-long-enough-one",
        "--name=Shop Owner",
        "--role=MANAGER",
      ]),
    ).toEqual({
      email: "dad@citycomputer.com.np",
      password: "a-long-enough-one",
      name: "Shop Owner",
      roleKey: "MANAGER",
    });
  });

  it("accepts the --flag value form", () => {
    expect(
      parseCreateAdminArgs(["--email", "a@b.com", "--password", "a-long-enough-one"]),
    ).toMatchObject({ email: "a@b.com", password: "a-long-enough-one" });
  });

  it("lowercases and trims the email so re-running with different casing updates the same row", () => {
    const first = parseCreateAdminArgs(["--email=  A@B.COM ", "--password=a-long-enough-one"]);
    const second = parseCreateAdminArgs(["--email=a@b.com", "--password=a-long-enough-one"]);
    expect(first.email).toBe(second.email);
  });

  it("defaults name to Owner and role to the documented default", () => {
    const args = parseCreateAdminArgs(["--email=a@b.com", "--password=a-long-enough-one"]);
    expect(args.name).toBe("Owner");
    expect(args.roleKey).toBe(DEFAULT_ADMIN_ROLE_KEY);
  });

  it("does not trim the password — surrounding spaces are part of it", () => {
    const args = parseCreateAdminArgs(["--email=a@b.com", "--password= padded-password "]);
    expect(args.password).toBe(" padded-password ");
  });

  it("requires --email", () => {
    expect(() => parseCreateAdminArgs(["--password=a-long-enough-one"])).toThrow(
      CreateAdminArgsError,
    );
    expect(() => parseCreateAdminArgs(["--email=   ", "--password=a-long-enough-one"])).toThrow(
      /--email is required/,
    );
  });

  it("requires --password, and treats an empty one as missing", () => {
    expect(() => parseCreateAdminArgs(["--email=a@b.com"])).toThrow(/--password is required/);
    expect(() => parseCreateAdminArgs(["--email=a@b.com", "--password="])).toThrow(
      /--password is required/,
    );
  });

  it("rejects a malformed email rather than creating an unusable login", () => {
    expect(() => parseCreateAdminArgs(["--email=not-an-email", "--password=a-long-enough-one"])).toThrow(
      /not a valid email address/,
    );
  });

  it("rejects an unknown flag instead of silently ignoring a typo", () => {
    expect(() => parseCreateAdminArgs(["--emai=a@b.com", "--password=a-long-enough-one"])).toThrow(
      /Unknown flag --emai/,
    );
  });

  it("rejects a bare positional argument", () => {
    expect(() => parseCreateAdminArgs(["a@b.com"])).toThrow(/every value needs a --flag/);
  });

  it("rejects a flag whose value was swallowed by the next flag", () => {
    expect(() => parseCreateAdminArgs(["--email", "--password=a-long-enough-one"])).toThrow(
      /--email needs a value/,
    );
  });

  it("never leaks the password into an error message", () => {
    try {
      parseCreateAdminArgs(["--email=nope", "--password=super-secret-value"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("super-secret-value");
    }
  });
});

describe("resolveAdminRoleKey", () => {
  it("defaults to OWNER when omitted or blank", () => {
    expect(resolveAdminRoleKey(undefined)).toBe("OWNER");
    expect(resolveAdminRoleKey("")).toBe("OWNER");
    expect(DEFAULT_ADMIN_ROLE_KEY).toBe("OWNER");
  });

  it("accepts every seeded admin role key", () => {
    for (const key of ADMIN_ROLE_KEYS) {
      expect(resolveAdminRoleKey(key)).toBe(key);
    }
  });

  it("normalises case and hyphens", () => {
    expect(resolveAdminRoleKey("owner")).toBe("OWNER");
    expect(resolveAdminRoleKey("content-editor")).toBe("CONTENT_EDITOR");
    expect(resolveAdminRoleKey(" Content_Editor ")).toBe("CONTENT_EDITOR");
  });

  it("rejects CUSTOMER with a role-specific explanation, not a generic 'unknown role'", () => {
    expect(() => resolveAdminRoleKey("customer")).toThrow(/storefront role with no admin access/);
  });

  it("rejects an unrecognised role and lists the valid ones", () => {
    expect(() => resolveAdminRoleKey("SUPERUSER")).toThrow(/is not a staff role/);
    expect(() => resolveAdminRoleKey("SUPERUSER")).toThrow(/OWNER/);
  });
});

describe("CREATE_ADMIN_USAGE", () => {
  it("names every role the script will actually accept, so the help text can't drift from the catalogue", () => {
    for (const key of ADMIN_ROLE_KEYS) {
      expect(CREATE_ADMIN_USAGE).toContain(key);
    }
  });

  it("tells the operator to seed first, since the roles this attaches to come from pnpm db:seed", () => {
    expect(CREATE_ADMIN_USAGE).toContain("db:seed");
  });
});

describe("the default role's 2FA consequence", () => {
  it("is 2FA-mandatory, which is why DEPLOY_VERCEL.md has to cover TOTP enrollment", () => {
    // Guards the Blocker-1 decision recorded in DEPLOY_VERCEL.md: defaulting
    // to OWNER buys a complete admin console but *requires* a working
    // authenticator-app enrollment step (and a reachable Redis) before
    // /admin will render. If someone later changes the default to a
    // non-mandatory role, this test failing is the prompt to update that doc.
    expect(requiresTwoFactor([DEFAULT_ADMIN_ROLE_KEY])).toBe(true);
  });

  it("STAFF is the documented 2FA-free escape hatch", () => {
    expect(requiresTwoFactor(["STAFF"])).toBe(false);
  });
});
