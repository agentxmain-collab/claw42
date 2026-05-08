# News Source Evaluation for Claw42 Act 1.5

> Research-only report. Date: 2026-05-06.
> Author: Claude (per task-16-news-source-evaluation.md)

---

## ⚠ Verification flag (read first)

The task spec frames this evaluation around: "CryptoPanic free Developer API discontinued April 1, 2026."

**I could not corroborate that claim from public web sources as of 2026-05-06.**

Multiple 2026 third-party comparisons (altFINS, eakdigital, CoinMarketCap academy, CoinGecko learn) and CryptoPanic's own surface area (API key page `cryptopanic.com/developers/api/keys`, PRO subscription at $9/mo, MCP servers built against the public Developer API in 2026) describe the free Developer API as still active. The CryptoPanic plans page (`cryptopanic.com/developers/api/plans`) is a SPA that renders only behind login — the in-account upgrade banner Dan saw is plausible but might be a paid-tier nudge rather than a hard sunset. The whole "should we pay" decision turns on whether this notice is real.

**Action for Dan:** Before any migration, paste the exact CryptoPanic email/banner text into chat (subject + first 200 chars). If it says "the Developer API will be retired," migrate. If it says "upgrade to PRO for higher limits," the free tier is still alive — just rate-limited.

This report assumes the worst case (free tier truly gone) and gives a multi-source recommendation that is correct either way.

---

## A. Executive Recommendation

**Short-term preview source (no key, immediate use):** RSS aggregation chain over CoinDesk, Cointelegraph, Decrypt feeds. Zero cost, zero auth, ships today. Loses sentiment + votes natively but those can be derived via the DeepSeek/LLM normalization pass that Act 1.5 already runs for caching. Acceptable for News Debate Mode preview as long as Claw42 displays only headlines + summaries (not full article body).

**Production source (paid path):** **CryptoCompare / CoinDesk Data News API** (`/data/news`) — free tier reported as 100k calls/month with 50 req/s, paid tiers reportedly start ~$80/month per third-party 2026 comparisons. It carries the full schema needed (title, url, source, published_on, categories doubling as currency tags), aggregates 150+ crypto sources, and the API key model is straightforward. Note: CoinDesk acquired CryptoCompare; the same API now lives at `min-api.cryptocompare.com` and the new `developers.coindesk.com` portal.

**Fallback source:** **CoinGecko `/news` endpoint** — Demo tier gives 10k credits/month + 30 calls/min, 100+ publishers. Native currency mapping (matches CoinGecko IDs already used in Claw42's market data layer), strong availability, low rate-limit risk. Use as secondary in fallback chain when primary errors or quota nears exhaustion.

**Do not use:**

- **NewsAPI.org** — free tier ToS blocks production deployment (localhost-only) and paid plan jumps to ~$449/mo
- **GNews free** — 100/day too low + non-commercial-only ToS
- **Mediastack free** — 30-min delay kills "debate mode" timeliness
- **The Block API + Messari News + CoinDesk Data Pro** — sales-only pricing, friction high for a feature still in iteration
- **Benzinga premium** without confirmed crypto coverage
- **Raw scraping** of any source that doesn't expose RSS/API

---

## B. Ranked Source Matrix

Pricing date stamps: all rows verified through web search 2026-05-06 unless noted otherwise. "sales-only / unknown" means I could not retrieve a public number.

| Source                        | Type                                   | Free tier                                                                                 | Paid price (low / mid)                                                         | Rate limit                              | Crypto relevance                                 | Symbols/currencies field   | Sentiment/votes field                                          | Latency                       | License/ToS risk                                                  | Implementation effort              | Recommendation index                                 | Source URL                                                                                                                                                     |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------ | -------------------------- | -------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CryptoPanic                   | Crypto-native aggregator API           | Free Developer tier, limits reportedly 50–200 req/h. Discontinuation claim **unverified** | PRO $9/mo or $99/yr (consumer); API enterprise sales-only                      | ~Hourly bucket; 200/page                | Highest — purpose-built                          | `currencies[]` native      | `votes` native (positive/negative/important) + sentiment proxy | ~1–5 min                      | Display permitted with attribution                                | Already integrated in Claw42       | 4 (if free still alive) / 3 (if forced to PRO sales) | https://cryptopanic.com/developers/api/plans                                                                                                                   |
| CryptoCompare / CoinDesk Data | Crypto-native data + news              | Free key reported 100k calls/mo, 50 req/s; CoinDesk free tier 250k lifetime calls         | Reportedly ~$80/mo basic; mid tier ~$200/mo                                    | 50 req/s on free                        | Highest — 150+ crypto sources                    | `categories` ≈ currencies  | Source rep score, no votes                                     | <2 min                        | Attribution required                                              | Medium — adapter + field mapping   | 5                                                    | https://min-api.cryptocompare.com/pricing , https://developers.coindesk.com/pricing/                                                                           |
| CoinGecko News                | Crypto-native                          | Demo: 10k credits/mo, 30 calls/min, 50+ endpoints                                         | Analyst $129/mo, Lite $499/mo (Pro tiers, all endpoints)                       | 30/min free; 500–1000/min paid          | Highest — 100+ publishers                        | Native ID mapping          | Trending tags, no sentiment                                    | <5 min                        | Attribution required                                              | Low                                | 5                                                    | https://www.coingecko.com/en/api/pricing                                                                                                                       |
| CoinMarketCap                 | Crypto-native; news bundled in CMC API | Basic: 10k credits/mo, 30 req/min, personal-use only                                      | Hobbyist $29/mo; Startup ~$79/mo; Standard ~$299/mo; higher Enterprise         | 30/min free                             | Highest                                          | Native                     | Limited                                                        | <2 min                        | Personal-use ToS on free is a blocker for production              | Medium                             | 3                                                    | https://coinmarketcap.com/api/pricing/                                                                                                                         |
| CoinMarketCal                 | Crypto events (not news)               | Free for personal site use                                                                | API: $49.80/mo (upcoming), $89.40/mo (past+upcoming), $179.20/mo (unlimited)   | Per plan                                | High but events-focused, not headlines           | Native coin tag            | Confidence score, votes                                        | Event-based                   | ToS allows commercial on paid                                     | Medium                             | 2 (special-case events feed only)                    | https://coinmarketcal.com/en/api                                                                                                                               |
| CoinDesk RSS                  | Crypto-native RSS                      | Free, no key                                                                              | N/A                                                                            | None published; be polite (poll ≥5 min) | Highest                                          | None native                | None                                                           | <5 min                        | Display headlines + link OK; full-text reproduction not OK        | Low                                | 4                                                    | https://www.coindesk.com/arc/outboundfeeds/rss/                                                                                                                |
| Cointelegraph RSS             | Crypto-native RSS                      | Free, no key                                                                              | N/A                                                                            | None published                          | High                                             | None native                | None                                                           | <5 min                        | Same display posture as CoinDesk                                  | Low                                | 4                                                    | https://cointelegraph.com/rss                                                                                                                                  |
| Decrypt RSS                   | Crypto-native RSS                      | Free, no key                                                                              | N/A                                                                            | None published                          | High                                             | None native                | None                                                           | <10 min                       | Same                                                              | Low                                | 4                                                    | https://decrypt.co/feed                                                                                                                                        |
| The Block API                 | Crypto-native premium news             | None public                                                                               | Sales-only / unknown — bundled with The Block Pro                              | Sales-only                              | Highest, premium reporting                       | Likely native              | Editorial only                                                 | <5 min                        | Strict — premium news                                             | High (sales cycle)                 | 2                                                    | https://www.theblock.co/post/232778/the-block-unveils-real-time-news-api-for-seamless-integration-of-its-sector-specific-coverage-of-crypto-and-digital-assets |
| Messari API                   | Crypto-native data + news              | Free: 20 req/min, attribution required, no redistribution; News not on free               | News access requires Enterprise contact (sales-only)                           | 20/min free                             | Highest                                          | Native asset IDs           | Native sentiment in some endpoints                             | <5 min                        | Strict redistribution rules                                       | High                               | 2                                                    | https://messari.io/pricing                                                                                                                                     |
| Binance Announcements         | Exchange-native                        | Public RSS feed + Square posts; no auth                                                   | N/A                                                                            | Polling expected ≥1 min                 | High for listings/airdrops                       | Manual mapping             | None                                                           | <1 min                        | Display fine; respect link                                        | Low–medium                         | 4 (specialty: listings)                              | https://www.binance.com/en/support/announcement                                                                                                                |
| CoinW Announcements           | Exchange-native                        | Need to confirm public RSS exists                                                         | Likely none / direct partnership                                               | Unknown                                 | High (Claw42 partner)                            | Manual                     | None                                                           | <1 min                        | Same as Binance                                                   | Medium (need partner confirmation) | 4 (politically critical)                             | (no public docs found via web search 2026-05-06)                                                                                                               |
| NewsAPI.org                   | General news                           | Localhost-only free / dev-only                                                            | Business $449/mo; Advanced higher                                              | 100 req/day free dev; 250k+ paid        | Medium (filter by query)                         | Derived from query         | None                                                           | <15 min                       | Free tier blocks production deployment                            | Low                                | 1                                                    | https://newsapi.org/pricing                                                                                                                                    |
| GNews.io                      | General news                           | 100 req/day, 1 req/sec, non-commercial only                                               | Essential ~$49/mo; Plus higher                                                 | Per plan                                | Medium                                           | Derived                    | None                                                           | <15 min                       | Free tier non-commercial blocks Claw42 prod                       | Low                                | 2                                                    | https://gnews.io/pricing                                                                                                                                       |
| NewsData.io                   | General news                           | Free 200 credits/day, 12-hour delay, commercial-allowed                                   | Basic $199.99/mo for 20k credits/mo                                            | Per plan                                | Medium-high (crypto category)                    | Derived + keyword          | Native sentiment field                                         | 12h delay free; <5 min paid   | Free 12-hour delay = unusable for News Debate timeliness; paid OK | Low                                | 3                                                    | https://newsdata.io/pricing-plan-in-newsdata-io/                                                                                                               |
| Mediastack                    | General news                           | Free 500/mo, 30-min delay, non-commercial                                                 | Basic $19.99/mo (10k); Professional $49.99/mo (50k); Business $99.99/mo (250k) | Per plan                                | Low-medium                                       | Keyword filter             | None                                                           | 30 min delay free; live paid  | Free 30-min delay kills debate freshness                          | Low                                | 2                                                    | https://mediastack.com/pricing                                                                                                                                 |
| Marketaux                     | Stocks + crypto + forex news           | Free 100 req/day, limited sentiment tags                                                  | Sentiment plans tiered, annual ~20% off                                        | Per plan                                | Medium-high                                      | Native entity tagging      | Native sentiment (paid tier strong)                            | <5 min                        | Standard attribution                                              | Low-medium                         | 3                                                    | https://www.marketaux.com/pricing                                                                                                                              |
| Finnhub                       | Stocks + forex + crypto news           | Free 60 calls/min including company news + crypto exchanges                               | Paid tiers from $80/mo                                                         | 60/min free                             | Medium (crypto news exists; stock-news strength) | Native ticker              | Native sentiment available on premium                          | <2 min                        | Standard attribution                                              | Medium                             | 3                                                    | https://finnhub.io/pricing                                                                                                                                     |
| Alpha Vantage                 | Markets + News & Sentiment             | Free 25 requests/day, end-of-day only                                                     | Premium $49.99/mo (75/min); Ultra $149.99/mo (300/min); Enterprise custom      | Per plan                                | Medium (crypto topics included)                  | Topic + ticker tags native | Native sentiment scores per article                            | EOD free; near-real-time paid | Standard attribution                                              | Medium                             | 3                                                    | https://www.alphavantage.co/premium/                                                                                                                           |
| Polygon.io                    | Markets API with news                  | Stocks Basic free with limited calls                                                      | Starter $29/mo unlimited stocks news; higher tiers $99–$500/mo                 | Per plan                                | Low for crypto-native news (stocks-first)        | Ticker-based               | Light                                                          | <5 min                        | Standard                                                          | Medium                             | 2                                                    | https://polygon.io/                                                                                                                                            |
| Benzinga                      | Premium financial news                 | Basic free tier exists via AWS Marketplace                                                | Premium tiers — sales contact (no public price)                                | Per plan                                | Medium (crypto coverage variable)                | Ticker                     | Sentiment in premium                                           | <2 min                        | Strict redistribution                                             | High (sales cycle)                 | 2                                                    | https://www.benzinga.com/apis/data/                                                                                                                            |

---

## C. Per-source Detailed Notes

**1. CryptoPanic.** Endpoint `https://cryptopanic.com/api/developer/v2/posts/`, auth via `auth_token` query parameter. Free Developer tier historically reported 50–200 req/h (1 page per request, up to 200 results). PRO consumer subscription is $9/month — this is the website premium, not API access. Fields native to NewsItem: `id`, `title`, `url`, `source.title`/`source.domain`, `published_at`, `currencies[]` (with `code`/`title`/`slug`), and `votes` (positive/negative/important/liked/disliked). `sentiment` is _not_ a per-article field — it must be derived from votes (positive>negative => positive). Excellent fit for News Debate Mode because votes already encode community-debate signal natively. **Caveat: discontinuation claim unverified above.** Pros: tightest schema match, lowest implementation churn (already integrated). Cons: opaque rate-limit ceiling, single point of failure if Dan's email is real, enterprise pricing not public.

**2. CryptoCompare / CoinDesk Data.** Endpoint `https://min-api.cryptocompare.com/data/v2/news/?lang=EN`, auth via `api_key` query param or `Authorization` header. Free key reported 100k calls/month with 50 req/s (third-party 2026 sources), CoinDesk-portal free tier described as 250k lifetime calls. Field mapping: `id` (`id`/`guid`), `title`, `url`, `source` (`source_info.name`), `sourceDomain` (`source_info.img` host), `publishedAt` (`published_on`), `currencies` (derived from `categories[]` + body NER), `sentiment` not native — but `upvotes`/`downvotes`/`source_info.lang` provide proxy and the API exposes a normalized `categories` taxonomy (`BTC`, `ETH`, `MARKET`, `REGULATION`, etc.). Paid tier reported ~$80/mo basic, ~$200/mo mid tier. Pros: cleanest schema after CryptoPanic, strong free quota even for high cadence, enterprise-grade uptime since CoinDesk acquisition. Cons: `categories` ≠ currencies one-to-one, votes weaker than CryptoPanic.

**3. CoinGecko News.** Endpoint `https://pro-api.coingecko.com/api/v3/news` (Pro/Demo) — note the news endpoint historically requires the Pro/Demo key, not the legacy public free key. Demo key gives 10k monthly credits + 30 calls/min. Field mapping: `title`, `url`, `description`, `author`, `news_site` => `source`, `thumb_2x` => image, `updated_at` => `publishedAt`. Currencies are not native on this endpoint and would need keyword/title mapping or fallback to `/coins/{id}/contract`-style enrichment. No sentiment, no votes. Paid tiers: Analyst ~$129/mo, Lite ~$499/mo, with much higher rate limits. Pros: Claw42 already uses CoinGecko prices, so adding news = familiar domain + same coin ID space; redundancy with our existing market data is high. Cons: thin metadata (no votes, no sentiment), credit-based budgeting forces careful counting.

**4. CoinMarketCap.** Endpoint `https://pro-api.coinmarketcap.com/v1/content/latest`, auth via `X-CMC_PRO_API_KEY` header. Free Basic plan = 10k credits/month + 30 req/min, but the **personal-use ToS rules out commercial deployments like Claw42** without upgrading. Hobbyist $29/mo lifts the personal-use restriction, Startup ~$79/mo adds endpoints. Field mapping: `title`, `slug`/`source_url`, `news_type`, `subjects[]` (currencies), `released_at`. Pros: same coin ID space across price + news; Hobbyist tier is cheap. Cons: crypto news endpoint less mature than CryptoCompare; 30 req/min ceiling is tight on free.

**5. CoinMarketCal.** This is _events_, not headlines (token unlocks, listings, mainnet launches, governance votes). Endpoint `https://developers.coinmarketcal.com/v1/events`. Free for personal/site embed, API plans $49.80–$179.20/mo. Field mapping: `id`, `title`, `coins[]`, `date_event`, `proof` URL, `vote_count`, `confidence`. `sentiment` doesn't apply; `votes` exists. Pros: highest signal-to-noise for "what's about to move a coin." Cons: not a news headlines feed — fits a separate Claw42 surface ("upcoming catalysts") not News Debate Mode.

**6. CoinDesk RSS.** `https://www.coindesk.com/arc/outboundfeeds/rss/`. Free, no key, no documented rate limit (poll politely at ≥5 min cadence to avoid being blocked). Standard RSS 2.0 with `<title>`, `<link>`, `<pubDate>`, `<description>`, `<dc:creator>`, `<category>`. Currencies, sentiment, votes — all derived. Pros: zero-cost preview. Cons: no native currency tagging means LLM normalization runs every cycle, which costs Act 1.5's DeepSeek budget.

**7. Cointelegraph RSS.** `https://cointelegraph.com/rss` plus tag-specific feeds (e.g. `/rss/tag/defi`, `/rss/tag/bitcoin`). Free, no key. Same caveats as CoinDesk RSS. Tag feeds give us cheap currency-targeted streams (we can poll BTC, ETH, SOL feeds individually instead of mass-filtering).

**8. Decrypt RSS.** `https://decrypt.co/feed` plus topic feeds (`/news/cryptocurrency`, `/news/nft`, `/news/technology`). Free, no key. ~120 articles/week according to Feedspot 2026. Same caveats; useful as third RSS in fallback chain to reduce single-publisher bias.

**9. The Block API.** Endpoint not publicly documented; access via The Block Pro subscription, which is sales-led. The Block announced a real-time News API in 2024. Pricing not public. Pros: highest editorial quality. Cons: sales friction, almost certainly $$$$, redistribution restrictions strict.

**10. Messari.** Free tier 20 req/min, attribution required, **no redistribution** in ToS. News-specific endpoints require contacting `api@messari.io` for Enterprise. Pros: deep institutional metadata. Cons: News access gated behind sales, redistribution clause is hostile to a public-facing news widget.

**11. Binance Announcements.** Public RSS-style feed and Binance Square endpoints described in dev forum thread `dev.binance.vision/t/announcement-api-rss-feed/2478`. Free, no auth. Field mapping: `title`, `link`, `pubDate`, plus category tags (Listings/Airdrops/Maintenance). Pros: catches the listing-pump signal that CryptoPanic and CryptoCompare often miss by minutes. Cons: only one exchange's voice — needs combining with others for balance.

**12. CoinW Announcements.** No public RSS feed surfaced in web search 2026-05-06. Need Dan to confirm with CoinW BD/dev whether `coinw.com/support/announcement` exposes RSS, or whether internal CoinW provides Claw42 a partner feed. Pros: politically critical (Claw42 ↔ CoinW partnership; this is a story Dan can tell internally). Cons: needs partner confirmation — not a code-side problem, an org-side ask.

**13. NewsAPI.org.** Endpoint `https://newsapi.org/v2/everything?q=crypto`. Free Developer tier is **localhost-only and explicitly forbids staging/production**. Business plan jumps to $449/mo. Field mapping: `title`, `url`, `source.name`, `publishedAt`, no currencies, no sentiment, no votes. Pros: massive source coverage. Cons: free tier is unusable for Claw42; pricing cliff is steep.

**14. GNews.io.** Endpoint `https://gnews.io/api/v4/search?q=crypto&token=KEY`. Free 100 req/day, 1 req/sec, non-commercial only. Paid tiers exist starting around $49/mo. Pros: simple. Cons: 100/day < Claw42 low band (8.6k/mo), and non-commercial ToS blocks any production use.

**15. NewsData.io.** Endpoint `https://newsdata.io/api/1/crypto`. Free 200 credits/day, **12-hour content delay** on free, commercial use allowed. Basic $199.99/mo lifts the delay and gives 20k credits/mo (each credit = 50 articles per request, generous). Field mapping: `article_id`, `title`, `link`, `source_id`, `pubDate`, `keywords[]` (≈ currencies), `sentiment`, `sentiment_stats`. Pros: native sentiment + crypto-specific endpoint + commercial OK on free. Cons: 12-hour delay on free = unusable for News Debate; $200/mo entry is a real bite.

**16. Mediastack.** Endpoint `http://api.mediastack.com/v1/news?keywords=crypto`. Free 500 req/mo with 30-min delay and HTTP-only. Basic $19.99/mo (10k req, live + HTTPS), Professional $49.99/mo (50k), Business $99.99/mo (250k). Pros: cheap paid tiers. Cons: 30-min delay on free + non-commercial = both blockers; "general news with keyword filter" is weaker than crypto-native sources for our debate use case.

**17. Marketaux.** Endpoint `https://api.marketaux.com/v1/news/all?industries=Cryptocurrency`. Free 100 req/day; paid plans tiered. Field mapping: `uuid`, `title`, `url`, `source`, `published_at`, `entities[]` with native `symbol`/`industry` tagging, `sentiment_score` per entity. Pros: native per-entity sentiment is rare and exactly what News Debate Mode wants. Cons: 100/day free is below low band; paid tier pricing not transparent on public page snippet.

**18. Finnhub.** Endpoint `https://finnhub.io/api/v1/news?category=crypto`. Free 60 calls/min, includes `company-news` and crypto category. Paid from $80/mo. Field mapping: `id`, `headline`, `summary`, `url`, `source`, `datetime`, `category`, `related` (ticker), `sentiment` available on premium. Pros: 60/min free is plenty for low band; ticker-mapped. Cons: stock-news strength > crypto-news depth; multilingual weak.

**19. Alpha Vantage News & Sentiment.** Endpoint `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=blockchain&tickers=CRYPTO:BTC`. Free 25 req/day, EOD only. Premium $49.99/mo (75 req/min), Ultra $149.99/mo (300 req/min). Field mapping: `title`, `url`, `source`, `time_published`, `topics[]`, `ticker_sentiment[]` with per-ticker `sentiment_score` and `sentiment_label`. Pros: native ticker-level sentiment is best in class. Cons: free is too anemic; premium is reasonable but stock-news bias.

**20. Polygon.io.** Endpoint `https://api.polygon.io/v2/reference/news`. Free Stocks Basic; Starter $29/mo unlimited stock news; higher tiers $99+/mo. Crypto news coverage is thin compared to crypto-native sources. Pros: cheap and reliable. Cons: not crypto-first.

**21. Benzinga.** Free Basic financial news API tier exists via AWS Marketplace; premium tiers contact-sales. Field mapping: `id`, `title`, `body`, `created`, `tickers`. Crypto coverage variable. Pros: AWS Marketplace removes some procurement friction. Cons: redistribution restrictions strict, premium pricing non-public.

---

## D. Recommended Architecture

**Pick: 4 — Hybrid (paid primary + RSS/public fallback)**

```
┌─────────────────────────────────────────────────┐
│ Claw42 News Debate Mode (server-side adapter)   │
│                                                 │
│   Primary  ──►  CryptoCompare /data/news        │
│       ↓           (free 100k/mo or ~$80/mo)     │
│   Fallback ──►  CoinGecko /news                 │
│       ↓           (free 10k credits/mo)         │
│   Fallback ──►  CoinDesk + Cointelegraph + Decrypt RSS │
│                   (free, no auth)               │
│   Specialty ──►  Binance Announcements RSS      │
│                  CoinW Announcements (TBD)      │
│   Optional ──►  CoinMarketCal events            │
│                                                 │
│   Normalizer: DeepSeek pass adds                │
│     sentiment + currencies[] when missing       │
│                                                 │
│   Cache: server-side, TTL by usage band         │
│     Low band 5min / Medium 3min / High 1min     │
└─────────────────────────────────────────────────┘
```

**Why this and not single paid:** News Debate Mode's value is _plurality of voices_. A single paid feed (even CryptoPanic) gives one editorial lens. A crypto-native primary + RSS fallback chain + Binance/CoinW announcements gives the debate genuine multi-source spread. We also dodge single-vendor risk — exactly the situation that triggered this evaluation.

**Why CryptoCompare as primary and not CryptoPanic:** Two reasons. (1) The CryptoPanic discontinuation question is unresolved, and migrating off our current single-source dependency is the strategic move regardless. (2) CryptoCompare's 100k/mo free quota covers the medium band (14.4k calls/mo) ~7x over with breathing room, whereas CryptoPanic's reported 50–200 req/h ceiling forces caching gymnastics on the high band.

**Why DeepSeek normalizer:** Already in Act 1.5 stack. Adding a thin pass that derives `sentiment` (from headline + body) and `currencies[]` (from NER over title + body) when source doesn't supply native fields means RSS chain output becomes type-compatible with the NewsItem schema. Cost is bounded — only triggered for items missing fields.

---

## E. Migration Plan (no code, just plan)

### New adapter files

- `src/lib/news/adapters/cryptocompare-adapter.ts` — primary
- `src/lib/news/adapters/coingecko-news-adapter.ts` — first fallback
- `src/lib/news/adapters/rss-adapter.ts` — generic RSS parser used by CoinDesk, Cointelegraph, Decrypt
- `src/lib/news/adapters/binance-announcements-adapter.ts` — specialty
- `src/lib/news/adapters/coinw-announcements-adapter.ts` — specialty (after Dan confirms feed)
- `src/lib/news/normalizer.ts` — DeepSeek pass for sentiment + currencies derivation when missing
- `src/lib/news/source-chain.ts` — orchestrator that runs primary, falls through on error/quota
- Keep `cryptopanic-adapter.ts` in place (frozen, behind feature flag) until Dan's verification resolves

### Environment variables

- Add: `CRYPTOCOMPARE_API_KEY`
- Add: `COINGECKO_DEMO_KEY` (or `COINGECKO_PRO_KEY` if Dan upgrades)
- Add: `NEWS_PRIMARY_SOURCE` (= `cryptocompare` | `cryptopanic` | `coingecko`) — runtime switch for emergency rollback
- Add: `NEWS_FALLBACK_CHAIN` (comma-separated source IDs in order)
- Keep: `CRYPTOPANIC_API_KEY` (don't delete; toggle off via `NEWS_PRIMARY_SOURCE` if needed)

### Cache changes

- Adopt usage-band → TTL mapping: low cadence → 5 min TTL, medium → 3 min, high → 1 min
- Add per-source cache namespace so a CryptoCompare-fetched item doesn't pollute the CoinGecko bucket
- Add a 30-second negative cache on rate-limit errors so we don't hammer a 429-ing source mid-fallback

### CSP (next.config.mjs `connect-src`)

- Add `https://min-api.cryptocompare.com`
- Add `https://api.coingecko.com` (or `pro-api.coingecko.com`)
- Add `https://www.coindesk.com` (RSS host)
- Add `https://cointelegraph.com`
- Add `https://decrypt.co`
- Add `https://www.binance.com`
- Add CoinW announcement host once confirmed
- Keep `https://cryptopanic.com` while CryptoPanic is on standby

### Analytics / monitoring

- Add per-source success/failure counter (PostHog event or in-memory ring buffer)
- Add quota-burn meter for paid sources (monthly credits consumed, alert at 80%)
- Surface "served-by" source name in dev panel so we can see fallback events live

### Mock fallback

- Update `mocks/news-mock.json` to match the unified NewsItem schema produced by the chain (not the CryptoPanic-specific shape)
- Add fixture for "all sources offline" path so the UI degrades gracefully

### Verification steps

1. **Verify CryptoPanic notice with Dan** — paste exact email/banner text first, before any code change
2. **First-article check** — fetch one CryptoCompare item end-to-end, log the normalized NewsItem, confirm every field maps as designed
3. **Fallback drill** — manually break the CryptoCompare key in staging, confirm CoinGecko picks up
4. **Quota drill** — simulate 429 from primary, confirm RSS chain takes over within one render cycle
5. **CSP drill** — load News Debate page in staging with strict CSP enabled, confirm no console violations
6. **i18n drill** — News Debate Mode runs on `[locale]` route; confirm RSS items don't break ar_SA RTL layout (long English titles, no native translation)
7. **Cache hit-rate measurement** — over a 2-hour staging window, confirm hit rate ≥70% at 3-min cadence to validate the budget assumption

---

## F. Open Questions for Dan

1. **Is the CryptoPanic discontinuation real?** Paste the exact email subject + first 200 chars of the announcement. Public web sources don't corroborate it as of 2026-05-06. If it's just an upgrade nudge, the migration urgency drops sharply and we keep CryptoPanic as primary while still adding fallback.

2. **Monthly budget ceiling for news sources?** Are we comfortable with $0 (free tiers only), <$100/mo (CryptoCompare basic + safety margin), <$500/mo (real production grade with sentiment APIs like Marketaux Pro or Alpha Vantage Premium added), or do we have room for the $500+/mo tier (Polygon/Benzinga premium, CoinGecko Lite)?

3. **Is RSS display ToS acceptable for Claw42 product preview?** RSS feeds explicitly grant headline + link display rights; full body reproduction is out. News Debate Mode displays headlines + Claw42-side debate commentary, so we should be fine — but confirm the product team knows we're displaying summaries, not full articles.

4. **Should CoinW announcements be prioritized?** Claw42 partners with CoinW. Surfacing CoinW listing/announcement signals first in News Debate Mode is a political win regardless of pure data quality. If yes, Dan needs to ask CoinW BD whether `coinw.com/support/announcement` has an RSS feed or whether they can provide Claw42 a partner JSON endpoint.

5. **Production needs Chinese-language sources, or is LLM-side translation acceptable?** Claw42 supports zh_CN/zh_TW. CryptoCompare and CoinGecko are English-first. If Chinese-native crypto news is required, we need to add Jinse (`jinse.cn`), 8btc (`8btc.com`), or PANews (`panewslab.com`) — none of which expose clean public APIs and would require RSS or scraping. If LLM-translation of English headlines is acceptable, we already have DeepSeek in the pipeline.

6. **Does News Debate Mode need historical search?** Free tiers of CoinGecko/CryptoCompare give 1 year of history; CoinDesk free tier gives 365-day daily / 7-day hourly. If we need deeper history (e.g. "what did the news say about XRP a year ago?"), that pushes us toward paid tiers regardless of which provider.

---

## G. Verdict on CryptoPanic Paid Plan

**No** — do not pay for CryptoPanic Enterprise/API plan **at this stage**, but keep CryptoPanic in the chain for now.

Supporting bullets:

- The discontinuation claim is unverified from public 2026 sources as of 2026-05-06. Paying based on an unverified email/banner is premature; the rational move is to verify the notice text first, and in parallel remove the single-source dependency that made this question stressful in the first place.

- CryptoPanic's API enterprise pricing is sales-only — no public price, no public quota table. That alone means we can't budget around it confidently. CryptoCompare/CoinDesk Data and CoinGecko both give us transparent quota-and-price grids; that transparency is worth more in iteration phase than CryptoPanic's superior schema.

- Strategic posture: News Debate Mode's value proposition is _multi-source debate_. A News Debate built on one feed is brittle product-wise as well as vendor-wise. The right architecture (hybrid chain) is the right call regardless of CryptoPanic's pricing decision — paying CryptoPanic doesn't fix the single-source flaw.

- CryptoPanic's strongest unique value (`votes` field encoding community-debate signal) is exactly the thing News Debate Mode wants. So: keep CryptoPanic as a _secondary_ source in the chain — its votes feed as a debate-signal supplement on top of CryptoCompare/CoinGecko's broader coverage. Use the free tier (if Dan confirms it stays) or skip it (if confirmed killed). Don't pay enterprise to make it primary.

- If Dan verifies that the free Developer API really is dead and CryptoPanic becomes paid-only, the Enterprise tier still doesn't beat the hybrid architecture on cost, redundancy, or schema diversity. The chain replaces CryptoPanic; the chain doesn't _upgrade_ CryptoPanic.

---

## Sources

- [CryptoPanic API Plans page](https://cryptopanic.com/developers/api/plans)
- [CryptoPanic API About / docs](https://cryptopanic.com/developers/api/about)
- [CryptoPanic Pro consumer page](https://cryptopanic.com/pro/)
- [CryptoCompare News API pricing page](https://min-api.cryptocompare.com/pricing)
- [CoinDesk Data API pricing](https://developers.coindesk.com/pricing/)
- [CoinGecko API pricing](https://www.coingecko.com/en/api/pricing)
- [CoinGecko News endpoint docs](https://docs.coingecko.com/reference/news)
- [CoinMarketCap API pricing](https://coinmarketcap.com/api/pricing/)
- [CoinMarketCal API page](https://coinmarketcal.com/en/api)
- [CoinDesk RSS feed URL](https://www.coindesk.com/arc/outboundfeeds/rss/)
- [Cointelegraph RSS feed](https://cointelegraph.com/rss)
- [Decrypt feed](https://decrypt.co/feed)
- [The Block News API announcement](https://www.theblock.co/post/232778/the-block-unveils-real-time-news-api-for-seamless-integration-of-its-sector-specific-coverage-of-crypto-and-digital-assets)
- [Messari pricing + permissions](https://messari.io/pricing)
- [Binance Announcements](https://www.binance.com/en/support/announcement)
- [Binance dev forum announcement RSS thread](https://dev.binance.vision/t/announcement-api-rss-feed/2478)
- [NewsAPI.org pricing](https://newsapi.org/pricing)
- [GNews.io pricing](https://gnews.io/pricing)
- [NewsData.io pricing plans](https://newsdata.io/blog/pricing-plan-in-newsdata-io/)
- [Mediastack pricing](https://mediastack.com/pricing)
- [Marketaux pricing](https://www.marketaux.com/pricing)
- [Finnhub pricing](https://finnhub.io/pricing)
- [Alpha Vantage Premium pricing](https://www.alphavantage.co/premium/)
- [Polygon.io home/pricing](https://polygon.io/)
- [Benzinga API data products](https://www.benzinga.com/apis/data/)
- [altFINS 11 Best Crypto APIs 2026](https://altfins.com/knowledge-base/best-crypto-api-in-2026/)
- [eakdigital Top 10 Crypto News APIs 2026](https://eakdigital.com/top-10-crypto-news-apis-real-time-data-for-trading/)
- [CoinMarketCap Best Free Crypto API 2026 comparison](https://coinmarketcap.com/academy/article/best-free-crypto-api-in-2026-free-tier-comparison)
