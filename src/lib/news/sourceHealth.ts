import {
  NEWS_SOURCE_CONFIGS,
  isNewsSourceId,
  type NewsSourceConfig,
  type NewsSourceId,
} from "@/lib/news/sourceRegistry";

export type NewsSourceUnavailableReason =
  | "missing_env"
  | "planned_endpoint"
  | "standby_disabled"
  | null;

export interface NewsSourceHealthSnapshot {
  id: NewsSourceId;
  displayName: string;
  role: NewsSourceConfig["role"];
  status: NewsSourceConfig["status"];
  authRequired: boolean;
  authConfigured: boolean;
  inFetchChain: boolean;
  fetchChainRank: number | null;
  availableByConfig: boolean;
  unavailableReason: NewsSourceUnavailableReason;
}

type NewsSourceHealthEnv = Partial<Record<string, string | undefined>>;

export function getNewsSourceHealthSnapshot({
  env = process.env,
  standbyEnabled = env.NEWS_ENABLE_STANDBY_SOURCES === "1",
}: {
  env?: NewsSourceHealthEnv;
  standbyEnabled?: boolean;
} = {}): NewsSourceHealthSnapshot[] {
  const preferredSource = env.NEWS_PRIMARY_SOURCE;
  const chain = chainSources(standbyEnabled, preferredSource);
  const chainRanks = new Map(chain.map((source, index) => [source.id, index]));

  return NEWS_SOURCE_CONFIGS.map((source) => {
    const authRequired = source.authMode === "apiKey";
    const authConfigured = !authRequired || Boolean(source.envKey && env[source.envKey]?.trim());
    const fetchChainRank = chainRanks.get(source.id) ?? null;
    const inFetchChain = fetchChainRank !== null;
    const unavailableReason = resolveUnavailableReason({
      source,
      standbyEnabled,
      authConfigured,
    });

    return {
      id: source.id,
      displayName: source.displayName,
      role: source.role,
      status: source.status,
      authRequired,
      authConfigured,
      inFetchChain,
      fetchChainRank,
      availableByConfig: inFetchChain && unavailableReason === null,
      unavailableReason,
    };
  });
}

function chainSources(standbyEnabled: boolean, preferredSource: string | undefined) {
  const order: NewsSourceConfig["role"][] = ["primary", "fallback", "specialty"];
  const activeSources = order.flatMap((role) =>
    NEWS_SOURCE_CONFIGS.filter((source) => source.status === "active" && source.role === role),
  );
  const sources = standbyEnabled
    ? [...activeSources, ...NEWS_SOURCE_CONFIGS.filter((source) => source.status === "standby")]
    : activeSources;

  if (!preferredSource || !isNewsSourceId(preferredSource)) return sources;
  const index = sources.findIndex((source) => source.id === preferredSource);
  if (index <= 0) return sources;

  const preferred = sources[index];
  return preferred ? [preferred, ...sources.slice(0, index), ...sources.slice(index + 1)] : sources;
}

function resolveUnavailableReason({
  source,
  standbyEnabled,
  authConfigured,
}: {
  source: NewsSourceConfig;
  standbyEnabled: boolean;
  authConfigured: boolean;
}): NewsSourceUnavailableReason {
  if (source.status === "planned") return "planned_endpoint";
  if (source.status === "standby" && !standbyEnabled) return "standby_disabled";
  if (!authConfigured) return "missing_env";
  return null;
}
