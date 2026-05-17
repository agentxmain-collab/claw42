import { handleCallback, type MessageMetadata } from "@vercel/queue";
import {
  PM_DECISION_QUEUE_VISIBILITY_TIMEOUT_SECONDS,
  processPmDecisionQueueMessage,
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
    retry: (_error: unknown, metadata: MessageMetadata) => {
      if (metadata.deliveryCount >= 5) return { acknowledge: true };
      return { afterSeconds: Math.min(15 * 60, 2 ** metadata.deliveryCount * 30) };
    },
  },
);

export function POST(request: Request) {
  return queueHandler(request);
}
