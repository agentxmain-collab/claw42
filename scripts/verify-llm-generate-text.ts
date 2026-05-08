import { generateText } from "@/lib/llm/generateText";
import { hasMechanicalOutput } from "@/lib/llm/guardrails";
import { __llmBudgetTestUtils } from "@/lib/llm/budget-tracker";
import { __llmCacheTestUtils } from "@/lib/llm/cache";

async function main() {
  process.env.LLM_PRIMARY_PROVIDER = "stub";
  process.env.LLM_ENABLE_STUB = "1";

  __llmBudgetTestUtils.clearMemoryUsage();
  __llmCacheTestUtils.clearMemoryCache();

  const first = await generateText("Generate a concise test line.", {
    taskTag: "verify:llm-generate-text",
  });
  const second = await generateText("Generate a concise test line.", {
    taskTag: "verify:llm-generate-text",
  });

  if (!first.startsWith("[STUB:verify:llm-generate-text:")) {
    throw new Error(`Unexpected generateText output: ${first}`);
  }
  if (first !== second) {
    throw new Error("generateText cache did not return deterministic repeat output");
  }
  if (!hasMechanicalOutput("首先，作为 Alpha 派：测试。")) {
    throw new Error("Guardrail detector failed");
  }

  console.log("LLM generateText verify passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
