import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock: Record<string, string | undefined> = {};
vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const content = { subject: "Hello", text: "secret-link", html: "<p>secret-link</p>" };

async function loadSend() {
  const mod = await import("./send");
  return mod.sendTransactionalEmail;
}

describe("sendTransactionalEmail", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    for (const key of Object.keys(envMock)) Reflect.deleteProperty(envMock, key);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing and reports not sent when Resend is not configured", async () => {
    const send = await loadSend();
    await expect(send("a@b.com", content)).resolves.toEqual({ sent: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Resend with the configured sender", async () => {
    envMock.RESEND_API_KEY = "re_test";
    envMock.MAIL_FROM_TRANSACTIONAL = "orders@shop.example";
    envMock.MAIL_REPLY_TO = "help@shop.example";
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const send = await loadSend();
    await expect(send("a@b.com", content)).resolves.toEqual({ sent: true });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: "orders@shop.example",
      to: ["a@b.com"],
      subject: "Hello",
      reply_to: "help@shop.example",
    });
  });

  it("reports not sent instead of throwing when Resend rejects", async () => {
    envMock.RESEND_API_KEY = "re_test";
    envMock.MAIL_FROM = "orders@shop.example";
    fetchMock.mockResolvedValue(new Response("domain not verified", { status: 403 }));

    const send = await loadSend();
    await expect(send("a@b.com", content)).resolves.toEqual({ sent: false });
  });

  it("reports not sent instead of throwing when the network fails", async () => {
    envMock.RESEND_API_KEY = "re_test";
    envMock.MAIL_FROM = "orders@shop.example";
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));

    const send = await loadSend();
    await expect(send("a@b.com", content)).resolves.toEqual({ sent: false });
  });
});
