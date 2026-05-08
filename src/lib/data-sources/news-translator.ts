import type { NewsTranslationInput, NewsTranslationResult, NewsTranslator } from "@/lib/data-sources/news-provider";

type EnvLike = Record<string, string | undefined>;

export type LlmNewsTranslatorConfig = {
  provider: string;
  model: string;
};

export function getNewsTranslatorFromEnv(env: EnvLike = process.env): NewsTranslator | undefined {
  void env;
  // TODO: T2 LLM provider unification will replace this stub.
  // Until then, RSS items use deterministic English-source fallback translation.
  return undefined;
}

export function createLlmNewsTranslator(config: LlmNewsTranslatorConfig): NewsTranslator {
  void config;
  return async (input: NewsTranslationInput): Promise<NewsTranslationResult> => {
    void input;
    throw new Error("LLM news translator pending T2 provider unification");
  };
}
