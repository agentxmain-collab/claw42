# Claw 42 Analytics Plan

## Phase 0: Lightweight Tracking

Goal: see basic landing-page behavior without adding an analytics SDK, cookies, user IDs, or a database.

Data sink: `/api/analytics` writes anonymous structured events to Vercel logs with `type=claw42_analytics`.

Current events:

| Event | Trigger | Key properties |
| --- | --- | --- |
| `page_view` | Locale page renders | `locale` |
| `hero_cta_copy` | Hero primary CTA copies install command | `locale`, `surface` |
| `hero_api_docs_click` | Hero secondary CTA outbound click | `locale`, `surface` |
| `quick_start_copy` | Quick Start terminal copy button | `locale`, `surface` |
| `daily_prompt_copy` | Daily report input copy | `locale`, `surface` |
| `daily_cta_copy` | Daily report CTA copies subscription prompt | `locale`, `surface` |
| `locale_dropdown_open` | Header language menu opens | `locale` |
| `locale_select` | User selects a language | `from`, `to` |
| `skill_card_click` | Skill ecosystem outbound CTA click | `locale`, `skill`, `index` |
| `back_to_top_click` | Disclaimer logo back-to-top click | `locale` |

Default context attached by the client:

- path
- referrer origin + path
- viewport size
- browser language
- UTM params when present

Privacy constraints:

- no cookie or localStorage identifiers
- no IP logging in app payload
- no raw full referrer query string
- bounded event names, property keys, and value lengths

## Phase 1: Funnel Dashboard

Move from Vercel logs to a product analytics tool once traffic is meaningful.

Recommended event funnel:

1. `page_view`
2. `hero_cta_copy` or `daily_cta_copy`
3. downstream install / skill activation event
4. API key creation
5. first successful Agent action

Recommended dimensions:

- locale
- traffic source / campaign
- CTA surface
- device type
- skill category

## Phase 2: Activation And Retention

When the product has a backend identity layer, add server-side events:

- `skill_install_started`
- `skill_install_completed`
- `coinw_connected`
- `api_key_created`
- `agent_daily_report_subscribed`
- `agent_trade_action_created`
- `agent_trade_action_executed`
- `agent_error_seen`

Core metrics:

- landing CTA copy rate
- install completion rate
- connect-to-CoinW rate
- first Agent action rate
- 7-day active Agent users
- repeat daily report usage

## Phase 3: Experimentation

Use stable experiment IDs and attach them to all tracked events:

- hero headline variant
- hero CTA wording
- daily report CTA wording
- language order
- skill-card ordering
- campaign landing variant

Decision rule: compare conversion through the full funnel, not only top-level click rate.
