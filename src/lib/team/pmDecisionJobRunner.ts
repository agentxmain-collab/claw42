import {
  type PmDecisionTriggerAuditEvent,
  triggerPmDecisionPipelineBatch,
  triggerPmDecisionPipelineOnce,
} from "@/lib/team/pmDecisionTrigger";
import type { PmDecisionPipelineOutput } from "@/lib/team/pmDecisionPipeline";
import {
  markPmDecisionJobFailed,
  markPmDecisionJobRunning,
  markPmDecisionJobSucceeded,
  type PmDecisionJobRecord,
} from "@/lib/watch/pmDecisionJobLedger";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";

export interface RunPmDecisionJobContext {
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  now?: number;
  partialStageUpdates?: boolean;
  onAudit?: (event: PmDecisionTriggerAuditEvent) => void;
}

export interface RunPmDecisionJobResult {
  job: PmDecisionJobRecord;
  outputs: PmDecisionPipelineOutput[];
  auditEvents: PmDecisionTriggerAuditEvent[];
}

export async function runPmDecisionJob(
  job: PmDecisionJobRecord,
  {
    pool,
    newsItems = [],
    now = Date.now(),
    partialStageUpdates = true,
    onAudit,
  }: RunPmDecisionJobContext = {},
): Promise<RunPmDecisionJobResult> {
  const runningJob = (await markPmDecisionJobRunning(job.id, { now })) ?? job;
  const auditEvents: PmDecisionTriggerAuditEvent[] = [];
  const collectAudit = (event: PmDecisionTriggerAuditEvent) => {
    auditEvents.push(event);
    onAudit?.(event);
  };

  try {
    const outputs =
      runningJob.kind === "batch"
        ? await triggerPmDecisionPipelineBatch({
            triggerSource: runningJob.triggerSource,
            pool,
            newsItems,
            locale: runningJob.locale,
            now,
            partialStageUpdates,
            onAudit: collectAudit,
          })
        : [
            await triggerPmDecisionPipelineOnce({
              triggerSource: runningJob.triggerSource,
              pool,
              newsItems,
              locale: runningJob.locale,
              ...(runningJob.candidate
                ? { candidate: runningJob.candidate }
                : runningJob.symbol
                  ? { symbol: runningJob.symbol }
                  : {}),
              now,
              partialStageUpdates,
              onAudit: collectAudit,
            }),
          ].filter((output): output is PmDecisionPipelineOutput => Boolean(output));

    const completedJob =
      (await markPmDecisionJobSucceeded(runningJob.id, {
        now,
        outputCount: outputs.length,
        decisionRecordIds: outputs.map((output) => output.record.id).filter(Boolean),
        auditEventCount: auditEvents.length,
      })) ?? runningJob;
    return { job: completedJob, outputs, auditEvents };
  } catch (error) {
    await markPmDecisionJobFailed(runningJob.id, { now, error });
    throw error;
  }
}
