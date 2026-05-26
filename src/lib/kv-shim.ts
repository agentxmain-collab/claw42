import { Redis } from "@upstash/redis";

process.env.UPSTASH_DISABLE_TELEMETRY = "1";

type RedisClient = Redis;

let client: RedisClient | null = null;

function readConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    process.env.KV_REST_API_URL = url;
    process.env.KV_REST_API_TOKEN = token;
  }
  return { url, token };
}

readConfig();

export function createClient(config?: { url?: string; token?: string }) {
  const { url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN } =
    config ?? {};

  if (!url || !token) {
    throw new Error(
      "kv-shim: Missing required environment variables UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    );
  }

  return new Redis({
    url,
    token,
    cache: "no-store",
    enableAutoPipelining: true,
  });
}

export const kv = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === "then" || prop === "parse") {
        return Reflect.get(target, prop);
      }

      if (!client) {
        readConfig();
        client = createClient();
      }

      return Reflect.get(client, prop);
    },
  },
) as RedisClient;
