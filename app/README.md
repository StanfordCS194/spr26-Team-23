# Tunnel

Tunnel is a comprehensive prototype that helps companies understand how AI assistants see and recommend them.

Tagline: **See how AI sees you**

It simulates realistic prompts, runs AI responses, analyzes visibility vs competitors, and shows actionable insights in a clean dashboard.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Add your Gemini API key in `app/.env.local`:
   ```bash
   GEMINI_API_KEY=your_key_here
   ```
   The app uses Google Gemini (`gemini-3-flash-preview`) for prompt generation and AI responses.
   You can override the model by setting `GEMINI_MODEL` in `app/.env.local`.
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000)

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
