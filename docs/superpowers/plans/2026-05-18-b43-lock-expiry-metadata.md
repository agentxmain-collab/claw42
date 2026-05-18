# B43 Lock Expiry Metadata Plan

Goal: make refresh locks operationally visible in Vercel KV so `locked` and `refreshing`
responses can return a real `nextAllowedAt` instead of `null`.

Scope:

- Keep the existing token-based lock contract.
- Add KV metadata for lock expiry at acquisition time.
- Delete lock metadata together with the lock on release.
- Keep in-memory behavior unchanged.
- Add the lock test to the normal watch pipeline regression gate.

Verification:

- `src/lib/storage/__tests__/kv-lock.test.ts`
- `src/app/api/watch/refresh/route.test.ts`
- `src/modules/agent-watch/__tests__/visibleSessionRefreshTarget.test.ts`
- `npm run test:watch-pipeline`
- `npm run verify`
