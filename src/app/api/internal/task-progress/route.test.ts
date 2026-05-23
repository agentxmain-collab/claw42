import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const sendTaskProgressWebhookMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/coinw/taskProgressWebhookClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/coinw/taskProgressWebhookClient")>();
  return {
    ...actual,
    sendTaskProgressWebhook: sendTaskProgressWebhookMock,
  };
});

function request(uidHash: string, taskId = "task-1", landingId = crypto.randomUUID()) {
  return new NextRequest("https://claw42.ai/api/internal/task-progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      uid_hash: uidHash,
      task_id: taskId,
      landing_id: landingId,
      event: "claw42_dwell_60s_reached",
      dwell_ms: 60_000,
      ts: "2026-05-21T12:00:00.000Z",
    }),
  });
}

describe("/api/internal/task-progress", () => {
  beforeEach(() => {
    sendTaskProgressWebhookMock.mockReset();
    sendTaskProgressWebhookMock.mockResolvedValue(undefined);
  });

  it("sends the first task progress webhook", async () => {
    const response = await POST(request(`uid_${crypto.randomUUID()}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("sent");
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(sendTaskProgressWebhookMock).toHaveBeenCalledTimes(1);
  });

  it("claims exactly once across reloads and multiple landing ids", async () => {
    const uidHash = `uid_${crypto.randomUUID()}`;
    const first = await POST(request(uidHash, "task-1", "landing-1"));
    const second = await POST(request(uidHash, "task-1", "landing-2"));
    const body = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(body).toMatchObject({
      status: "already_claimed",
      existingState: "sent",
    });
    expect(sendTaskProgressWebhookMock).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent claim", async () => {
    const uidHash = `uid_${crypto.randomUUID()}`;
    const [first, second] = await Promise.all([
      POST(request(uidHash, "task-2", "landing-1")),
      POST(request(uidHash, "task-2", "landing-2")),
    ]);
    const bodies = await Promise.all([first.json(), second.json()]);

    expect(bodies.filter((body) => body.status === "sent")).toHaveLength(1);
    expect(bodies.filter((body) => body.status === "already_claimed")).toHaveLength(1);
    expect(sendTaskProgressWebhookMock).toHaveBeenCalledTimes(1);
  });
});
