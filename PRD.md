# AI Presence Intelligence Platform PRD

## Version

- 2026-04-12 Version 0.1 - Template created
- 2026-04-24 Version 1.0 - First complete draft

## Overview

As users increasingly rely on AI assistants instead of traditional search engines, companies lose visibility into how they are represented in AI-generated answers.

Mission:
- Empower companies to understand, measure, and improve how AI systems describe and recommend them.

Vision:
- Become the "Search Console for AI."

Product:
- Simulate real prompts.
- Query LLMs.
- Analyze responses.
- Surface actionable recommendations on visibility and positioning.

## Problem and Benefit

Problems:
- Companies do not know whether they appear in AI responses.
- AI systems can omit them, misrepresent them, or favor competitors.
- No standard tooling exists for AI-discovery analytics.

Benefits:
- Visibility into AI-driven discovery.
- Data-driven positioning strategy.
- Faster correction of misinformation.
- A repeatable AI SEO optimization loop.

## Opportunity

Market opportunity:
- Search to AI-assistant behavior shift is accelerating.
- Any company with online presence is impacted.

Project opportunity by June:
- MVP that can:
  - generate prompts
  - query multiple LLM APIs
  - analyze mentions, rank, competitor frequency
  - visualize insights

Impact targets:
- % visibility across prompt clusters
- competitor comparison by prompt type
- qualitative "how AI describes you" insights

## User Segments

Primary:
- Product and marketing teams
- Early-stage founders and indie builders

Core use cases:
- "Do I show up for prompts like this?"
- "How does AI describe my product?"
- "Why are competitors showing up more?"
- "How does performance differ by use case?"

## Value Proposition and Differentiators

Value proposition:
- Understand and optimize how AI systems talk about your product before customers do.

Differentiators:
1. AI-native visibility tracking.
2. Prompt-level insight by intent type.
3. Actionable diagnostics and recommendations.

Top product messages:
- See how AI talks about your product.
- Track where you show up and where you do not.
- Benchmark against competitors instantly.

## Functional Requirements

High-level:
- Prompt generation engine.
- LLM query engine.
- Mention and rank detection.
- Competitor detection.
- Dashboard visualization.

| Functionality | Segment 1 | Segment 2 | User Story | Priority |
| --- | --- | --- | --- | --- |
| Prompt generation engine | Yes | Yes | As a user, I want relevant prompts generated automatically. | High |
| LLM query engine | Yes | Yes | As a user, I want to simulate real AI responses. | High |
| Mention detection | Yes | Yes | As a user, I want to know if my product appears. | High |
| Competitor detection | Yes | Yes | As a user, I want to see who else appears. | High |
| Dashboard visualization | Yes | Yes | As a user, I want to interpret results quickly. | High |
| Rebrand/alias tracking | Yes | Yes | As a user, I want to see whether old and new names are still used. | High |
| Use-case visibility breakdown | Yes | Yes | As a user, I want to compare performance across intents. | High |

### Feature 1: Prompt Generation Engine

Problem:
- Users do not know which prompts to test.

Solution:
- Use templates + LLM expansion to generate prompts by type:
  - discovery
  - comparison
  - niche/differentiator
  - use-case

Priority:
- High

### Feature 2: LLM Query Engine

Problem:
- Manual testing is slow and inconsistent.

Solution:
- Query OpenAI and Anthropic APIs, normalize outputs, store response metadata.

Priority:
- High

### Feature 3: Insight Engine

Calculates:
- mention rate
- mention rank position
- competitor co-mentions
- segment-level strengths and gaps

Adds recommendations:
- where to improve content
- which prompt clusters underperform
- where competitors dominate

Priority:
- High
