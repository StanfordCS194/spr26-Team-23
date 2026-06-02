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
2. Add environment variables in `app/.env.local`:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   DATABASE_URL="postgres://prisma.[PROJECT-REF]:[PRISMA-PASSWORD]@[DB-REGION].pooler.supabase.com:5432/postgres"
   GEMINI_API_KEY=your_key_here
   ```
   The app uses Google Gemini (`gemini-3-flash-preview`) for prompt generation and AI responses.
   You can override the model by setting `GEMINI_MODEL` in `app/.env.local`.
3. Apply the Prisma migration to Supabase:
   ```bash
   pnpm prisma:deploy
   ```
   `DATABASE_URL` should point at your Supabase Postgres connection string. For serverless deployments, use Supabase's transaction pooler string on port `6543`.
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
