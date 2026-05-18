import { handleCallback, type MessageMetadata } from "@vercel/queue";
import {
  PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  processPmDecisionQueueMessage,
  resolvePmDecisionQueueRetry,
  type PmDecisionQueueMessage,
} from "@/lib/team/pmDecisionJobQueue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const queueHandler = handleCallback<PmDecisionQueueMessage>(
  async (message) => {
    await processPmDecisionQueueMessage(message);
  },
  {
    visibilityTimeoutSeconds: PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
    retry: (error: unknown, metadata: MessageMetadata) =>
      resolvePmDecisionQueueRetry(error, metadata),
  },
);

export function POST(request: Request) {
  return queueHandler(request);
}
