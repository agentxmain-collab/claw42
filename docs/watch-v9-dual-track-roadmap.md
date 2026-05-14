# Watch V9 Dual-Track Roadmap

> **For agentic workers:** This is the long-running guardrail for Claw42 Watch V9 work. Before starting any Watch, realtime analysis, topic, news, PM pipeline, preview, or staging task, classify the task as A line or B line first. Implementation specs can be derived from this roadmap, but this document is the cadence source of truth.

**Goal:** Keep the external preview line and the real-data product line moving in parallel without mixing their release semantics.

**Architecture:** A line is the public showcase surface: UI, interaction, copy, fixture-backed demos, and feedback collection. B line is the internal product mainline: real topic selection, news intake, PM decision generation, timeline projection, replay, and later real follow execution. A can lag B by one or more functional versions; B must not leak unfinished real-data behavior into public preview until Dan explicitly promotes it.

**Tech Stack:** Next.js App Router, React V9 Watch components, Vercel preview/runtime, Vercel KV/local fallback stores, Claw42 LLM pipeline, multi-source news adapters, Vitest, Prettier, TypeScript.

---

## 1. Non-Negotiable Cadence

### A Line: External Preview / Showcase

A line exists for outside viewers.

- Purpose: demonstrate the confirmed Watch V9 experience, gather visual and interaction feedback, and keep the public story coherent.
- Data posture: fixture or curated demo data only unless Dan explicitly approves a real-data public preview.
- Feature posture: can be behind B line. It should show the stable previous experience, not expose half-finished pipeline work.
- Allowed work: layout, hover, collapse, tab behavior, public copy, demo decision flows, HTML exports, screenshot validation, staging preview.
- Disallowed by default: real topic trigger changes, live pipeline changes, unverified news source activation, real follow execution, production promotion.

### B Line: Internal Product Mainline

B line is the actual forward development path.

- Purpose: build the real Claw42 realtime analysis product.
- Data posture: real market pool, real news evidence, real PM decision records, real public timeline projection, internal preview validation.
- Feature posture: always moves ahead of A. It can be ugly internally if needed, but it must preserve the approved V9 layout unless pulling in a confirmed A-line UI update.
- Allowed work: topic ranking, news source hardening, PM pipeline, adapter mapping, storage, replay, internal API verification, non-public staging.
- Disallowed by default: public-facing UI redesign, external showcase URL, prod promotion, true trading execution.

### Merge Rule

- A -> B: allowed after the UI/interaction version is confirmed. Merge only the confirmed layout/interaction/copy changes into B.
- B -> A: not allowed by default. Only cherry-pick or port safe, curated output into A when Dan wants a new public preview.
- Prod: neither A nor B implies production release. `claw42.ai` release remains a separate Dan decision.

## 2. Current Source Of Truth

### Design And Specs

- `docs/codex-specs/spec-watch-dispatch-console-v3-7-redesign.md`
  - V9 visual authority.
  - Establishes two-tab dispatch console, scoped original classes/CSS, fixture-backed Phase A, no true follow execution.
- `docs/codex-specs/spec-watch-phase-b-real-agent-pipeline.md`
  - Phase B real pipeline authority.
  - Establishes PM decision payload shape, safe formatter, topic aggregation, V9 adapter, polling, follow stats, and staging gates.
- `docs/archive/backend-assets-from-legacy-branches.md`
  - Historical branch extraction decision.
  - Confirms news source chain and PM pipeline are already in the current baseline; old branches should be mined by module, not merged wholesale.
- `docs/airy-tasks/task-17-news-source-multi-chain.md`
  - News chain implementation source.
  - Establishes CryptoCompare primary, CoinGecko/RSS/Binance fallback/specialty, CryptoPanic standby, CoinW announcements planned.
- `docs/research/news-source-evaluation-by-claude.md`
  - News source evaluation background.
  - CryptoPanic discontinuation claim is unverified; CryptoCompare/CoinGecko/RSS remain the practical chain.

### Current B-Line Code

- `src/lib/team/topicSelector.ts`
  - Current real topic ranker.
  - Scores candidate symbols from news severity, market signal severity, 24h momentum, and coin-pool category.
- `src/lib/team/pmDecisionTrigger.ts`
  - PM decision trigger orchestration.
  - Converts pool tickers to market signals, stores news evidence, selects candidate topics, applies symbol locks, then runs the PM pipeline.
- `src/lib/team/pmDecisionPipeline.ts`
  - Current 4 analyst + research lead + risk lead + PM decision pipeline.
  - Writes `StrategyDecisionRecord`, public timeline event payload, and watch history entry.
- `src/lib/news/sourceRegistry.ts`
  - News source registry and ordering.
  - Active: CryptoCompare, CoinGecko, CoinDesk RSS, Cointelegraph RSS, Decrypt RSS, Binance announcements. Planned: CoinW announcements. Standby: CryptoPanic.
- `src/lib/news/sourceChain.ts`
  - Multi-source news fetcher with per-source cache, failure cooler, quota logging, and mock fallback.
- `src/lib/news/newsEvidence.ts`
  - Normalized `NewsEvidence` contract consumed by PM pipeline and V9 adapter.
- `src/lib/news/newsEvidenceStore.ts`
  - Evidence persistence via KV when configured, otherwise local/memory fallback.
- `src/lib/watch/topicAggregator.ts`
  - Groups `pm_decision` events by locale + symbol within a 30-minute window.
- `src/lib/watch/v9TopicAdapter.ts`
  - Maps public timeline events into V9 `DispatchTopic[]`.
- `src/modules/agent-watch/AgentWatchBoard.tsx`
  - Client integration point.
  - Fetches `/api/watch/timeline`, maps events to topics, polls follow stats, and passes topics into V9.
- `src/modules/agent-watch/v9/*`
  - Approved V9 view layer.
  - Treat this as layout authority unless the A-line UI update has been confirmed.
- `src/app/api/watch/timeline/route.ts`
  - Public timeline API.
  - Returns `events`, `evidenceMap`, paging fields, locale, servedAt, and `nextPollMs`.
- `src/app/api/cron/strategy-replay/route.ts`
  - Background cron/trigger path.
  - Pulls news, runs debate legacy path, gets coin pool, and triggers PM decision generation.

### Demo Artifacts Are Not Source Of Truth

The exported HTML files under `/Users/dannybrown/Claude/职业规划/web-dev/claw42-exports/` are review artifacts only. They are useful for visual discussion, but future code work must start from the React components and specs above.

## 3. A-Line Roadmap

A line should stay one stable public-facing version behind B when needed.

### A0. Current Confirmed Public Preview Surface

Scope:

- Confirmed homepage + realtime analysis page shell.
- V9 realtime analysis with title/header aligned to homepage.
- Hover states for cards and module boxes.
- Fixture/demo decision flows.
- No real execution.

Acceptance:

- Opens on a public preview URL Dan can share.
- Uses stable fixture content.
- No dependency on live PM decision generation.
- No production promotion.

### A1. UI/Interaction Feedback Loop

Scope:

- Apply the next UI/interaction design pass when Dan provides it.
- Keep layout changes inside V9 components and scoped CSS.
- Keep fixture/demo content coherent enough for external viewers.

Acceptance:

- Browser screenshot at desktop target.
- Collapse/expand, tab switching, hover, focus states work.
- Public copy does not imply unready real trading execution.

### A2. Public Preview Freeze

Scope:

- Freeze the next external preview candidate.
- Export HTML/screenshot if Dan needs review files.
- Deploy preview only after deployment identity checks are clean.

Acceptance:

- Dan confirms it is shareable.
- Any B-line real-data changes remain hidden from this preview unless explicitly approved.

## 4. B-Line Roadmap

B line is the main long-term product track. Keep the V9 layout stable; improve data, orchestration, and truthfulness.

### B0. Drift Guard And Baseline

Current status: mostly done, but must remain active.

Scope:

- Keep branch/worktree separation clean.
- Keep source-of-truth docs updated.
- Preserve V9 layout when changing real data wiring.
- Keep old branches archived, not merged wholesale.
- Keep `test:watch-pipeline` aligned with real B-line contracts, including team registry, trade-decision validation, dispatch-agent mapping, safe message formatting, and follow-stats storage.
- Keep legacy faction/replay compatibility tests inside the B-line gate so old data can be projected without reintroducing retired faction UI.
- Keep B-line symbol normalization consistent across topic selection, trigger scoping, PM prompts, trade-decision validation, public timeline grouping, evidence, decision-record storage, strategy validation, and future deeplinks; leading cash-tag artifacts should be stripped even when repeated.

Acceptance:

- Every new Watch task is labeled A or B before implementation.
- Any task that touches both UI and pipeline states an explicit merge direction.
- Main worktree dirty state is not disturbed.

### B1. Topic Selection And Explanation

Current status: implemented for first internal version in `src/lib/team/topicSelector.ts`.

What exists:

- Candidate symbols come from CoinW pool.
- Ranking uses news severity, signal severity, 24h movement, and pool category.
- CoinGecko market-data requests now accept either `COINGECKO_API_KEY` or the news-chain `COINGECKO_DEMO_KEY`, keeping the topic pool aligned with the same preview env key.
- Candidate records expose structured `scoreBreakdown` for internal audit.
- `buildTopicSelectionEvidence()` produces a synthetic selection evidence item.
- Automatic selection suppresses recently covered PM symbols from the public timeline window.
- If the CoinW pool is unavailable, topic selection can fall back to real news/signal symbols before using BTC as the final empty fallback.
- Symbol-less market-wide news evidence is anchored to BTC as the broad market proxy instead of being scored against every pool candidate.
- Opportunity-pool symbols remain eligible even when majors and trending already fill six entries, so high-momentum opportunity names are not dropped before scoring.
- Public selection evidence now maps internal pool categories to readable labels such as `主流高流动性池`, `趋势加速池`, and `机会观察池` instead of leaking raw category ids.
- Public selection evidence now summarizes `主因` / `辅助` / `约束` from score components before listing evidence details, improving topic explainability without exposing raw scores.
- Public selection evidence now phrases topic choice as a product decision (`本轮优先分析...`) instead of a debug-style system selection log.
- Topic selection now trims, dollar-strips, and uppercases explicit symbols before matching market signals and news evidence.
- Topic selection now drops unusable explicit symbols instead of creating empty candidates that could pollute trigger locks or evidence ids.
- Topic selection memory now falls back to clean `tradeDecision.symbol` values when legacy record-level symbols are unusable.

Remaining work:

- Continue improving reason weighting so "why this topic now" reads like a product decision, not an internal debug note.
- Keep adding fallback and repetition tests from real staging cases.

Recommended implementation spec:

- `B1.1` expose structured score breakdown internally.
- `B1.2` add recent-topic suppression against timeline records.
- `B1.3` improve public selection summary text.
- `B1.3a` map internal pool category ids to readable selection evidence labels.
- `B1.3b` summarize public topic drivers as main/supporting/constraint factors without raw score leakage.
- `B1.3b.1` phrase public topic-selection evidence as product decision copy instead of debug/system-log copy.
- `B1.3c` anchor symbol-less market-wide news to BTC so broad news does not falsely boost every candidate.
- `B1.3d` score the complete pool before truncation so opportunity names can win on real momentum.
- `B1.3e` normalize explicit symbols before candidate matching.
- `B1.3f` reject unusable explicit symbols before candidate scoring.
- `B1.3g` match recent decision memory through trade-decision symbols when legacy record symbols are unusable.
- `B1.4` verify one real trigger from preview KV.

### B2. News Source Chain Hardening

Current status: implemented as a chain, but not yet product-hardened.

What exists:

- Registry-driven sources.
- CryptoCompare primary, CoinGecko/RSS/Binance fallback/specialty, CryptoPanic standby, CoinW planned.
- Cache, failure cooler, quota event logging, mock fallback.
- Safe source health snapshot is available on internal `trigger=now` verification.
- Local symbol extraction covers a wider set of common project names in RSS/general headlines, reducing unnecessary LLM normalizer calls.
- News normalizer now cleans existing currency arrays locally before deciding whether an LLM fallback is needed, including leading whitespace and repeated dollar-prefix artifacts.
- Local symbol extraction now covers emerging project-name aliases such as Bittensor/TAO, Hyperliquid/HYPE, Ethena/ENA, Morpho/MORPHO, DeXe/DEXE, and pump.fun/PUMP while keeping generic uppercase words out unless they appear as explicit tickers/pairs.
- Broad crypto market headlines are locally anchored to BTC to avoid unnecessary LLM normalization, while market-maker wording is kept out of the Maker/MKR alias path.
- V9 topics now label original-source links with the real evidence source name when a source URL exists; topics without URLs still omit the source link entirely.
- `NewsEvidence` now carries normalized `sourceDomain` when the source adapter provides a publisher domain or when it can be derived from the article URL.
- `NewsEvidence` now trims, dollar-strips, uppercases, deduplicates, and drops empty currency values before PM selection or V9 projection consumes evidence symbols.
- `NewsEvidence` now falls back to `fetchedAt` when source `publishedAt` values are invalid, avoiding evidence-build crashes from malformed source timestamps.
- News normalizer now treats invalid existing currency values as missing instead of preserving dirty symbols.
- News Agent fallback summaries now format dirty currency inputs as clean cash tags, avoiding `$$ETH` style public copy when LLM generation is unavailable.
- Legacy chat prompt seeds now normalize dirty news currency inputs before building conversation symbols, keeping the older debate path aligned with the B-line news symbol contract.
- Total source-chain fallback reports `servedBy: "mock"` for mock news, so source diagnostics and normalizer task tags do not misattribute mock data to CryptoPanic.
- Total source-chain mock fallback now also logs `news_fetched` with `served_by: "mock"`, so operational logs match the returned source diagnostics.
- Source-chain tests lock standby behavior: CryptoPanic is not included by default and only serves news when `NEWS_ENABLE_STANDBY_SOURCES=1`.
- Source-chain tests lock adapter failure behavior: if the primary source throws, the chain records the failed source and continues to the next available real source before mock fallback.
- News adapter URL normalization now rejects non-HTTP(S) article links before they can become news items or evidence records.
- Source-chain tests lock standby preferred-source behavior: `NEWS_PRIMARY_SOURCE=cryptopanic` takes effect only when standby sources are enabled, keeping fetch order aligned with source-health diagnostics.
- Source-health snapshots now include a secret-free `fetchChainRank`, so internal debug output can confirm actual source order including standby preferred-source overrides.

Remaining work:

- Verify which API keys are configured in Preview and Production without printing secrets.
- Confirm real source availability with `npm run verify:news`.
- Decide whether CryptoPanic stays standby after Dan verifies the actual notice.
- Add CoinW announcement adapter only when an actual endpoint/feed is available.
- Continue expanding symbol extraction with real false-negative/false-positive samples from staging logs.
- Decide how much of `sourceDomain` should become user-facing copy in the V9 UI after the next public copy review.

Recommended implementation spec:

- `B2.1` source env audit and safe verification.
- `B2.2` symbol extraction normalizer tests.
- `B2.3` source health snapshot in debug-only response or logs.
- `B2.4` CoinW announcements adapter once endpoint is known.
- `B2.5` truthfully label total source-chain mock fallback as `mock`.
- `B2.5a` log total source-chain mock fallback as `served_by=mock`.
- `B2.6` lock standby-source opt-in behavior so standby providers do not silently become the default chain.
- `B2.7` lock adapter failure-through behavior before mock fallback.
- `B2.8` normalize NewsEvidence symbols before PM selection consumes them.
- `B2.9` reject non-HTTP(S) article links in news adapter URL normalization.
- `B2.10` normalize existing news currencies before LLM fallback decisions, including whitespace and repeated dollar-prefix artifacts.
- `B2.11` normalize currency cash tags in News Agent fallback summaries.
- `B2.12` normalize news-derived legacy chat prompt seeds.
- `B2.13` align standby preferred-source fetch order with source-health diagnostics.
- `B2.14` expose secret-free source-health fetch chain rank for internal debug verification.
- `B2.15` treat invalid existing news currencies as missing before LLM fallback.
- `B2.16` tolerate invalid source timestamps when building news evidence.

### B3. Trigger Orchestration

Current status: cron and user-visit triggers exist.

What exists:

- `/api/cron/strategy-replay` fetches news and coin pool, then triggers PM decision generation.
- `/api/agents/analysis` can trigger PM decision opportunistically from user visit.
- Symbol lock prevents repeated PM decisions for roughly 170 minutes.
- Trigger audit now reports candidate consideration, generated/skipped candidates, lock/no-trigger states, and the empty-selection case caused by recent-topic suppression.
- Route tests lock the trigger boundary: single-agent grounded analysis does not trigger PM generation; only the legacy locale payload path can trigger the user-visit pipeline.
- Route tests also lock the partial-param boundary: incomplete grounded-analysis params return `400` and do not fall through to legacy payload or PM generation.
- Route tests also lock the response boundary: `pmDecisionAudit` and `newsSourceHealth` are returned only for internal `trigger=now` verification, not the scheduled cron response.
- News evidence pre-save in the trigger layer is best-effort; storage failure no longer prevents topic selection and PM trigger auditing.
- Trigger-layer symbol matching now normalizes pool symbols, explicit symbols, and news-evidence symbols consistently before scoping market/news context for the PM prompt.
- Trigger-layer symbol-less market news matching now follows the same BTC broad-market anchor as topic selection, so a locked BTC candidate cannot leak the news trigger into unrelated symbols.
- Trigger-layer pool symbol normalization now trims/dollar-strips before market-signal scoping, so dirty pool labels do not drop valid PM prompt signals.
- Trigger-layer market-signal descriptions now use normalized symbols, so dirty pool labels cannot leak into public topic-selection evidence or PM prompt context.
- Scheduled PM batch processing can reach opportunity-pool symbols beyond the first six pool entries.
- Public V9 Watch entry points are covered by an import-boundary test that keeps `AgentWatchBoard` off the legacy analysis polling modules that can invoke the `user_visit_trigger` path.
- Cron auth is covered by a side-effect boundary test: when `CRON_SECRET` is configured, unauthorized requests return `401` before news fetch, pool fetch, or PM trigger work starts.
- Manual `trigger=now` lock keys are locale-scoped, so one internal verification locale does not block another locale for five minutes.
- Frontend legacy analysis polling now calls `/api/agents/analysis` with `pmTrigger=0`, so homepage/Hero reads can fetch analysis payloads without user-visit PM side effects; the route default still preserves the explicit legacy trigger path.
- Legacy `/api/agents/events` signal-feed polling is debug-only; production and non-debug requests are rejected before generating or reading signal-buffer events.
- Public ticker polling now calls `/api/market/ticker?signalTrigger=0`, so homepage price reads can skip legacy signal-buffer writes while the ticker route default preserves the old signal-generation behavior.
- Frontend legacy analysis polling now also calls `/api/agents/analysis` with `signalTrigger=0`, so homepage analysis reads can reuse cached/current market data without pushing the retired signal buffer.

Remaining work:

- Separate internal cron trigger from public page visit trigger more clearly.
- Add richer trigger audit source-health linkage if needed beyond the existing internal-only `trigger=now` `newsSourceHealth` response.
- Make `trigger=now` verification reliable for staging without accidentally becoming a public behavior.
- Continue watching for self-trigger loops when the A-line page shell changes.

Recommended implementation spec:

- `B3.1` add trigger audit return payload for internal/debug paths.
- `B3.2` add tests for no-trigger and locked-symbol paths.
- `B3.3` document staging trigger procedure.
- `B3.4` lock scheduled cron response boundary for debug-only fields.
- `B3.5` lock partial grounded-analysis params out of user-visit triggering.
- `B3.6` keep trigger-layer news evidence pre-save non-critical.
- `B3.7` normalize trigger-layer symbol matching for pool, explicit-symbol, and news-evidence scoping.
- `B3.7a` keep trigger-layer symbol-less market news anchored to BTC instead of all candidates.
- `B3.7b` keep scheduled batch processing from dropping opportunity symbols before trigger checks.
- `B3.7c` trim pool symbols before scoped market-signal generation.
- `B3.7d` use normalized symbols in trigger-layer market-signal descriptions.
- `B3.8` keep public V9 page dependencies off legacy analysis polling trigger modules.
- `B3.9` lock cron authorization before source-fetch and PM-trigger side effects.
- `B3.10` scope manual `trigger=now` locks by locale.
- `B3.11` let read-only frontend analysis polling opt out of PM generation.
- `B3.12` gate legacy event-feed polling before signal-generation side effects.
- `B3.13` let public ticker polling opt out of legacy signal-buffer writes.
- `B3.14` let read-only frontend analysis polling opt out of legacy signal-buffer writes.

### B4. PM Decision Pipeline Depth

Current status: real PM pipeline exists, but it is still a compressed version of the intended 11-role/6-stage model.

What exists:

- Four analysts: fundamental, news, chart, onchain.
- Two leads: research and risk.
- PM trade decision output.
- Public payload includes `symbol`, `tradeDecision`, `rationaleByMember`, and citations.
- Public payload can include a safe `stageTrace` subset: stage id, status, observed time, and member ids only. Internal labels/notes stay out of the public contract.
- News evidence persistence is inside the PM pipeline failure boundary; if evidence storage is unavailable, the pipeline returns no decision and does not call analyst LLMs or write partial records.
- PM pipeline now advances internal `record_write` and `public_timeline` stage statuses to `done` after those writes complete, then upserts the completed trace back to the decision record.
- The final completed-trace upsert is best-effort after the primary record and public timeline writes succeed, so audit enrichment cannot null out a completed PM decision.
- Internal `trade_decision` stage trace now carries the PM model provider and prompt version; public projection tests confirm these non-public fields are stripped.
- Internal PM stage trace now records non-public stage start/completion timestamps, duration, and compact stage notes; public timeline projection continues to expose only the safe trace subset.
- PM pipeline trims and dollar-strips input symbols before creating record ids, stored record symbols, and public PM payloads.
- TradeDecision validation trims and dollar-strips returned symbols before exposing validated PM decisions.
- PM trade-decision prompts render normalized symbols in both market context and schema examples.

Remaining work:

- Preserve current compressed pipeline for stability.
- Add richer non-public stage timings and skipped-stage reasons beyond the current safe stage status trace.
- Later split into true 11-role architecture only under a separate spec.
- Keep LLM output locale enforcement and safe formatter constraints.

Recommended implementation spec:

- `B4.1` add non-public stage trace to records.
- `B4.1a` complete stage trace write/public timeline statuses after storage writes.
- `B4.1b` attach non-public trade-decision model/provider status and keep it out of public trace.
- `B4.1b.1` attach non-public stage timing and compact notes while keeping them out of public trace.
- `B4.1c` keep evidence persistence failures inside the PM pipeline failure boundary before analyst LLM generation.
- `B4.1d` normalize PM pipeline input symbols before record creation.
- `B4.1e` normalize validated PM decision symbols before storage/projection.
- `B4.1f` normalize PM prompt symbols before LLM generation.
- `B4.2` expose safe subset through public timeline only after adapter tests are updated.
- `B4.3` defer true multi-round debate and 11-role split to Phase B.2 or Phase 6a.

### B5. V9 Adapter Truthfulness

Current status: implemented and tested for real-shaped PM decision mapping.

What exists:

- `mapPublicTimelineEventsToTopics()` maps `pm_decision` events to V9 `DispatchTopic[]`.
- Missing source URLs hide source link.
- Unresolved Stage 6 shows "暂无复盘沉淀，等待结果回写".
- Functional professional role names are enforced in tests.
- Incomplete PM decisions with analyst rationale render as active analysis, not completed or empty.
- The latest strategy order is derived from `tradeDecision.generatedAt`.
- Resolved PM decisions render Stage 6 as completed with a memory-loop message.
- Adapter tests now cover three complete real-shaped decision flows in one V9 market view.
- Source attribution renders only when actual evidence includes an original URL.
- Empty incomplete PM decision events stay pending; incomplete PM decisions only become active when analyst rationale exists.
- Empty pending PM decision events render truthful empty-state copy (`暂无决策更新`) instead of implying active analysis.
- Empty pending PM decision events do not render a fake trader typing message; typing remains reserved for rationale-backed active analysis.
- Legacy or partially written PM events without `rationaleByMember` stay pending instead of crashing the V9 adapter.
- Malformed PM events with non-string or unusable symbols are skipped by the topic aggregator instead of crashing realtime analysis.
- Dollar-prefixed or lowercase PM symbols are normalized before topic grouping, preventing duplicate topics or `$$BTC` display artifacts.
- Legacy decision records without `analystInputs` still project PM decisions with empty rationale/citation maps instead of crashing the public timeline.
- Incomplete or malformed `tradeDecision` objects are treated as unfinished analysis, not as completed strategies.
- Trade decisions with malformed numeric render fields (`entryRange`, `entryPrice`, `stopLoss`, `takeProfit`) also stay in active analysis instead of crashing price formatting.
- V9 title/progress copy follows the renderable trade-decision state, so malformed non-null PM payloads do not read as completed decisions.
- V9 source links are emitted only for trimmed HTTP(S) evidence URLs, so blank or placeholder source values do not become broken public links.
- Public timeline projection now normalizes market-signal and news payload symbols before API exposure, preventing dirty legacy symbols from leaking into downstream V9 data.
- Legacy `/api/watch/history` public mode now returns only projected public events and pagination fields; raw stream entries remain debug-only behind the internal header.
- Legacy `/api/watch/history` public PM projection now uses the same indexed decision records as `/api/watch/timeline`, so stale watch-history metadata cannot override the latest PM decision.
- PM public timeline events now merge top-level evidence ids with member citations and trade-decision evidence ids, so API evidence maps include the source material referenced by analyst rationales.
- PM public timeline events now normalize both top-level payload symbols and nested `tradeDecision.symbol` before API exposure.
- Legacy `/api/watch/stream` raw shared-thread SSE is debug-only; production and non-debug requests are rejected before subscribing to raw thread state.
- Legacy `/api/agents/history` raw generated-message history is debug-only; production and non-debug requests are rejected before reading the legacy history buffer.

Remaining work:

- Keep testing edge cases from staging records, especially missing evidence maps and additional malformed PM payloads.

Recommended implementation spec:

- `B5.1` golden fixtures from three real-shaped records.
- `B5.2` latest strategy marker from newest `tradeDecision.generatedAt`.
- `B5.3` pending and empty state copy audit.
- `B5.4` empty incomplete PM decision stays pending.
- `B5.5` tolerate legacy PM payloads without rationale maps.
- `B5.6` skip malformed PM payloads with non-string symbols.
- `B5.7` normalize dollar-prefixed/lowercase PM symbols before topic grouping.
- `B5.8` tolerate legacy decision records without analyst input arrays.
- `B5.9` require renderable trade-decision fields before marking a V9 topic complete.
- `B5.10` validate trade-decision numeric render fields before V9 price formatting.
- `B5.11` keep title/progress copy in analysis state for malformed PM payloads.
- `B5.12` sanitize evidence source URLs before emitting V9 original links.
- `B5.13` normalize public timeline market/news payload symbols before V9 consumption.
- `B5.14` keep legacy watch history public responses from exposing raw stream entries.
- `B5.15` align legacy watch history public PM projection with the authoritative decision-record index.
- `B5.16` include PM member citation evidence ids in public timeline event evidence maps.
- `B5.17` gate legacy raw watch stream behind the internal debug header.
- `B5.18` gate legacy raw agent history behind the internal debug header.
- `B5.19` keep empty pending PM copy distinct from rationale-backed active analysis copy.
- `B5.20` keep trader typing messages out of empty pending PM records.
- `B5.21` normalize PM payload symbols at the public timeline API boundary.

### B6. Storage, Replay, And Memory Loop

Current status: decision records, replay resolution, projected resolution snapshots, and first-pass memory feedback exist; deeper risk-sizing feedback is not complete.

What exists:

- `StrategyDecisionRecord` has `evaluationWindowEndsAt`, `resolvedAt`, and `resolvedOutcome` fields.
- Public V9 treats unresolved decisions as pending and resolved decisions as completed memory-loop items.
- A source-agnostic decision resolution contract can evaluate TP/SL/expiry from a market-price snapshot.
- Public timeline PM payload can carry resolved outcome and V9 can render Stage 6 when resolution exists.
- Cron replay now attempts to resolve open PM decisions from the current CoinW pool price and writes by record id upsert.
- Resolved records can now persist the observed resolution price and reason; the public timeline and V9 memory-loop copy can show that observed price.
- Resolved records can now persist the market-data source used for the observed resolution price, and the public timeline can project it.
- Topic selection now reads recent resolved decision records and injects a lightweight memory reason into the selection evidence, so the next PM prompt can see recent hit-TP/hit-SL/expired context without changing the V9 layout.
- Team win-rate calculation tests are included in the Watch pipeline gate, keeping the real track-record path covered with PM storage/replay changes.
- Cron replay isolates per-record resolution failures, so one failed record write does not stop later open PM decisions from resolving in the same run.
- Public timeline PM projection treats the indexed `StrategyDecisionRecord` as authoritative over stored watch-history `tradeDecision` metadata when the `recordId` matches, so stale history meta cannot override the latest decision record.
- Decision record storage now strips leading dollar signs during symbol normalization, so `$BTC` records stay in the same BTC read/upsert bucket.
- Legacy replay-to-decision-record conversion now trims and dollar-strips symbols before returning records, keeping replay compatibility aligned with live PM storage/projection normalization.
- Cron replay resolution now trims and dollar-strips open PM record symbols before matching them against the CoinW pool price map.
- Cron replay resolution now falls back to a clean `tradeDecision.symbol` when legacy record-level symbols are unusable, avoiding missed PM outcomes.

Remaining work:

- Turn decision memory from prompt context into explicit PM risk-sizing constraints after the risk model contract is specified.
- Surface user-facing source copy for resolved decisions after the public UI copy is approved.

Recommended implementation spec:

- `B6.1` resolution source contract.
- `B6.2` outcome writer and tests.
- `B6.3` public timeline projection for resolved outcome.
- `B6.4` V9 adapter stage-6 real mapping.
- `B6.5` resolution observed-price projection and V9 memory-loop copy.
- `B6.6` resolution observed-price source projection.
- `B6.7` recent decision memory feedback into topic selection evidence.
- `B6.8` include team win-rate tests in the Watch pipeline gate.
- `B6.9` isolate per-record replay resolution failures inside cron processing.
- `B6.10` prefer matching decision records over stale timeline metadata during public PM projection.
- `B6.11` strip dollar-prefixed symbols before decision-record store bucketing.
- `B6.12` normalize legacy replay symbols before returning decision records.
- `B6.13` normalize open PM record symbols before cron replay price matching.
- `B6.14` fall back to trade-decision symbols for legacy PM resolution matching.

### B7. Follow Stats And Later Real Follow

Current status: follow stats are implemented as social proof and placeholder interaction.

What exists:

- V9 primary button posts to `/api/watch/follow-stats`.
- Client updates follow stats optimistically.
- Cross-tab sync via BroadcastChannel/localStorage event.
- Follow mutation has IP + anon rate limits and route tests cover 429 before incrementing stats.
- Privacy boundary is documented in `docs/adr/0009-follow-stats-privacy.md`: 7-day HTTP-only anon cookie, salted hash storage, short follower-set TTL, and no raw anon id in KV.
- The anon mutation rate-limit key also uses the salted anon hash, so raw anonymous cookie values are not stored in KV keys.
- The IP mutation rate-limit key also uses the salted hash, so raw IP addresses are not stored in persistent follow-stat KV keys.

Remaining work:

- Keep current "not true execution" boundary until Dan approves.
- Add user-facing privacy copy before true public release.
- Later design true CoinW API execution behind authorization, risk confirmation, and compliance review.

Recommended implementation spec:

- `B7.1` follow stats privacy/rate-limit audit.
- `B7.2` signed user authorization plan for real execution.
- `B7.3` true follow execution only after separate Dan approval.
- `B7.4` hash anonymous ids before follower-set storage and mutation rate-limit keys.
- `B7.5` hash IP identifiers before mutation rate-limit keys.

### B8. Internal Verification Preview

Current status: local and preview validation have been standardized in `docs/watch-v9-internal-verification-checklist.md`.

Scope:

- Deploy Vercel preview without `--prod`.
- Run timeline curl with and without fixture mode where relevant.
- Trigger one real PM decision in staging only if KV has no real record.
- Browser-check V9 page for structure, not public polish.

Acceptance:

- `/api/watch/timeline?mode=public&locale=zh_CN&windowMinutes=720` returns expected shape.
- `/api/watch/timeline` rejects invalid `before` / `since` pagination values instead of silently falling back to the current window.
- At least one `pm_decision` can render through V9 adapter in internal preview.
- No public preview URL is handed out as external demo unless it is an A-line candidate.

## 5. Release Semantics

### Internal B Preview

Use for:

- Dan/F/Codex engineering validation.
- Real data verification.
- Trigger and storage checks.
- Adapter truthfulness checks.

Do not use for:

- External user viewing.
- Feedback collection from non-builders.
- Public claims.

### External A Preview

Use for:

- Outside viewer feedback.
- Visual/interaction confirmation.
- Narrative and trust calibration.

Do not use for:

- Validating real data readiness.
- Confirming news source reliability.
- Testing true follow execution.

### Production

Production release remains a third decision gate:

- A-line preview accepted.
- B-line data path verified.
- A+B integration complete.
- Dan explicitly approves production.

## 6. Gates For Future Work

### Standard Local Gates

Run the narrowest useful set first, then full gates before merge:

- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run verify:news`
- `npm run verify:chat-v3-final`
- `npm run verify:a11y` when UI is touched
- `npm run verify:metrics` when analytics/metrics are touched
- Targeted Vitest files for changed modules

### B-Line Required Tests By Area

- Topic selection: `src/lib/team/__tests__/topicSelector.test.ts`
- PM trigger: `src/lib/team/__tests__/pmDecisionTrigger.topicSelector.test.ts`
- PM pipeline: `src/lib/team/__tests__/pmDecisionPipeline.test.ts`
- Topic aggregation: `src/lib/watch/__tests__/topicAggregator.test.ts`
- Timeline projection: `src/lib/watch/__tests__/publicTimelineProjection.test.ts`
- V9 adapter: `src/lib/watch/__tests__/v9TopicAdapter.test.ts`
- Topic intensity: `src/lib/watch/__tests__/intensityCalculator.test.ts`
- Team registry and trade decision validation: `src/lib/team/__tests__/teamRegistry.test.ts`, `src/lib/team/__tests__/tradeDecisionValidator.test.ts`
- Market data and topic pool env wiring: `src/lib/__tests__/marketDataCache.test.ts`
- Legacy replay and team activity boundaries: `src/lib/team/__tests__/strategyHistoryDecisionRecord.test.ts`, `src/lib/team/__tests__/usePipelineReplay.test.ts`, `src/lib/team/__tests__/useTeamActivityStatus.test.ts`
- Retired faction boundaries: `src/lib/team/__tests__/factionRetirement.test.ts`, `src/lib/team/__tests__/i18nFactionFreedom.test.ts`
- Dispatch role mapping and safe message rendering: `src/lib/watch/__tests__/dispatchAgentMapping.test.ts`, `src/lib/watch/__tests__/safeMessageFormatter.test.tsx`
- Team win rates: `src/lib/team/__tests__/computeTeamWinrates.test.ts`
- Decision storage/resolution: `src/lib/team/__tests__/decisionRecordStore.test.ts`, `src/lib/team/__tests__/decisionResolution.test.ts`
- Follow stats: `src/lib/watch/__tests__/followStatsStore.test.ts`, `src/app/api/watch/follow-stats/route.test.ts`
- Timeline projection/auth boundary: `src/lib/watch/__tests__/chatAuthenticityBoundary.test.ts`

## 7. Drift Prevention Checklist

Before starting any new Watch task:

- [ ] Is this A line, B line, or an explicit A+B integration task?
- [ ] If A line: does it avoid live pipeline dependency?
- [ ] If B line: does it preserve the approved V9 layout?
- [ ] If external preview is mentioned: has Dan explicitly approved this as shareable?
- [ ] If Vercel/deploy/push is involved: run deployment identity checks before action.
- [ ] If news sources are touched: confirm env/config without exposing secrets.
- [ ] If real follow/execution is touched: stop unless Dan explicitly authorized true execution.
- [ ] If an exported HTML file is referenced: treat it as review artifact, not source code.
- [ ] If a historical branch looks useful: extract module ideas only, do not merge wholesale.

## 8. Open Decisions

- Which news source keys are actually configured in Preview and Production.
- Whether CryptoPanic is truly sunset or remains standby.
- Whether CoinW can provide an official announcements/feed endpoint.
- Final B-line trigger cadence for cron vs user visit.
- Explicit risk-sizing contract for using prior resolved outcomes.
- Legal/compliance boundary for true follow execution.
- When the next A-line UI/interaction design is frozen for external preview.

## 9. Recommended Next Specs

1. `spec-watch-b1-topic-selection-public-explanation.md`
   - Goal: make real topic selection explainable and repetition-safe without changing V9 layout.
2. `spec-watch-b2-news-source-hardening.md`
   - Goal: verify and harden real news intake, symbol extraction, source attribution, quota/fallback behavior.
3. `spec-watch-b6-memory-loop-resolution.md`
   - Goal: turn stage 6 from pending placeholder into real outcome/replay memory.
4. `spec-watch-a-next-preview-ui-lock.md`
   - Goal: implement the next Dan-confirmed UI/interaction version for external preview only.

## 10. Working Principle

When in doubt:

- UI/public polish belongs to A.
- Data/product truth belongs to B.
- Public sharing belongs to A.
- Internal verification belongs to B.
- Production belongs to Dan's separate release decision.
