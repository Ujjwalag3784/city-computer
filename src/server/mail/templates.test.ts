import { describe, expect, it } from "vitest";
import { passwordResetEmail, verifyEmailEmail } from "./templates";

describe("auth email templates", () => {
  const url = "https://shop.example/auth/reset-password?token=abc123";

  it.each([
    ["password reset", passwordResetEmail],
    ["email verification", verifyEmailEmail],
  ])("%s carries the link in both text and HTML", (_name, build) => {
    const email = build(url);
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.text).toContain(url);
    expect(email.html).toContain(`href="${url}"`);
  });

  it("escapes the URL in HTML so it cannot break out of the attribute", () => {
    const hostile = `https://shop.example/x?token="><script>alert(1)</script>`;
    const email = passwordResetEmail(hostile);
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("mentions the 60-minute expiry the token actually has", () => {
    expect(passwordResetEmail(url).text).toMatch(/60 minutes/);
    expect(verifyEmailEmail(url).text).toMatch(/60 minutes/);
  });
});
