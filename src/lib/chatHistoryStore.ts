import fs from "node:fs/promises";
import path from "node:path";
import type { ChatThread } from "@/lib/types";

const CACHE_DIR = path.join(process.env.CLAW42_CACHE_DIR || process.cwd(), ".cache");
const CACHE_PATH = path.join(CACHE_DIR, "chat-threads.json");
const MAX_THREADS = 24;

interface ChatHistoryFile {
  updatedAt: number;
  threads: ChatThread[];
}

async function readHistory(): Promise<ChatHistoryFile> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<ChatHistoryFile>;
    return {
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
    };
  } catch {
    return { updatedAt: Date.now(), threads: [] };
  }
}

async function writeHistory(history: ChatHistoryFile) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(history, null, 2));
}

export async function rememberChatThread(thread: ChatThread) {
  const history = await readHistory();
  const threads = [thread, ...history.threads.filter((item) => item.id !== thread.id)]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_THREADS);
  await writeHistory({ updatedAt: Date.now(), threads });
}

export async function loadRecentChatHistory({
  limit = 3,
  messagesPerChat = 5,
}: {
  limit?: number;
  messagesPerChat?: number;
} = {}): Promise<ChatThread[]> {
  const history = await readHistory();
  return history.threads
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((thread) => ({
      ...thread,
      messages: thread.messages.slice(-messagesPerChat),
    }));
}
