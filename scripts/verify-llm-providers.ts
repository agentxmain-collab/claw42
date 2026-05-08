import { callWithChain } from "@/lib/llm/providers";
import { __llmBudgetTestUtils, getMonthlyUsage, trackUsage } from "@/lib/llm/budget-tracker";
import { stubProvider } from "@/lib/llm/providers/stub";

async function main() {
  process.env.LLM_PRIMARY_PROVIDER = "stub";
  process.env.LLM_ENABLE_STUB = "1";

  __llmBudgetTestUtils.clearMemoryUsage();

  const output = await callWithChain({
    prompt: "Verify provider chain without external API keys.",
    taskTag: "verify:llm-providers",
    maxTokens: 64,
  });

  if (output.provider !== "stub") {
    throw new Error(`Expected stub provider in local verify, got ${output.provider}`);
  }

  await trackUsage(
    {
      ...stubProvider,
      estimateCost() {
        return { inputUsd: 0.01, outputUsd: 0.02 };
      },
    },
    { prompt: "budget", taskTag: "verify:budget" },
    output,
  );

  const usage = await getMonthlyUsage();
  if (usage.usd <= 0) {
    throw new Error("Budget tracker did not record usage");
  }

  console.log(
    `LLM provider verify passed: provider=${output.provider}, budgetUsd=${usage.usd.toFixed(3)}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
