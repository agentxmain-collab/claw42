function hashStringToNum(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

export function fakeFollowCount(
  strategyId: string,
  createdAt: number,
  now = Date.now(),
): { followCount: number; viewCount: number } {
  const elapsedMin = Math.max(0, (now - createdAt) / 60_000);
  const seed = hashStringToNum(strategyId);
  const baseView =
    elapsedMin < 5
      ? 50 + (seed % 100)
      : elapsedMin < 30
        ? 200 + Math.floor(elapsedMin * 10) + (seed % 100)
        : 500 + Math.min(200, Math.floor((elapsedMin - 30) * 6)) + (seed % 50);
  const baseFollow = Math.floor(baseView / 5) + (seed % 8);
  return { followCount: baseFollow, viewCount: baseView };
}
