# Tunnel — User Testing Plan

## Overview

**Tunnel** is an AI visibility intelligence platform. It helps companies understand how AI assistants (ChatGPT, Claude, Gemini) mention, rank, and represent them when real users ask questions about their category.

This test plan is designed to run during the Midpoint Review. Testers should spend **8–10 minutes** with the app. Team members will observe silently and take notes; testers do not need to fill out anything during the session.

---

## Target Audience

Tunnel is built for **founders, marketers, and product managers** at companies that care about being discovered online. The ideal tester is someone who has thought about SEO, brand positioning, or competitive research — but no technical background is required.

---

## Welcome & Orientation

### What to say at the start (read aloud or print)

> "Thanks so much for helping us out — we really appreciate it. Tunnel is built for founders and marketers who want to know how AI assistants like ChatGPT and Gemini talk about their company. Today you'll be exploring a report as if you were the founder of a wine app called Wine Find. Please think out loud as you go — tell us what you notice, what confuses you, and what you'd expect to happen. We won't be answering questions during the session; we want to see how the app does on its own. There are no wrong moves. After about 8 minutes we'll ask you a few quick questions."

---

## Session Setup

### Before the tester sits down
- Navigate to `/dashboard` and click "Use Demo Data" so the Wine Find report is already loaded
- PostHog is tracking all tester interactions passively in the background — no observer needed
- Have the feedback form link open on a separate device or printed sheet

---

## Test Scenarios

### Scenario A — Demo Dashboard (primary)

The tester lands directly on the pre-populated Wine Find report, simulating what a founder sees after their first full AI visibility audit.

**Pre-baked starting prompt:**
> "You're the founder of Wine Find, a wine pricing app. This is your Tunnel report showing how AI assistants talk about your company. Take a look and tell us what you'd do next."

**What to observe:**
- What do they look at first on the dashboard?
- Can they explain the Visibility Score in their own words?
- Do they notice the GPT-4o / Claude / Gemini tabs? Do they switch between them?
- Do they read the Missed Opportunities section? Do they find it useful?
- Do they scroll to Recommendations? Do they feel actionable?
- Do they understand what "Possible Inaccuracies" means?
- Where do they slow down or get confused?

---

### Scenario B — Live Analysis (if API keys are active)

Ask the tester to run a full analysis for a real company they're familiar with — their own startup, a company they've worked at, or a brand they know well.

If they can't think of one, suggest:
- Company Name: `Notion`
- Website: `notion.so`
- Description: `All-in-one workspace for notes, docs, wikis, and project management`
- Category: `productivity / note-taking apps`
- Competitors: `Obsidian, Confluence, Coda`
- Number of prompts: `10`

**What to observe:**
- Do they understand what each form field is asking for?
- Do they know what "competitors" means in this context?
- Do they understand what's happening during the loading step?
- Does the dashboard make sense after going through the full flow?

---

## UI Comparison (A/B Test)

Split testers across the two scenarios and compare their dashboard comprehension:

| Scenario A | Scenario B |
|------------|------------|
| Start directly on demo dashboard | Run a live analysis, then see dashboard |
| Tests: can users extract value from the report cold? | Tests: does going through the flow improve dashboard comprehension? |

---

## Feedback Mechanism

**Primary: PostHog passive data capture** (already implemented). PostHog records session replays and the following funnel events automatically in the background, with no tester action required:

| Event | What it captures |
|-------|-----------------|
| `dashboard_viewed` | Tester reached the dashboard (source: demo or stored) |
| `form_submitted` | Tester submitted the audit setup form |
| `prompts_generated` | Prompt generation succeeded or failed |
| `analysis_started` | Tester clicked Run Analysis |
| `analysis_completed` | Analysis finished (includes visibility score) |
| `demo_mode_used` | Tester used demo mode |
| `export_clicked` | Tester clicked Export PDF |

**Secondary: post-session survey** (5 questions, captures qualitative reactions PostHog can't). Hand this to the tester after they finish:

1. **In one sentence, what does Tunnel do?** *(open text)*
2. **How clear was the Visibility Score?** `1 (very confusing) → 5 (immediately obvious)`
3. **How actionable were the Recommendations?** `1 (not at all) → 5 (I'd act on these today)`
4. **What was the most confusing part of the experience?** *(open text)*
5. **If you ran a company, would you use this tool?** `Yes / Maybe / No — why?` *(open text)*

---

## Functional Checklist (observer tracks silently)

| Element | Expected behavior | Pass / Issue |
|---------|------------------|--------------|
| Dashboard loads | Report visible, no errors | |
| Model tabs visible | GPT-4o / Claude / Gemini tabs appear | |
| Model tab switch | Stats update without page reload | |
| Export button | Triggers download without error | |
| "New Analysis" link | Returns to landing page | |
| Form submission (Scenario B only) | Prompt generation starts within 2s | |
| Analysis completion (Scenario B only) | Dashboard renders after ~15–30s | |

---

## Intervention Policy

- **Do not answer questions** during the session. If asked, say: *"What would you expect to happen?"*
- **Intervene only if** the tester is completely stuck and idle for more than 60 seconds with visible frustration — in that case, say: *"Feel free to try the demo mode button if you'd like to skip ahead."*
- If the analysis errors out in Scenario B, silently switch to Scenario A.

---

## What We're Trying to Learn

| Question | How we'll learn it |
|----------|--------------------|
| Does the Visibility Score immediately communicate value? | Survey Q2 + observer notes |
| Is the multi-model comparison (GPT/Claude/Gemini) confusing or valuable? | Observer: do they use the tabs? |
| Do users find the Recommendations actionable? | Survey Q3 + observer notes |
| Do users understand Missed Opportunities vs Inaccuracies? | Observer notes on dashboard |
| Does going through the full flow (Scenario B) improve comprehension vs. cold demo (Scenario A)? | Compare survey Q2 scores across groups |
| Would users pay for / find value in this tool? | Survey Q5 |

---

## Post-Testing: Organizing Feedback

After all sessions, compile findings into GitHub Issues:

- Label bugs: `bug`
- Label UX confusion points: `ux`
- Label feature requests: `enhancement`
- Label copy/clarity issues: `copy`

Cross-reference PostHog session replays with observer notes to validate patterns.

---

## Timing Guide

| Phase | Time |
|-------|------|
| Welcome & orientation | 1 min |
| Exploring the app | 6–8 min |
| Post-session survey | 2–3 min |
| **Total per tester** | **~8–10 min** |
