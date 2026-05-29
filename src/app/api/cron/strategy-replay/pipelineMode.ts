export type PipelineMode = "simple" | "full";

export function resolvePipelineMode(
  env: Record<string, string | undefined> = process.env,
): PipelineMode {
  return env.PIPELINE_MODE === "full" ? "full" : "simple";
}
