import type { TeamMemberId } from "@/lib/team/teamRegistry";

export const PM_DECISION_ANALYST_ROUNDS = 2;

export interface MultiRoundAnalystCandidate {
  memberId: TeamMemberId;
  prompt: string;
}

export interface MultiRoundAnalystOutput {
  memberId: TeamMemberId;
  round: number;
  direction: "long" | "short" | "neutral";
  confidence: number;
  rationale: string;
  citations: string[];
  observedAt: string;
}

export interface RunMultiRoundAnalystDebateInput {
  candidates: MultiRoundAnalystCandidate[];
  generateRound: (
    memberId: TeamMemberId,
    prompt: string,
    round: number,
  ) => Promise<{
    memberId: TeamMemberId;
    direction: "long" | "short" | "neutral";
    confidence: number;
    rationale: string;
    citations: string[];
  }>;
  now?: () => number;
}

function formatRoundTranscript(outputs: readonly MultiRoundAnalystOutput[]) {
  return outputs
    .map(
      (output) =>
        `- ${output.memberId}: ${output.direction} ${output.confidence} ${output.rationale}`,
    )
    .join("\n");
}

export function buildAnalystRoundPrompt({
  basePrompt,
  round,
  previousRoundOutputs,
}: {
  basePrompt: string;
  round: number;
  previousRoundOutputs: readonly MultiRoundAnalystOutput[];
}) {
  if (round <= 1) {
    return `${basePrompt}

## Debate round
Round 1: produce your independent view without trying to average other roles.`;
  }

  return `${basePrompt}

## Debate round
Round ${round}: refine your view based on the previous round. Keep your own mandate, call out what changed, and do not invent evidence.

## Previous round outputs
${formatRoundTranscript(previousRoundOutputs) || "- none"}`;
}

export async function runMultiRoundAnalystDebate({
  candidates,
  generateRound,
  now = Date.now,
}: RunMultiRoundAnalystDebateInput): Promise<MultiRoundAnalystOutput[]> {
  const outputs: MultiRoundAnalystOutput[] = [];

  for (let round = 1; round <= PM_DECISION_ANALYST_ROUNDS; round += 1) {
    const previousRoundOutputs = outputs.filter((output) => output.round === round - 1);
    const roundOutputs = await Promise.all(
      candidates.map(async ({ memberId, prompt }) => {
        const output = await generateRound(
          memberId,
          buildAnalystRoundPrompt({
            basePrompt: prompt,
            round,
            previousRoundOutputs,
          }),
          round,
        );
        return {
          ...output,
          round,
          observedAt: new Date(now()).toISOString(),
        };
      }),
    );
    outputs.push(...roundOutputs);
  }

  return outputs;
}

export function latestAnalystRoundByMember(
  outputs: readonly MultiRoundAnalystOutput[],
): MultiRoundAnalystOutput[] {
  const latest = new Map<TeamMemberId, MultiRoundAnalystOutput>();
  for (const output of outputs) {
    const current = latest.get(output.memberId);
    if (!current || output.round > current.round) latest.set(output.memberId, output);
  }
  return Array.from(latest.values());
}
