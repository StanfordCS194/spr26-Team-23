<img src="public/tunnel-logo.svg" alt="Tunnel logo" width="96" height="96" />

# Tunnel

**See how AI sees you.**

Tunnel is an AI visibility intelligence prototype. It helps founders and marketers understand how assistants like ChatGPT, Claude, and Gemini mention, rank, and describe their company when real users ask discovery and comparison questions.

The app simulates realistic customer prompts, runs multi-model AI responses, analyzes visibility versus competitors, and surfaces actionable insights in a dashboard — including an optional **llms.txt** draft to improve how AI crawlers learn about your brand.

---

## Table of contents

- [What Tunnel does](#what-tunnel-does)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [User flow](#user-flow)
- [Pages and routes](#pages-and-routes)
- [API reference](#api-reference)
- [Analysis modes](#analysis-modes)
- [Multi-model support](#multi-model-support)
- [Demo mode](#demo-mode)
- [Report storage](#report-storage)
- [llms.txt generator](#llmstxt-generator)
- [Authentication (Clerk)](#authentication-clerk)
- [Database (Prisma + PostgreSQL)](#database-prisma--postgresql)
- [Caching and rate limits](#caching-and-rate-limits)
- [Analytics (PostHog)](#analytics-posthog)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Limitations](#limitations)

---

## What Tunnel does

1. **Prompt generation** — Creates realistic customer questions across five categories: discovery, comparison, use case, niche, and purchase intent.
2. **Multi-model Q&A** — Sends those prompts to one or more AI providers (Gemini, GPT-4o, Claude) and collects answers.
3. **Visibility analysis** — Detects whether your company is mentioned, where it ranks versus competitors, sentiment, missed opportunities, and possible inaccuracies.
4. **Dashboard** — Presents scores, category breakdowns, competitor share-of-voice, recommendations, and per-prompt raw responses.
5. **llms.txt draft** — Generates a publishable markdown document grounded in your homepage and audit results.

---

## Quick start

**Prerequisites:** Node.js 20.19+ (or 22.12+), [pnpm](https://pnpm.io/) 9.15.4.

```bash
cd app
pnpm install
cp .env.example .env.local
# Fill in Clerk keys, DATABASE_URL, and at least GEMINI_API_KEY (optional for demo mode)
pnpm prisma:deploy   # apply migrations to your Postgres database
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**Without API keys:** click **Use Demo Data** on the home page to load a complete Wine Find report with no external calls.

---

## Environment variables

Copy `.env.example` to `.env.local`. All variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for client-side auth |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key for server-side auth |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | Sign-in route (`/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | Sign-up route (`/sign-up`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Yes | Redirect after sign-in (e.g. `/dashboard`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Yes | Redirect after sign-up (e.g. `/dashboard`) |
| `DATABASE_URL` | Yes* | PostgreSQL connection string for report history |
| `GEMINI_API_KEY` | Recommended | Prompt generation, analysis, llms.txt drafting |
| `OPENAI_API_KEY` | Optional | Enables GPT-4o in multi-model analysis |
| `ANTHROPIC_API_KEY` | Optional | Enables Claude in multi-model analysis |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional | Product analytics (disabled if unset) |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional | PostHog host (defaults to `https://us.i.posthog.com`) |
| `SHADOW_DATABASE_URL` | Optional | Local dev only — Prisma migrate shadow DB |

\*Required for signed-in report history. Demo mode and localStorage-only reports work without a database, but `/reports` and server persistence will fail.

**Model note:** Gemini uses `gemini-3-flash-preview` (hardcoded in `lib/gemini.ts`). GPT-4o and Claude Sonnet 4.6 are used when their respective API keys are set.

---

## User flow

```
Sign in → Configure company → Generate prompts → Run analysis → Dashboard
                                                                    ↓
                                              Export PDF / llms.txt / view history
```

1. **Sign in** via Clerk (required to generate prompts or run analysis).
2. **Configure** company name, website, description, category, and competitors. Company autocomplete uses Clearbit and Brandfetch; optional auto-competitor generation uses Gemini.
3. **Generate prompts** — calls `POST /api/generate-prompts`. Edit, add, or delete prompts in the preview panel.
4. **Choose analysis mode** — Standard (faster, batched) or Web (live web search with citations, max 15 prompts).
5. **Run analysis** — calls `POST /api/analyze-prompts`. Typically 15–30 seconds.
6. **View dashboard** — report saved to `localStorage` and (best-effort) Postgres. Navigate to `/dashboard`.
7. **Optional actions** — export PDF, generate llms.txt draft, browse past reports at `/reports`.

---

## Pages and routes

| Route | Auth | Description |
|-------|------|-------------|
| `/` | Public (actions require sign-in) | Landing page and audit setup form |
| `/dashboard` | Protected | Full visibility report |
| `/reports` | Protected | Report history (last 50) |
| `/sign-in` | Public | Clerk sign-in |
| `/sign-up` | Public | Clerk sign-up |

Protected routes are enforced in `proxy.ts` via Clerk middleware.

---

## API reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/generate-prompts` | POST | Clerk + rate limit | Generate 5–50 customer prompts |
| `/api/analyze-prompts` | POST | Clerk + rate limit | Run multi-model Q&A and analysis |
| `/api/reports` | GET | Clerk | List user's saved reports |
| `/api/reports` | POST | Clerk | Persist a completed report |
| `/api/reports/latest` | GET | Clerk | Fetch most recent report |
| `/api/enrich-company` | POST | Public | Enrich company metadata via DuckDuckGo |
| `/api/generate-llms-txt` | POST | Public | Generate llms.txt-style markdown draft |

**Rate limits** (authenticated users): 30 req/min for prompt generation, 12 req/min for analysis. Unauthenticated requests to protected endpoints return 401.

Responses include `X-RateLimit-*` headers; 429 responses include `Retry-After`.

---

## Analysis modes

| | **Standard** | **Web** |
|---|-------------|---------|
| Prompt limit | Up to 50 | Max 15 |
| Answer strategy | Batched JSON (Gemini) or per-prompt (GPT-4o / Claude) | Per-prompt web search on all configured models |
| Citations | None | Extracted from provider grounding metadata |
| Use when | Faster bulk audits | You need live web-grounded answers with sources |

Both modes use Gemini for structured analysis when `GEMINI_API_KEY` is set; otherwise a deterministic local fallback runs.

---

## Multi-model support

When multiple provider API keys are configured, analysis runs **in parallel** across:

| Model | Provider | API key |
|-------|----------|---------|
| Gemini 3 Flash (preview) | Google | `GEMINI_API_KEY` |
| GPT-4o | OpenAI | `OPENAI_API_KEY` |
| Claude Sonnet 4.6 | Anthropic | `ANTHROPIC_API_KEY` |

The dashboard shows model tabs when more than one model returns results. Aggregate stats in the API response come from the first configured model.

Prompt generation always uses Gemini (or deterministic templates without a key).

---

## Demo mode

Click **Use Demo Data** on the home page — no API calls, no sign-in required for viewing (though generating your own analysis requires sign-in).

**Demo company profile:**

| Field | Value |
|-------|-------|
| Company | Wine Find |
| Website | winefind.ai |
| Category | wine apps / restaurant wine decision tools |
| Description | Helps users compare restaurant and liquor store wine prices with market prices and choose better-value wines. |
| Competitors | Vivino, CellarTracker, Delectable |
| Prompts | 20 pre-built across all five categories |

**What the demo shows:**

- Moderate overall visibility with Vivino dominating discovery prompts
- Strong performance on niche and pricing-related queries
- Clear missed opportunities where competitors win
- Sample possible inaccuracies on select prompts

Visiting `/dashboard` without a stored report also loads this demo with a banner linking back to run your own analysis.

---

## Report storage

Reports are stored in two layers:

1. **localStorage** (`tunnel-latest-report`) — immediate client-side cache after analysis or demo mode. Dashboard reads this first.
2. **PostgreSQL** (via Prisma) — persisted when signed in; powers `/reports` history and cross-session recovery.

Resolution order on dashboard load: localStorage → latest DB report → demo fallback.

---

## llms.txt generator

From the dashboard, click **AI visibility draft** to open the llms.txt panel.

**Pipeline:**

1. Fetch homepage HTML (scripts/styles stripped, SSRF-safe, size-capped)
2. Fetch existing `/llms.txt` if published on the site
3. Build an offline template from audit data
4. If `GEMINI_API_KEY` is set, Gemini merges homepage content, existing file, and audit JSON into publishable markdown
5. On failure or missing key, return the offline template with a fallback note

**Client features:** copy markdown, download `.txt` file, compare generated vs template draft, regenerate, in-session cache.

The route uses `maxDuration = 60` and Node.js runtime for long-running fetch + generation on serverless platforms.

See [llmstxt.org](https://llmstxt.org/) for the publishing convention.

---

## Authentication (Clerk)

Clerk provides sign-in/sign-up UI in the global header and custom pages at `/sign-in` and `/sign-up`.

**Protected by middleware (`proxy.ts`):**

- `/dashboard` and `/reports` pages
- Core API routes use server-side Clerk auth checks (`lib/api-security.ts`)

**Public endpoints:** `/api/enrich-company`, `/api/generate-llms-txt`

Sign-in is required to generate prompts, run analysis, and access report history. Demo mode bypasses analysis API calls entirely.

---

## Database (Prisma + PostgreSQL)

Schema (`prisma/schema.prisma`):

- **`AppUser`** — synced from Clerk (`clerkId`, email, name, image)
- **`Report`** — company snapshot, prompts JSON, full analysis JSON, timestamps

**Commands:**

```bash
pnpm prisma:deploy    # apply migrations (production / CI)
pnpm prisma:migrate   # create migrations in local dev
pnpm prisma:generate  # regenerate client (runs on postinstall)
```

For Supabase or other serverless Postgres, use the **transaction pooler** connection string (port `6543`).

---

## Caching and rate limits

**In-memory cache** (`lib/cache.ts`, per serverless instance):

| Bucket | TTL | Max entries |
|--------|-----|-------------|
| Prompt generation | 1 hour | 100 |
| Analysis | 1 hour | 100 |

Cache keys fingerprint company fields, prompts, analysis mode, and configured models. Responses include `X-Tunnel-Cache: hit|miss` headers.

**Note:** Cache and rate-limit counters are not shared across serverless instances — each cold start has its own store.

---

## Analytics (PostHog)

When `NEXT_PUBLIC_POSTHOG_KEY` is set, the app tracks:

| Event | When |
|-------|------|
| `form_submitted` | Audit form submitted |
| `prompts_generated` | Prompt generation completes |
| `analysis_started` / `analysis_completed` | Analysis lifecycle |
| `demo_mode_used` | Demo button clicked |
| `dashboard_viewed` | Dashboard loads (with source: stored/database/demo) |
| `export_clicked` | PDF export triggered |

Session recording is enabled with password field masking.

---

## Project structure

```
app/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Home / audit setup
│   ├── dashboard/          # Report dashboard
│   ├── reports/            # Report history
│   ├── sign-in/ sign-up/   # Clerk auth pages
│   └── api/                # Route handlers
├── components/             # React UI (dashboard panels, forms)
├── lib/                    # Business logic, AI clients, utilities
│   ├── gemini.ts           # Google Gemini client
│   ├── openai.ts           # OpenAI GPT-4o client
│   ├── anthropic.ts        # Anthropic Claude client
│   ├── analysis.ts         # Deterministic + LLM analysis
│   ├── aggregation.ts      # Visibility scores, recommendations
│   ├── cache.ts            # In-memory response cache
│   ├── api-security.ts     # Auth + rate limiting for API routes
│   ├── reports.ts          # Report serialization
│   └── llms-txt-markdown.ts
├── prisma/                 # Schema and migrations
├── types/index.ts          # Shared TypeScript types
├── proxy.ts                # Clerk middleware (Next.js 16 network boundary)
└── test/                   # Vitest setup
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server (`next dev --webpack`) |
| `pnpm build` | Production build |
| `pnpm start` | Production server |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit + integration tests |
| `pnpm prisma:deploy` | Apply database migrations |
| `pnpm prisma:migrate` | Create migrations (local dev) |
| `pnpm prisma:generate` | Regenerate Prisma client |

---

## Testing

```bash
pnpm test
```

**Test coverage includes:**

| Area | Files |
|------|-------|
| API route handlers | `app/api/route-handlers.test.ts` |
| Auth + rate limiting | `lib/api-security.test.ts` |
| Deterministic analysis | `lib/analysis.test.ts` |
| Aggregation / scoring | `lib/aggregation.test.ts` |
| JSON repair for LLM output | `lib/json-repair.test.ts` |
| Web citation extraction | `lib/provider-web-sources.test.ts` |
| Cache key separation | `lib/cache.test.ts` |
| Report session resolution | `lib/report-session.test.ts` |
| llms.txt markdown | `lib/llms-txt-markdown.test.ts` |
| Homepage fetch helpers | `lib/fetch-public-page-text.test.ts` |
| Dashboard smoke test | `components/TunnelDashboard.test.ts` |

See also [`TEST_PLAN.md`](../TEST_PLAN.md) for user-testing scenarios.

---

## Deployment

**Stack:** Next.js 16.2.4, React 19, Tailwind CSS 4, TypeScript 5, Prisma 7 + PostgreSQL.

**Required services:**

1. **Clerk** — authentication
2. **PostgreSQL** — report persistence (Supabase recommended)
3. At least one LLM API key for live analysis (Gemini recommended)

**Deploy checklist:**

1. Set all required environment variables on your hosting platform
2. Run `pnpm prisma:deploy` (or configure as a build/deploy step)
3. Ensure Node.js 20.19+ on the build runner
4. For Vercel/serverless: `/api/generate-llms-txt` needs `maxDuration = 60` support (Pro plan or equivalent)
5. Analysis routes can run 15–30+ seconds — verify platform timeout limits

**External dependencies (no API keys needed):**

- Clearbit / Brandfetch — company autocomplete (client-side)
- DuckDuckGo — company enrichment
- Google favicons — company logos
- User-provided homepage URLs — fetched server-side with SSRF protection

**Images:** `next.config.ts` allows remote favicons from `www.google.com/s2/favicons`.

---

## Limitations

- **Prototype scope** — not production-hardened; in-memory cache and rate limits do not scale across instances.
- **No global model override** — Gemini model is hardcoded; OpenAI/Anthropic models are configured in their respective client files.
- **Client-side report cache** — clearing browser storage removes the latest report until re-fetched from the database.
- **Web mode cost** — per-prompt web search across multiple models is slower and more expensive than standard mode.
- **llms.txt is a draft** — always review generated markdown before publishing; audit flags are suggestions, not verified facts.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Auth | Clerk (`@clerk/nextjs` v7) |
| Database | Prisma 7 + PostgreSQL |
| LLMs | Google Gemini, OpenAI GPT-4o, Anthropic Claude |
| Analytics | PostHog |
| Styling | Tailwind CSS 4 |
| Testing | Vitest 2 |
