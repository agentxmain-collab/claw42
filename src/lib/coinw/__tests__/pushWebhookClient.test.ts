import { afterEach, describe, expect, it, vi } from "vitest";
import { WEBHOOK_REQUEST_ID_HEADER } from "../externalEntryConstants";
import { sendPushWebhook, type PushWebhookPayload } from "../pushWebhookClient";

const payload: PushWebhookPayload = {
  uid_hash: "uid_hash_1",
  symbol: "BTC",
  pair: "BTC_USDT",
  signal_type: "stage_change",
  severity: "medium",
  title: "title",
  body: "body",
  deep_link: "https://claw42.ai/zh_CN",
  expires_at: "2026-05-22T00:00:00.000Z",
};

describe("push webhook client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends bearer auth and X-Request-Id", async () => {
    vi.stubEnv("COINW_PUSH_WEBHOOK_URL", "https://coinw.example/push");
    vi.stubEnv("COINW_PUSH_WEBHOOK_TOKEN", "token-1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      sendPushWebhook(
        { ...payload, uid_hash: `uid_${crypto.randomUUID()}` },
        { fetchImpl: fetchMock, requestId: "request-1" },
      ),
    ).resolves.toMatchObject({ status: "sent", requestId: "request-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://coinw.example/push",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          [WEBHOOK_REQUEST_ID_HEADER]: "request-1",
        }),
      }),
    );
  });

  it("caps the same user symbol signal inside the 24h window", async () => {
    vi.stubEnv("COINW_PUSH_WEBHOOK_URL", "https://coinw.example/push");
    vi.stubEnv("COINW_PUSH_WEBHOOK_TOKEN", "token-1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const scopedPayload = { ...payload, uid_hash: `uid_${crypto.randomUUID()}` };

    await sendPushWebhook(scopedPayload, { fetchImpl: fetchMock, requestId: "request-1" });
    const second = await sendPushWebhook(scopedPayload, {
      fetchImpl: fetchMock,
      requestId: "request-2",
    });

    expect(second).toMatchObject({ status: "frequency_capped", requestId: "request-2" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
