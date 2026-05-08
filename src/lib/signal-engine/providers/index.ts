import { stubStructuringProvider } from "@/lib/signal-engine/providers/stub";
import { llmStructuringProvider } from "@/lib/signal-engine/providers/llm";
import type { StructuringProvider } from "@/lib/signal-engine/providers/types";

type EnvLike = Record<string, string | undefined>;

export function getStructuringProvider(env: EnvLike = process.env): StructuringProvider {
  if (env.SIGNAL_PROVIDER?.trim() === "llm") {
    return llmStructuringProvider;
  }
  return stubStructuringProvider;
}

export { stubStructuringProvider };
export type {
  StructuredFields,
  StructuringProvider,
  StructuringProviderInput,
} from "@/lib/signal-engine/providers/types";
