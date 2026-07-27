import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins plain class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("resolves conflicting Tailwind utilities in favour of the later one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("applies conditional classes via object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});
