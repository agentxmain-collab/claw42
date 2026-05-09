export function isAmbientChatterEnabled(): boolean {
  return (
    process.env.WATCH_AMBIENT_CHATTER_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_SHOW_AMBIENT_CHATTER === "true"
  );
}
