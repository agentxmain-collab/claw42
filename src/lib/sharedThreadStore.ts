import type { ChatThread, NewsItem, TriggerReason } from "@/lib/types";

export const LIMITS = {
  MAX_ACTIVE_THREADS_PER_SYMBOL: 1,
  THREAD_COOLDOWN_PER_COIN_MS: 5 * 60 * 1000,
  MAX_MESSAGES_PER_THREAD: 20,
  MAX_LLM_CALLS_PER_THREAD: 25,
  MAX_RETRY_PER_THREAD: 5,
  MAX_CONCURRENT_SYMBOLS: 10,
  MAX_THREADS_PER_SYMBOL_PER_DAY: 50,
} as const;

type ThreadEvent =
  | { type: "snapshot"; thread: ChatThread | null; ts: number }
  | { type: "thread"; thread: ChatThread; ts: number }
  | { type: "heartbeat"; ts: number };

type KvClient = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
};

const USE_KV = process.env.USE_PERSISTENT_KV === "true";
const THREAD_TTL_SECONDS = 24 * 60 * 60;
const threads = new Map<string, ChatThread>();
const subscribers = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();
let kvClientPromise: Promise<KvClient | null> | null = null;

const encoder = new TextEncoder();

export function normalizeThreadSymbol(symbol: string): string {
  return symbol.replace(/^\$/, "").trim().toUpperCase() || "BTC";
}

export function threadKeyForSymbol(symbol: string): string {
  return `thread:${normalizeThreadSymbol(symbol)}`;
}

function symbolFromNews(news: NewsItem): string {
  return normalizeThreadSymbol(news.currencies[0] ?? "BTC");
}

async function getKvClient(): Promise<KvClient | null> {
  if (!USE_KV) return null;
  if (!kvClientPromise) {
    kvClientPromise = new Function("return import('@vercel/kv')")()
      .then((module: { kv?: KvClient }) => module.kv ?? null)
      .catch((error: unknown) => {
        console.warn("[claw42] Vercel KV unavailable, falling back to in-memory", error);
        return null;
      });
  }
  return kvClientPromise;
}

function encodeEvent(event: ThreadEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

function broadcast(symbol: string, event: ThreadEvent) {
  const key = normalizeThreadSymbol(symbol);
  const targets = subscribers.get(key);
  if (!targets?.size) return;
  const payload = encodeEvent(event);
  for (const controller of Array.from(targets)) {
    try {
      controller.enqueue(payload);
    } catch {
      targets.delete(controller);
    }
  }
}

export async function getSharedThread(symbol: string): Promise<ChatThread | null> {
  const normalized = normalizeThreadSymbol(symbol);
  const inMemory = threads.get(normalized);
  if (inMemory) return inMemory;

  const kv = await getKvClient();
  if (!kv) return null;
  try {
    const thread = await kv.get<ChatThread>(threadKeyForSymbol(normalized));
    if (thread) threads.set(normalized, thread);
    return thread ?? null;
  } catch (error) {
    console.warn("[claw42] KV read failed", error);
    return null;
  }
}

export async function saveSharedThread(thread: ChatThread): Promise<void> {
  const symbol = normalizeThreadSymbol(thread.symbol ?? thread.seed.symbols[0] ?? "BTC");
  const nextThread = { ...thread, symbol };
  threads.set(symbol, nextThread);
  broadcast(symbol, { type: "thread", thread: nextThread, ts: Date.now() });

  const kv = await getKvClient();
  if (!kv) return;
  kv.set(threadKeyForSymbol(symbol), nextThread, { ex: THREAD_TTL_SECONDS }).catch(
    (error: unknown) => {
      console.warn("[claw42] KV write failed", error);
    },
  );
}

export function shouldReuseSharedThread(thread: ChatThread | null, now = Date.now()): boolean {
  if (!thread) return false;
  if (thread.status === "active" || thread.status === "completing") return true;
  if (thread.cooldownUntil && now < thread.cooldownUntil) return true;
  return false;
}

export async function getOrCreateSharedChatThread({
  news,
  now = Date.now(),
  createThread,
}: {
  news: NewsItem;
  now?: number;
  createThread: (news: NewsItem, now: number) => Promise<ChatThread>;
}): Promise<{ thread: ChatThread; triggerReason: TriggerReason; reused: boolean }> {
  const symbol = symbolFromNews(news);
  const current = await getSharedThread(symbol);
  if (shouldReuseSharedThread(current, now)) {
    return {
      thread: current!,
      triggerReason: current!.completedAt ? "cooldown_expired" : "cold_start",
      reused: true,
    };
  }

  const thread = await createThread(news, now);
  const completedAt = thread.completedAt ?? now;
  const sharedThread: ChatThread = {
    ...thread,
    symbol,
    cooldownUntil: completedAt + LIMITS.THREAD_COOLDOWN_PER_COIN_MS,
    llmCallsUsed: Math.min(
      LIMITS.MAX_LLM_CALLS_PER_THREAD,
      thread.llmCallsUsed ?? thread.messages.length + (thread.strategy ? 1 : 0),
    ),
  };
  await saveSharedThread(sharedThread);
  return { thread: sharedThread, triggerReason: current ? "cooldown_expired" : "cold_start", reused: false };
}

export function subscribeSharedThread(symbol: string): ReadableStream<Uint8Array> {
  const normalized = normalizeThreadSymbol(symbol);
  let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      activeController = controller;
      const set = subscribers.get(normalized) ?? new Set();
      set.add(controller);
      subscribers.set(normalized, set);

      controller.enqueue(encodeEvent({ type: "heartbeat", ts: Date.now() }));
      const thread = await getSharedThread(normalized);
      controller.enqueue(encodeEvent({ type: "snapshot", thread, ts: Date.now() }));
    },
    cancel() {
      if (!activeController) return;
      const set = subscribers.get(normalized);
      set?.delete(activeController);
      if (set?.size === 0) subscribers.delete(normalized);
    },
  });
}
