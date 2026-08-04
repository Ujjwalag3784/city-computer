import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";

const FALLBACK = "/admin";

describe("safeInternalPath", () => {
  it("keeps an ordinary internal path", () => {
    expect(safeInternalPath("/admin/orders", FALLBACK)).toBe("/admin/orders");
    expect(safeInternalPath("/admin/orders?status=paid&page=2", FALLBACK)).toBe(
      "/admin/orders?status=paid&page=2",
    );
    expect(safeInternalPath("/", FALLBACK)).toBe("/");
  });

  it("trims surrounding whitespace rather than rejecting it", () => {
    expect(safeInternalPath("  /admin/orders  ", FALLBACK)).toBe("/admin/orders");
  });

  it("falls back for a missing or empty value", () => {
    expect(safeInternalPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("   ", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects absolute URLs to another origin", () => {
    expect(safeInternalPath("https://evil.example/harvest", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("HTTP://evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("http://localhost:3000/admin", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects protocol-relative URLs, the classic startsWith('/') bypass", () => {
    expect(safeInternalPath("//evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("//evil.example/admin", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects the backslash variants browsers normalise to protocol-relative", () => {
    expect(safeInternalPath("/\\evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("\\\\evil.example", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects non-path schemes", () => {
    expect(safeInternalPath("javascript:alert(1)", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("mailto:someone@example.com", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("data:text/html,<script>", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects an interior control character or space used to smuggle a scheme", () => {
    expect(safeInternalPath("/admin\nSet-Cookie: x=1", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("/ /evil.example", FALLBACK)).toBe(FALLBACK);
    expect(safeInternalPath("java\tscript:alert(1)", FALLBACK)).toBe(FALLBACK);
  });

  it("returns whatever fallback the caller asked for", () => {
    expect(safeInternalPath("https://evil.example", "/somewhere-else")).toBe("/somewhere-else");
  });
});
