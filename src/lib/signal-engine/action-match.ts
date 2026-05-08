import { actionRules } from "@/lib/signal-engine/action-rules";
import type { SignalCard } from "@/types/signal";

export function attachActions(signal: SignalCard): SignalCard {
  const actions = actionRules
    .filter((rule) => {
      if (rule.match.primaryAsset && rule.match.primaryAsset !== signal.impact.primaryAsset) return false;
      if (rule.match.eventType && rule.match.eventType !== signal.facts.eventType) return false;
      return true;
    })
    .map((rule) => rule.action);

  const seen = new Set<string>();
  return {
    ...signal,
    actions: actions.filter((action) => {
      const key = `${action.kind}:${action.url ?? JSON.stringify(action.payload ?? {})}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
  };
}
