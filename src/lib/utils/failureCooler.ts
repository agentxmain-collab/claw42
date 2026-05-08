export interface FailureCoolerEntry {
  failedAt: number;
  nextRetryAt: number;
  reason: string;
}

export class FailureCooler {
  private readonly entries = new Map<string, FailureCoolerEntry>();

  constructor(private readonly cooldownMs = 30 * 60_000) {}

  isCooling(key: string, now = Date.now()): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (now >= entry.nextRetryAt) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  markFailure(key: string, reason: string, now = Date.now()): FailureCoolerEntry {
    const entry = {
      failedAt: now,
      nextRetryAt: now + this.cooldownMs,
      reason,
    };
    this.entries.set(key, entry);
    return entry;
  }

  clear(key: string) {
    this.entries.delete(key);
  }

  snapshot(now = Date.now()): Record<string, FailureCoolerEntry> {
    for (const key of Array.from(this.entries.keys())) {
      this.isCooling(key, now);
    }
    return Object.fromEntries(this.entries.entries());
  }
}

export const globalFailureCooler = new FailureCooler();
