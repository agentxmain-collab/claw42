import { newsItemToEvidence } from "@/lib/news/newsEvidence";
import { marketSignalsFromPool } from "@/lib/team/pmDecisionTrigger";
import { selectPmDecisionTopics } from "@/lib/team/topicSelector";
import type { Locale } from "@/i18n/types";
import type { CoinPoolPayload } from "@/modules/agent-watch/types";
import type { NewsItem } from "@/lib/types";
import type { DecisionCandidate } from "@/lib/watch/decisionCandidate";
import {
  hotspotDecisionCandidate,
  marketOverviewCandidate,
  shouldRunHotspotPrewarm,
  shouldRunMarketOverviewPrewarm,
  utcHourWindowKey,
} from "@/lib/watch/residentCandidate";

const HOTSPOT_BURST_WINDOW_HOURS = 1;
const HOTSPOT_BURST_SCORE_THRESHOLD = 130;

export function residentPrewarmCandidates({
  locale,
  now,
  pool,
  newsItems = [],
  force = false,
  includeBurst = true,
}: {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems?: NewsItem[];
  force?: boolean;
  includeBurst?: boolean;
}): DecisionCandidate[] {
  const candidates: DecisionCandidate[] = [];
  if (force || shouldRunMarketOverviewPrewarm(now)) {
    candidates.push(marketOverviewCandidate({ locale, now }));
  }
  if (force || shouldRunHotspotPrewarm(now)) {
    candidates.push(hotspotDecisionCandidate({ locale, now }));
  }

  const burst = includeBurst ? hotspotBurstCandidate({ locale, now, pool, newsItems }) : null;
  if (burst && !candidates.some((candidate) => candidate.candidateKey === burst.candidateKey)) {
    candidates.push(burst);
  }

  return candidates;
}

function hotspotBurstCandidate({
  locale,
  now,
  pool,
  newsItems,
}: {
  locale: Locale;
  now: number;
  pool?: CoinPoolPayload;
  newsItems: NewsItem[];
}) {
  const newsEvidence = newsItems.map((item) => newsItemToEvidence(item));
  const marketSignals = marketSignalsFromPool(pool, now);
  const topic = selectPmDecisionTopics({
    pool,
    marketSignals,
    newsEvidence,
    now,
  })[0];
  if (!topic || topic.score < HOTSPOT_BURST_SCORE_THRESHOLD) return null;

  return hotspotDecisionCandidate({
    locale,
    now,
    symbol: topic.symbol,
    executable: false,
    score: topic.score,
    reasons: topic.reasons,
    candidateKey: `hotspot:burst:${locale}:${utcHourWindowKey(
      now,
      HOTSPOT_BURST_WINDOW_HOURS,
    )}:${topic.symbol}`,
    displayTitle: `${topic.symbol} 热点异动追踪`,
  });
}
