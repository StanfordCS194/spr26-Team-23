# Customer Discovery Summary (Prototype)

## Target Audience Rationale

Primary target audience is new founders and early-stage builders (especially SaaS and consumer app founders).

Why this segment is a "desperate user":
- They depend heavily on organic discovery.
- They already invest in SEO and growth channels.
- They observe that end users increasingly ask ChatGPT/Claude instead of Google.
- They lack tooling to answer: "Am I being recommended by AI?"

## How We Built Domain Expertise

Methods:
- Reviewed founder forums, Product Hunt launch discussions, and founder social posts on AI + SEO.
- Analyzed real prompt patterns across discovery, comparison, and niche intent.
- Observed which products were surfaced by LLMs for the same category prompts.

Core insight:
- Founders care deeply about discoverability but currently have no AI-native discovery analytics.
- This mirrors the pre-SEO-tooling era.

## Real-Time Audience Interactions

Total real-time interactions: 6

| Person | Role | Company | Core Reaction |
| --- | --- | --- | --- |
| Vedaant | CEO | Wine Find | Expected low visibility, but prototype showed missing mentions in broad prompts. |
| Phoebe | AI/ML Engineer | Guava | Wants explicit rebrand tracking (Guava vs Gridspace). |
| Adi | Engineer | Versa | Needs prompt-level gaps where competitors appear but Versa does not. |
| Will | Engineer | Netic | Shows up in niche prompts; uncertain on broader category expansion strategy. |
| Vaish | Engineer | Pure Poker | Differentiator ("rake-free") is not consistently understood by LLMs. |
| Aman | Co-Founder | Cursor | Wants use-case-specific comparison, not just raw mention rate. |

## Prototype Tested and Measurement

Prototype shown: AI Presence Intelligence MVP that takes a company, runs prompt sets against LLMs, and returns:
- Visibility rate across prompts
- Mention rank position
- Competitor mentions
- Qualitative strengths, gaps, recommendations

Measurement approach:
- Instrumented output metrics: mention presence, rank position, competitor frequency.
- Subjective feedback captured after each run.

Data collected:
- Quantitative:
  - `% visibility` by prompt cluster (discovery/comparison/niche)
  - average position when mentioned
  - top competitor co-mentions
- Qualitative:
  - confidence level ("confirms suspicion", "worse than expected")
  - requested feature gaps (rebrand tracking, category-level breakdown)

## Tabular Display of Collected Data

| Company | Prompt Theme | Visibility Signal | Competitor Pattern | Key Learning |
| --- | --- | --- | --- | --- |
| Wine Find | Discovery + Pricing niche | Low in broad prompts, better in pricing niche | Vivino often dominant | Need broad-category content expansion. |
| Guava | Discovery + Rebrand | Inconsistent with rebrand terms | ElevenLabs commonly appears | Add alias/rebrand tracking feature. |
| Versa | Discovery + Comparison | Missing from key category prompts | Duolingo-family competitors visible | Add competitor gap diagnostics. |
| Netic | Niche + Expansion | Strong in niche, weak broad | Limited direct competition in niche | Clarify expand-vs-focus strategy. |
| Pure Poker | Discovery + Differentiator niche | Weak even on "rake-free" prompts | ClubWPT frequently appears | Strengthen differentiation signals in content. |
| Cursor | Discovery + Use-case | Often visible, varies by use-case | Copilot and other coding agents co-appear | Add use-case segmentation dashboard. |

## PRD Updates Based on Learnings

1. Add "Rebrand/Alias Tracking" as a must-have feature.
2. Add "Use-case breakdown" (e.g., debugging vs productivity vs quality).
3. Prioritize "Competitor gap diagnostics" that show where competitors appear and target does not.
4. Segment prompt generation into: discovery, comparison, niche, and use-case.
5. Add recommendations engine tied to prompt segments, not only global mention score.
