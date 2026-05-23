import { afterEach, describe, expect, it, vi } from "vitest";
import { WEBHOOK_REQUEST_ID_HEADER } from "../externalEntryConstants";
import {
  sendTaskProgressWebhook,
  type TaskProgressWebhookPayload,
} from "../taskProgressWebhookClient";

const payload: TaskProgressWebhookPayload = {
  uid_hash: "uid_hash_1",
  task_id: "task-1",
  landing_id: "landing-1",
  event: "claw42_dwell_60s_reached",
  dwell_ms: 60_000,
  ts: "2026-05-21T12:00:00.000Z",
};

describe("task progress webhook client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends bearer auth and X-Request-Id", async () => {
    vi.stubEnv("COINW_TASK_PROGRESS_WEBHOOK_URL", "https://coinw.example/task");
    vi.stubEnv("COINW_TASK_PROGRESS_WEBHOOK_TOKEN", "token-1");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await sendTaskProgressWebhook(payload, "request-1", { fetchImpl: fetchMock });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://coinw.example/task",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          [WEBHOOK_REQUEST_ID_HEADER]: "request-1",
        }),
      }),
    );
  });
});
