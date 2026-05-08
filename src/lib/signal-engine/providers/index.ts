import { stubStructuringProvider } from "@/lib/signal-engine/providers/stub";
import type { StructuringProvider } from "@/lib/signal-engine/providers/types";

type EnvLike = Record<string, string | undefined>;

export function getStructuringProvider(env: EnvLike = process.env): StructuringProvider {
  if (env.SIGNAL_PROVIDER?.trim() === "llm") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LLM providers pending T2");
    }
    console.warn(
      "SIGNAL_PROVIDER=llm is pending T2; falling back to stub provider in non-production.",
    );
  }
  return stubStructuringProvider;
}

export { stubStructuringProvider };
export type {
  StructuredFields,
  StructuringProvider,
  StructuringProviderInput,
} from "@/lib/signal-engine/providers/types";
