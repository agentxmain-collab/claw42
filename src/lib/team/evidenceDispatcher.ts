import type { NewsEvidence } from "@/lib/news/newsEvidence";
import { fetchDefiLlamaFundamentalEvidence } from "@/lib/fundamental/defillamaTokenomicsAdapter";
import { getMarketAnalysisContext } from "@/lib/marketDataCache";
import { fetchDefiLlamaProtocolEvidence } from "@/lib/onchain/defillamaAdapter";
import { fetchEtherscanEvidence } from "@/lib/onchain/etherscanAdapter";
import type { AnalystDataStatus } from "@/lib/team/strategyDecisionRecord";
import type { TeamMemberId } from "@/lib/team/teamRegistry";
import type { SignalRecord } from "@/modules/agent-watch/types";

export type EvidenceDomain = "chart" | "news" | "onchain" | "fundamental" | "market";

export interface TypedEvidenceItem {
  id: string;
  domain: EvidenceDomain;
  status: AnalystDataStatus;
  summary: string;
  source: string;
}

export interface EvidenceContextSection {
  status: AnalystDataStatus;
  items: TypedEvidenceItem[];
  summary: string;
}

export interface EvidenceContextPack {
  symbol: string;
  chart: EvidenceContextSection;
  news: EvidenceContextSection;
  onchain: EvidenceContextSection;
  fundamental: EvidenceContextSection;
  market: EvidenceContextSection;
  dataStatus: Record<EvidenceDomain, AnalystDataStatus>;
}

export interface BuildEvidenceContextInput {
  symbol: string;
  recentMarketSignals: SignalRecord[];
  recentNewsEvidence: NewsEvidence[];
}

const MEMBER_DOMAINS: Record<TeamMemberId, EvidenceDomain[]> = {
  fundamental_analyst: ["fundamental", "market"],
  news_analyst: ["news", "market"],
  chart_analyst: ["chart", "market"],
  onchain_analyst: ["onchain", "market"],
  research_lead: ["chart", "news", "onchain", "fundamental", "market"],
  risk_lead: ["chart", "news", "onchain", "fundamental", "market"],
  pm: ["chart", "news", "onchain", "fundamental", "market"],
  bullish_researcher: ["chart", "news", "onchain", "fundamental", "market"],
  bearish_researcher: ["chart", "news", "onchain", "fundamental", "market"],
  trader: ["chart", "market"],
  aggressive_reviewer: ["chart", "news", "market"],
  neutral_reviewer: ["chart", "news", "onchain", "fundamental", "market"],
  conservative_reviewer: ["chart", "onchain", "fundamental", "market"],
  memory_loop: ["chart", "news", "onchain", "fundamental", "market"],
};

const MEMBER_REQUIRED_DOMAIN: Partial<Record<TeamMemberId, EvidenceDomain>> = {
  fundamental_analyst: "fundamental",
  news_analyst: "news",
  chart_analyst: "chart",
  onchain_analyst: "onchain",
  trader: "chart",
};

const MEMBER_MANDATES: Record<TeamMemberId, string> = {
  fundamental_analyst:
    "You are the fundamental analyst. Use only fundamental/tokenomics and broad market context. Do not evaluate chart patterns, news sentiment, or wallet flow.",
  news_analyst:
    "You are the news analyst. Use only news/sentiment evidence and broad market context. Do not evaluate chart patterns, onchain flow, or tokenomics.",
  chart_analyst:
    "You are the technical analyst. Use only chart, kline, momentum, volume, and price-action evidence. Do not evaluate news, onchain flow, or fundamentals.",
  onchain_analyst:
    "You are the onchain analyst. Use only onchain/protocol activity evidence and broad market context. Do not evaluate chart patterns, news, or tokenomics.",
  research_lead:
    "You are the research lead. Synthesize available role outputs and identify which domain carries the strongest signal.",
  risk_lead:
    "You are the risk lead. Focus on downside, invalidation, stale evidence, and reasons to reduce or wait.",
  pm: "You are the portfolio manager. Turn evidence and role inputs into an auditable decision using only confirmed signals.",
  bullish_researcher:
    "You are the bullish researcher. Build the strongest long thesis from available evidence and state how much conviction it deserves.",
  bearish_researcher:
    "You are the bearish researcher. Build the strongest short or avoid thesis from available evidence and state how much conviction it deserves.",
  trader:
    "You are the execution strategist. Focus on entry quality, kline confirmation, liquidity, invalidation, and position sizing.",
  aggressive_reviewer:
    "You are the aggressive reviewer. Test whether the setup justifies speed and risk using confirmed signals.",
  neutral_reviewer:
    "You are the neutral reviewer. Weigh evidence on both sides and call out when the correct stance is wait.",
  conservative_reviewer:
    "You are the conservative reviewer. Require strong evidence before endorsing risk; thin signal coverage should lower confidence.",
  memory_loop:
    "You are the memory loop. Compare this setup with prior decision patterns and state what should be remembered for post-trade review.",
};

function section(
  domain: EvidenceDomain,
  status: AnalystDataStatus,
  items: TypedEvidenceItem[],
  summary: string,
): EvidenceContextSection {
  return { status, items, summary: summary || publicFallbackSummary(domain) };
}

function publicFallbackSummary(domain: EvidenceDomain) {
  return `No independent ${domain} signal was available in the current evidence window.`;
}

function statusFromItems(items: TypedEvidenceItem[]): AnalystDataStatus {
  if (items.length === 0) return "missing";
  if (items.some((item) => item.status === "ok") && items.some((item) => item.status !== "ok")) {
    return "partial";
  }
  if (items.every((item) => item.status === "missing")) return "missing";
  return items.some((item) => item.status === "partial") ? "partial" : "ok";
}

function chartItems(symbol: string, signals: SignalRecord[]): TypedEvidenceItem[] {
  return signals
    .filter((signal) => signal.symbol.trim().replace(/^\$+/, "").toUpperCase() === symbol)
    .map((signal, index) => ({
      id: `chart:${symbol}:signal:${index}`,
      domain: "chart" as const,
      status: "ok" as const,
      source: "market-signal",
      summary: [
        `${signal.type} ${signal.severity}`,
        signal.payload.priceLevel !== undefined ? `price=${signal.payload.priceLevel}` : null,
        signal.payload.change24h !== undefined ? `change24h=${signal.payload.change24h}` : null,
        signal.payload.description,
      ]
        .filter(Boolean)
        .join(" / "),
    }));
}

async function liveChartItems(symbol: string): Promise<TypedEvidenceItem[]> {
  if (process.env.NODE_ENV === "test") return [];
  try {
    const market = await getMarketAnalysisContext();
    const ticker = market.tickers[symbol as keyof typeof market.tickers];
    const coinw = market.coinw?.[symbol as keyof typeof market.coinw];
    if (!ticker && !coinw) return [];
    return [
      {
        id: `chart:${symbol}:coinw-context`,
        domain: "chart",
        status: market.source === "coinw-kline" ? "ok" : "partial",
        source: market.source,
        summary: [
          ticker ? `price=${ticker.price}` : null,
          ticker ? `change24h=${ticker.change24h}` : null,
          coinw?.m5 ? `m5=${coinw.m5.trend} ${coinw.m5.changePct.toFixed(2)}%` : null,
          coinw?.m15 ? `m15=${coinw.m15.trend} ${coinw.m15.changePct.toFixed(2)}%` : null,
          coinw?.h4 ? `h4=${coinw.h4.trend} ${coinw.h4.changePct.toFixed(2)}%` : null,
        ]
          .filter(Boolean)
          .join(" / "),
      },
    ];
  } catch (error) {
    return [
      {
        id: `chart:${symbol}:coinw-context-missing`,
        domain: "chart",
        status: "partial",
        source: "coinw-kline",
        summary: `CoinW kline context unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
    ];
  }
}

function newsItems(symbol: string, evidence: NewsEvidence[]): TypedEvidenceItem[] {
  return evidence
    .filter((item) => item.symbol.map((value) => value.toUpperCase()).includes(symbol))
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      domain: "news" as const,
      status: "ok" as const,
      source: item.source,
      summary: `${item.title} — ${item.summary}`,
    }));
}

function snapshotItem(
  domain: "onchain" | "fundamental",
  symbol: string,
  source: string,
  status: AnalystDataStatus,
  summary: string,
): TypedEvidenceItem {
  return {
    id: `${domain}:${symbol}:${source}`,
    domain,
    status,
    source,
    summary,
  };
}

function summarize(items: TypedEvidenceItem[], fallback: string) {
  if (items.length === 0) return fallback;
  return items.map((item) => `[${item.source}/${item.status}] ${item.summary}`).join("\n");
}

export async function buildEvidenceContextPack({
  symbol,
  recentMarketSignals,
  recentNewsEvidence,
}: BuildEvidenceContextInput): Promise<EvidenceContextPack> {
  const normalizedSymbol = symbol.trim().replace(/^\$+/, "").toUpperCase() || "BTC";
  const chart = [
    ...chartItems(normalizedSymbol, recentMarketSignals),
    ...(await liveChartItems(normalizedSymbol)),
  ];
  const news = newsItems(normalizedSymbol, recentNewsEvidence);
  const [etherscan, defillama, fundamental] = await Promise.all([
    fetchEtherscanEvidence(normalizedSymbol),
    fetchDefiLlamaProtocolEvidence(normalizedSymbol),
    fetchDefiLlamaFundamentalEvidence(normalizedSymbol),
  ]);
  const onchain = [
    snapshotItem(
      "onchain",
      normalizedSymbol,
      etherscan.source,
      etherscan.status,
      etherscan.summary,
    ),
    snapshotItem(
      "onchain",
      normalizedSymbol,
      defillama.source,
      defillama.status,
      defillama.summary,
    ),
  ];
  const fundamentalItems = [
    snapshotItem(
      "fundamental",
      normalizedSymbol,
      fundamental.source,
      fundamental.status,
      fundamental.summary,
    ),
  ];
  const market = [
    {
      id: `market:${normalizedSymbol}:summary`,
      domain: "market" as const,
      status: recentMarketSignals.length > 0 ? ("ok" as const) : ("missing" as const),
      source: "pm-input",
      summary:
        recentMarketSignals
          .slice(0, 4)
          .map((signal) => `${signal.symbol} ${signal.type} ${signal.severity}`)
          .join(" / ") || publicFallbackSummary("market"),
    },
  ];

  return {
    symbol: normalizedSymbol,
    chart: section(
      "chart",
      statusFromItems(chart),
      chart,
      summarize(chart, publicFallbackSummary("chart")),
    ),
    news: section(
      "news",
      statusFromItems(news),
      news,
      summarize(news, publicFallbackSummary("news")),
    ),
    onchain: section(
      "onchain",
      statusFromItems(onchain),
      onchain,
      summarize(onchain, publicFallbackSummary("onchain")),
    ),
    fundamental: section(
      "fundamental",
      statusFromItems(fundamentalItems),
      fundamentalItems,
      summarize(fundamentalItems, publicFallbackSummary("fundamental")),
    ),
    market: section(
      "market",
      statusFromItems(market),
      market,
      summarize(market, publicFallbackSummary("market")),
    ),
    dataStatus: {
      chart: statusFromItems(chart),
      news: statusFromItems(news),
      onchain: statusFromItems(onchain),
      fundamental: statusFromItems(fundamentalItems),
      market: statusFromItems(market),
    },
  };
}

function combinedStatus(statuses: AnalystDataStatus[]): AnalystDataStatus {
  if (statuses.every((status) => status === "missing")) return "missing";
  if (statuses.some((status) => status !== "ok")) return "partial";
  return "ok";
}

export function dataStatusForMember(memberId: TeamMemberId, pack: EvidenceContextPack) {
  const requiredDomain = MEMBER_REQUIRED_DOMAIN[memberId];
  if (requiredDomain) return pack.dataStatus[requiredDomain];
  return combinedStatus(MEMBER_DOMAINS[memberId].map((domain) => pack.dataStatus[domain]));
}

export function evidenceIdsForMember(memberId: TeamMemberId, pack: EvidenceContextPack): string[] {
  return MEMBER_DOMAINS[memberId].flatMap((domain) => pack[domain].items.map((item) => item.id));
}

export function formatRoleEvidenceContext(memberId: TeamMemberId, pack: EvidenceContextPack) {
  const domains = MEMBER_DOMAINS[memberId];
  const sections = domains
    .map((domain) => {
      const section = pack[domain];
      return `### ${domain} evidence
${section.summary}`;
    })
    .join("\n\n");

  return `## Role mandate
${MEMBER_MANDATES[memberId]}

## Public output discipline
Use only the evidence below. If the signal set is thin, lower confidence and describe the basis for caution.
Do not mention backend connectors, data ingestion status, unprovided datasets, service health, or fallback execution.

${sections}`;
}
