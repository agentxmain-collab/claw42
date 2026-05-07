import { debatePacingForSeverity } from "@/lib/debatePacing";
import { rememberChatThread } from "@/lib/chatHistoryStore";
import { intensityScoreFromMessages, runChatThread } from "@/lib/chatOrchestrator";
import { classifyNewsTrigger } from "@/lib/newsTriggers";
import { getOrCreateSharedChatThread } from "@/lib/sharedThreadStore";
import type { NewsDebate, NewsItem } from "@/lib/types";

const debateStore = new Map<string, NewsDebate>();

async function buildNewsDebate(
  news: NewsItem,
  trigger: ReturnType<typeof classifyNewsTrigger>,
  now: number,
): Promise<NewsDebate> {
  const pacing = debatePacingForSeverity(trigger.severity);
  const { thread: chatThread } = await getOrCreateSharedChatThread({
    news,
    now,
    createThread: runChatThread,
  });
  await rememberChatThread(chatThread).catch((error) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[claw42] chat history persist skipped", error);
    }
  });

  const debate: NewsDebate = {
    id: `debate:${news.id}`,
    ts: now,
    newsId: news.id,
    newsTitle: news.title,
    newsUrl: news.url,
    newsSource: news.source,
    newsSentiment: news.sentiment,
    newsCurrencies: news.currencies,
    chatThread,
    messages: chatThread.messages,
    rounds: [],
    finalStrategy: chatThread.strategy,
    intensityScore: intensityScoreFromMessages(chatThread.messages),
    status: "completed",
    createdAt: now,
    completedAt: chatThread.completedAt ?? Date.now(),
    layers: {
      source: news,
      trigger,
      pacing,
      chatThread,
      messages: chatThread.messages,
      rounds: [],
      strategy: chatThread.strategy,
      replay: null,
    },
  };
  debateStore.set(debate.id, debate);
  return debate;
}

export async function tryOrchestrateNewsDebate(
  news: NewsItem,
  now = Date.now(),
): Promise<NewsDebate | null> {
  const trigger = classifyNewsTrigger(news, now);
  if (!trigger.shouldAutoDebate) return null;
  return buildNewsDebate(news, trigger, now);
}

export async function orchestrateNewsDebate(news: NewsItem, now = Date.now()): Promise<NewsDebate> {
  const trigger = classifyNewsTrigger(news, now);
  return buildNewsDebate(news, trigger, now);
}

export function listNewsDebates(limit = 20): NewsDebate[] {
  return Array.from(debateStore.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function getNewsDebate(id: string): NewsDebate | null {
  return debateStore.get(id) ?? null;
}
