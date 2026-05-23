import { CryptoPanicAdapter } from "@/lib/news/adapters/cryptopanic-adapter";
import { normalizeCryptoPanicSocialSignals } from "@/lib/social/socialSignalNormalizer";
import {
  SOCIAL_PROVIDER_TIMEOUT_MS,
  type SocialSignalSnapshot,
} from "@/lib/social/socialSignalTypes";

export async function fetchCryptoPanicSocialSignals({
  limit = 30,
  now = Date.now(),
}: {
  limit?: number;
  now?: number;
} = {}): Promise<SocialSignalSnapshot> {
  const adapter = new CryptoPanicAdapter();
  if (!adapter.isAvailable()) return normalizeCryptoPanicSocialSignals([], now);

  const timeout = AbortSignal.timeout(SOCIAL_PROVIDER_TIMEOUT_MS);
  const items = await Promise.race([
    adapter.fetch({ limit }),
    new Promise<never>((_, reject) =>
      timeout.addEventListener("abort", () => reject(new Error("cryptopanic_social_timeout")), {
        once: true,
      }),
    ),
  ]);
  return normalizeCryptoPanicSocialSignals(items, now);
}
