<img src="public/tunnel-logo.svg" alt="Tunnel logo" width="96" height="96" />

# Tunnel

Tunnel is a comprehensive prototype that helps companies understand how AI assistants see and recommend them.

Tagline: **See how AI sees you**

It simulates realistic prompts, runs AI responses, analyzes visibility vs competitors, and shows actionable insights in a clean dashboard.

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Add your Gemini API key in `app/.env.local`:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```
   The app uses Google Gemini (`gemini-3-flash-preview`) for prompt generation and AI responses.
   You can override the model by setting `GEMINI_MODEL` in `app/.env.local`.
3. Add your Clerk keys and local auth routes in `app/.env.local`:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
   ```
   Clerk wraps the app in `app/layout.tsx`, serves custom auth UI at `/sign-in` and `/sign-up`, and protects `/dashboard`, `/api/generate-prompts`, and `/api/analyze-prompts` through `proxy.ts`.
4. Run the app:
   ```bash
   pnpm dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Demo Mode

Use the **Use Demo Data** button on the input page to load a complete Wine Find report without any API calls.

Demo profile:
- Company: Wine Find
- Category: Wine Apps
- Description: Your personal sommelier. Find discover and share the best wines.
- Competitors: Vivino, CellarTracker

The demo intentionally shows:
- Low overall visibility (~25%)
- Strong niche pricing-query performance
- Vivino dominating discovery
- Clear missed opportunities
