import { describe, expect, it } from "vitest";
import { ensureDeletedAtSelected } from "./soft-delete-extension";

describe("ensureDeletedAtSelected", () => {
  it("adds deletedAt to a narrow select and marks it for stripping", () => {
    const { args, strip } = ensureDeletedAtSelected({
      where: { id: "c1" },
      select: { id: true, path: true },
    });
    expect(args.select).toEqual({ id: true, path: true, deletedAt: true });
    expect(strip).toBe(true);
  });

  it("leaves a select that already includes deletedAt alone", () => {
    const input = { where: { id: "c1" }, select: { id: true, deletedAt: true } };
    const { args, strip } = ensureDeletedAtSelected(input);
    expect(args).toBe(input);
    expect(strip).toBe(false);
  });

  it("un-omits deletedAt and marks it for stripping", () => {
    const { args, strip } = ensureDeletedAtSelected({
      where: { id: "c1" },
      omit: { deletedAt: true, metaTitle: true },
    });
    expect(args.omit).toEqual({ metaTitle: true });
    expect(strip).toBe(true);
  });

  it("does nothing for a full-row query", () => {
    const input = { where: { id: "c1" } };
    const { args, strip } = ensureDeletedAtSelected(input);
    expect(args).toBe(input);
    expect(strip).toBe(false);
  });
});
