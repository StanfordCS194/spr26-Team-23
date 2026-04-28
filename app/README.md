# Tunnel

Tunnel is a comprehensive prototype that helps companies understand how AI assistants see and recommend them.

Tagline: **See how AI sees you**

It simulates realistic prompts, runs AI responses, analyzes visibility vs competitors, and shows actionable insights in a clean dashboard.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Add your OpenAI key in `app/.env.local`:
   ```bash
   OPENAI_API_KEY=your_key_here
   ```
3. Run the app:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000)

## Demo Mode

Use the **Use Demo Data** button on the input page to load a complete WineFind report without any API calls.

Demo profile:
- Company: WineFind
- Category: wine apps
- Description: compares restaurant wine prices to market prices
- Competitors: Vivino, CellarTracker

The demo intentionally shows:
- Low overall visibility (~25%)
- Strong niche pricing-query performance
- Vivino dominating discovery
- Clear missed opportunities
