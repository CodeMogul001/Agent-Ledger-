# AgentLedger — AI Cost Tracker & Agent Waste Proxy

A minimal, runnable OpenAI-compatible LLM proxy and cost-efficiency dashboard built to catch two common sources of agent spend waste:
1. **Repeated or near-identical prompts** fired across turns or sessions without memoization.
2. **Over-provisioned frontier models** (e.g. `gpt-4o`, `gpt-4-turbo`, `claude-3-5-sonnet`, `gemini-2.5-pro`) running on short, simple classification, extraction, or routing prompts.

---

## Quick Start

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Start the proxy and dashboard** on port `3000`:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser. On first boot, `data/logs.json` is initialized with a simulated multi-agent run so the dashboard is immediately populated.

---

## Pointing an Agent at the Proxy

The server exposes drop-in OpenAI-compatible endpoints:
- `POST /v1/chat/completions` (supports both JSON and `stream: true` SSE passthrough)
- `POST /v1/completions`
- `GET /v1/models`

Configure your OpenAI SDK client to use `http://localhost:3000/v1` as `baseURL` and pass optional attribution headers:

### Node / TypeScript (`openai` SDK)
```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'http://localhost:3000/v1',
  defaultHeaders: {
    'x-agent-session': 'sess_support_104',
    'x-agent-task': 'policy-lookup',
  },
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is our enterprise refund policy?' }],
});
```

### Python (`openai` SDK)
```python
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="http://localhost:3000/v1",
    default_headers={
        "x-agent-session": "sess_support_104",
        "x-agent-task": "policy-lookup",
    },
)
```

### Upstream Forwarding & Headers
- **Authorization**: Pass your normal `Authorization: Bearer ...` header, or configure `OPENAI_API_KEY` / `GEMINI_API_KEY` in the server environment.
- **Custom Upstream**: Set `UPSTREAM_BASE_URL` in `.env` or send `x-upstream-url: https://your-provider.example/v1` per request.
- **Tagging**: Use `x-agent-session` / `x-agent-task` headers (or `metadata.session` / `metadata.task` in the request body). You can also re-tag any logged call inline from the **Request Logs** view.
- **Local Simulation Header**: For offline testing without an external API key, pass `x-proxy-simulate: true` (used by the built-in **Proxy Setup -> Send Proxy Request** form).

---

## How Waste Detection Works

- **Repeated / Similar Prompts**: Prompts are normalized and compared using a combined token Jaccard + character bigram Dice similarity score (`>= 0.72`). Clusters of 2+ matching calls show total spend, estimated deduplication savings, and expandable prompt evidence.
- **Wrong Model Detection**: Frontier-tier models invoked on short, simple prompts (`<= 180` input tokens, `<= 140` output tokens, or short classification/extraction tasks) are grouped by `(model, task)` and compared against lightweight alternatives (`gpt-4o-mini`, `claude-3-5-haiku`, `gemini-2.5-flash`).
- **Cost per Task & Session**: Calculated automatically from distinct `x-agent-task` and `x-agent-session` tags, with inline **"Set tasks"** and **"Set sessions"** controls on the KPI bar for quick demo overrides.

---

## Project Structure

- `server.ts` — Express server hosting `/v1/*` OpenAI-compatible proxy routes, `/api/*` dashboard endpoints, and Vite middleware.
- `server/pricing.ts` — Per-1M-token pricing table and cost estimation helpers.
- `server/analysis.ts` — Prompt normalization, similarity clustering, model mismatch rules, and session/task aggregation.
- `server/store.ts` — Local JSON persistence (`data/logs.json`, `data/settings.json`) and sample agent run generator.
- `src/` — React + Tailwind dashboard (`KpiStrip`, `WasteSection`, `BreakdownPanels`, `LogsView`, `ProxySetupView`).
