export type CoinWFuturesOrderMode = "disabled" | "test" | "live";

export interface CoinWOAuthReadiness {
  oauthConfigured: boolean;
  testAccountConfigured: boolean;
  orderSubmissionMode: CoinWFuturesOrderMode;
  realSubmissionEnabled: boolean;
  missingRequiredEnv: string[];
  blockingReasons: string[];
}

const OAUTH_ENV_KEYS = [
  "COINW_OAUTH_CLIENT_ID",
  "COINW_OAUTH_CLIENT_SECRET",
  "COINW_OAUTH_REDIRECT_URI",
  "COINW_OAUTH_AUTHORIZE_URL",
  "COINW_OAUTH_TOKEN_URL",
  "COINW_OAUTH_SCOPES",
] as const;

const TEST_ACCOUNT_ENV_KEY = "COINW_FUTURES_TEST_ACCOUNT_ID";

function hasEnv(name: string, env: NodeJS.ProcessEnv) {
  return typeof env[name] === "string" && env[name]!.trim().length > 0;
}

function normalizeOrderMode(value: string | undefined): CoinWFuturesOrderMode {
  return value === "test" || value === "live" ? value : "disabled";
}

export function coinWOAuthReadiness(env: NodeJS.ProcessEnv = process.env): CoinWOAuthReadiness {
  const missingOAuthEnv = OAUTH_ENV_KEYS.filter((key) => !hasEnv(key, env));
  const testAccountConfigured = hasEnv(TEST_ACCOUNT_ENV_KEY, env);
  const orderSubmissionMode = normalizeOrderMode(env.COINW_FUTURES_ORDER_MODE);
  const oauthConfigured = missingOAuthEnv.length === 0;
  const missingRequiredEnv = [
    ...missingOAuthEnv,
    ...(testAccountConfigured ? [] : [TEST_ACCOUNT_ENV_KEY]),
  ];
  const blockingReasons = [
    ...(oauthConfigured ? [] : ["coinw_oauth_not_configured"]),
    ...(testAccountConfigured ? [] : ["coinw_test_account_not_configured"]),
    ...(orderSubmissionMode === "disabled" ? ["coinw_order_submission_disabled"] : []),
    ...(orderSubmissionMode === "live" ? ["live_order_submission_requires_separate_release"] : []),
  ];

  return {
    oauthConfigured,
    testAccountConfigured,
    orderSubmissionMode,
    realSubmissionEnabled:
      oauthConfigured && testAccountConfigured && orderSubmissionMode === "test",
    missingRequiredEnv,
    blockingReasons,
  };
}
