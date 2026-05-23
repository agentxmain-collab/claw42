import type { ExternalEntrySignatureFailure } from "./externalEntrySignature";

export type SerializedSearchParams = Record<string, string | string[] | undefined>;

export interface ExternalEntryLandingContext {
  isExternalEntry: boolean;
  from: string;
  symbol: string | null;
  pair: string | null;
  uid_hash: string | null;
  sig_valid: boolean;
  sig_reason?: ExternalEntrySignatureFailure;
  deep_link: string | null;
  lang: string | null;
  theme: "dark" | "light" | null;
  utm: Record<string, string>;
  raw_params: Record<string, string>;
  landing_id: string | null;
}

export const EMPTY_LANDING_CONTEXT: ExternalEntryLandingContext = {
  isExternalEntry: false,
  from: "unknown",
  symbol: null,
  pair: null,
  uid_hash: null,
  sig_valid: false,
  deep_link: null,
  lang: null,
  theme: null,
  utm: {},
  raw_params: {},
  landing_id: null,
};

export function serializedSearchParamsToURLSearchParams(
  searchParams: SerializedSearchParams | undefined,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  return params;
}

export function landingContextAnalyticsFields(context: ExternalEntryLandingContext) {
  return {
    landing_id: context.landing_id,
    from: context.from,
    sig_valid: context.sig_valid,
  };
}
