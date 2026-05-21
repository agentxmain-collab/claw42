import { describe, expect, it } from "vitest";
import {
  COINW_HOSTED_CONFIRMATION_CONTRACT_CHECKLIST,
  COINW_HOSTED_CONFIRMATION_STATUS_FIXTURES,
  hostedConfirmationContractStatus,
} from "../handoffContract";

describe("CoinW hosted confirmation contract checklist", () => {
  it("keeps all platform-owned contract points explicit", () => {
    expect(COINW_HOSTED_CONFIRMATION_CONTRACT_CHECKLIST).toEqual([
      "kid_signature_validation",
      "payload_pull_or_push_model",
      "login_kyc_risk_sequence",
      "error_taxonomy_retry_policy",
      "callback_status_source_of_truth",
    ]);
    expect(hostedConfirmationContractStatus()).toEqual(
      COINW_HOSTED_CONFIRMATION_CONTRACT_CHECKLIST.map((item) => ({
        item,
        status: "pending_coinw_contract",
      })),
    );
  });

  it("covers the four sandbox return states required before Gate 2", () => {
    expect(COINW_HOSTED_CONFIRMATION_STATUS_FIXTURES.map((fixture) => fixture.status)).toEqual([
      "confirmed",
      "rejected",
      "expired",
      "cancelled",
    ]);
  });
});
