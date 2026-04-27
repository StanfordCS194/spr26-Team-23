# App

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## AI Presence Prototype

This prototype lets you:
- enter a company + category + competitors
- run prompt-based analysis against selected model providers
- view visibility, mention rank, competitor frequency, and recommendations

### Optional API keys

If keys are not provided, the app uses a deterministic simulation mode.

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `TOGETHER_API_KEY`

Optional Together model override:
- `TOGETHER_MODEL` (optional override)
- Default behavior:
  - fetch available Together models dynamically from your account
  - try serverless models first
  - fallback to `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`

If `TOGETHER_MODEL` is set but fails, the app automatically falls back to the default serverless models above.

The results panel now includes provider status:
- `live` responses = real provider output
- `mock` responses = deterministic fallback output used when provider call fails
