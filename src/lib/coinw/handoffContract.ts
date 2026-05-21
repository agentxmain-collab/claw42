import type { CoinWHandoffStatus } from "./orderIntentAuditStore";

export const COINW_HOSTED_CONFIRMATION_CONTRACT_CHECKLIST = [
  "kid_signature_validation",
  "payload_pull_or_push_model",
  "login_kyc_risk_sequence",
  "error_taxonomy_retry_policy",
  "callback_status_source_of_truth",
] as const;

export type CoinWHostedConfirmationContractItem =
  (typeof COINW_HOSTED_CONFIRMATION_CONTRACT_CHECKLIST)[number];

export interface CoinWHostedConfirmationContractStatus {
  item: CoinWHostedConfirmationContractItem;
  status: "pending_coinw_contract";
}

export const COINW_HOSTED_CONFIRMATION_STATUS_FIXTURES: Array<{
  status: Extract<CoinWHandoffStatus, "confirmed" | "rejected" | "expired" | "cancelled">;
  payload: {
    intentId: string;
    coinwOrderId?: string;
    rejectErrorCode?: string;
  };
}> = [
  {
    status: "confirmed",
    payload: { intentId: "intent-confirmed", coinwOrderId: "coinw-order-1" },
  },
  {
    status: "rejected",
    payload: { intentId: "intent-rejected", rejectErrorCode: "user_rejected" },
  },
  {
    status: "expired",
    payload: { intentId: "intent-expired", rejectErrorCode: "confirmation_expired" },
  },
  {
    status: "cancelled",
    payload: { intentId: "intent-cancelled", rejectErrorCode: "user_cancelled" },
  },
];

export function hostedConfirmationContractStatus(): CoinWHostedConfirmationContractStatus[] {
  return COINW_HOSTED_CONFIRMATION_CONTRACT_CHECKLIST.map((item) => ({
    item,
    status: "pending_coinw_contract",
  }));
}
