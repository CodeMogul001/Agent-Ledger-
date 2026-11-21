import type { LlmCallLog } from '../types.ts';
import { buildPromptPreview, hashPrompt, normalizePrompt } from './analysis.ts';
import { estimateCallCostUsd } from './pricing.ts';

interface SeedTemplate {
  minutesAgo: number;
  model: string;
  prompt: string;
  promptTokens: number;
  completionTokens: number;
  sessionLabel: string;
  taskLabel: string;
  latencyMs: number;
}

const SAMPLE_AGENT_RUNS: SeedTemplate[] = [
  {
    minutesAgo: 46,
    model: 'gpt-4o',
    prompt: 'What is our enterprise refund policy for annual contracts cancelled within 30 days?',
    promptTokens: 112,
    completionTokens: 165,
    sessionLabel: 'sess_support_104',
    taskLabel: 'policy-lookup',
    latencyMs: 920,
  },
  {
    minutesAgo: 43,
    model: 'gpt-4o',
    prompt: 'What is our enterprise refund policy for annual contracts cancelled within 30 days?',
    promptTokens: 112,
    completionTokens: 162,
    sessionLabel: 'sess_support_104',
    taskLabel: 'policy-lookup',
    latencyMs: 880,
  },
  {
    minutesAgo: 38,
    model: 'gpt-4o',
    prompt: 'What is the enterprise refund policy for annual contracts canceled within 30 days?',
    promptTokens: 110,
    completionTokens: 158,
    sessionLabel: 'sess_support_107',
    taskLabel: 'policy-lookup',
    latencyMs: 940,
  },
  {
    minutesAgo: 31,
    model: 'gpt-4o',
    prompt: 'What is our enterprise refund policy for annual contracts cancelled within 30 days?',
    promptTokens: 112,
    completionTokens: 164,
    sessionLabel: 'sess_support_109',
    taskLabel: 'policy-lookup',
    latencyMs: 910,
  },
  {
    minutesAgo: 25,
    model: 'gpt-4o',
    prompt: 'What is our enterprise refund policy for annual contracts cancelled within 30 days?',
    promptTokens: 112,
    completionTokens: 160,
    sessionLabel: 'sess_support_112',
    taskLabel: 'policy-lookup',
    latencyMs: 870,
  },
  {
    minutesAgo: 41,
    model: 'claude-3-5-sonnet-20241022',
    prompt: 'Return the standard JSON schema fields required to create a Stripe invoice webhook handler.',
    promptTokens: 195,
    completionTokens: 280,
    sessionLabel: 'sess_codegen_201',
    taskLabel: 'schema-reference',
    latencyMs: 1140,
  },
  {
    minutesAgo: 34,
    model: 'claude-3-5-sonnet-20241022',
    prompt: 'Return the standard JSON schema fields needed to create a Stripe invoice webhook handler.',
    promptTokens: 192,
    completionTokens: 274,
    sessionLabel: 'sess_codegen_201',
    taskLabel: 'schema-reference',
    latencyMs: 1090,
  },
  {
    minutesAgo: 18,
    model: 'claude-3-5-sonnet-20241022',
    prompt: 'Return the standard JSON schema fields required to create a Stripe invoice webhook handler.',
    promptTokens: 195,
    completionTokens: 278,
    sessionLabel: 'sess_codegen_204',
    taskLabel: 'schema-reference',
    latencyMs: 1110,
  },
  {
    minutesAgo: 39,
    model: 'gpt-4o',
    prompt: 'Classify ticket sentiment as positive, neutral, or negative and return JSON: "The export CSV button hangs on Safari."',
    promptTokens: 48,
    completionTokens: 22,
    sessionLabel: 'sess_support_104',
    taskLabel: 'ticket-triage',
    latencyMs: 540,
  },
  {
    minutesAgo: 35,
    model: 'gpt-4o',
    prompt: 'Classify ticket sentiment as positive, neutral, or negative and return JSON: "Billing team resolved my invoice fast, thanks!"',
    promptTokens: 46,
    completionTokens: 21,
    sessionLabel: 'sess_support_107',
    taskLabel: 'ticket-triage',
    latencyMs: 510,
  },
  {
    minutesAgo: 29,
    model: 'gpt-4o',
    prompt: 'Classify ticket sentiment as positive, neutral, or negative and return JSON: "Still waiting three days for SSO certificate reset."',
    promptTokens: 49,
    completionTokens: 22,
    sessionLabel: 'sess_support_109',
    taskLabel: 'ticket-triage',
    latencyMs: 560,
  },
  {
    minutesAgo: 22,
    model: 'gpt-4o',
    prompt: 'Classify ticket sentiment as positive, neutral, or negative and return JSON: "How do I invite two read-only teammates?"',
    promptTokens: 45,
    completionTokens: 20,
    sessionLabel: 'sess_support_112',
    taskLabel: 'ticket-triage',
    latencyMs: 495,
  },
  {
    minutesAgo: 27,
    model: 'gpt-4-turbo',
    prompt: 'Extract customer company name and plan tier as JSON: "Acme Robotics upgraded to Scale tier yesterday."',
    promptTokens: 42,
    completionTokens: 26,
    sessionLabel: 'sess_crm_302',
    taskLabel: 'entity-extract',
    latencyMs: 780,
  },
  {
    minutesAgo: 15,
    model: 'gpt-4-turbo',
    prompt: 'Extract customer company name and plan tier as JSON: "Northstar Bio renewed annual Growth plan."',
    promptTokens: 40,
    completionTokens: 25,
    sessionLabel: 'sess_crm_305',
    taskLabel: 'entity-extract',
    latencyMs: 740,
  },
  {
    minutesAgo: 20,
    model: 'claude-3-5-sonnet-20241022',
    prompt: 'Analyze the attached 14-day PostgreSQL lock contention trace, correlate autovacuum windows with checkout latency spikes, and propose a zero-downtime index migration plan with rollback steps.',
    promptTokens: 2450,
    completionTokens: 890,
    sessionLabel: 'sess_codegen_201',
    taskLabel: 'root-cause-analysis',
    latencyMs: 3420,
  },
  {
    minutesAgo: 11,
    model: 'gemini-2.5-pro',
    prompt: 'Synthesize 6 customer interview transcripts on API rate-limit UX into prioritized product requirements with impact estimates and edge-case failure modes.',
    promptTokens: 3180,
    completionTokens: 1120,
    sessionLabel: 'sess_research_401',
    taskLabel: 'research-synthesis',
    latencyMs: 3910,
  },
  {
    minutesAgo: 14,
    model: 'gpt-4o-mini',
    prompt: 'Format this customer order summary into a concise 2-sentence Slack notification.',
    promptTokens: 135,
    completionTokens: 58,
    sessionLabel: 'sess_crm_302',
    taskLabel: 'slack-formatting',
    latencyMs: 320,
  },
  {
    minutesAgo: 8,
    model: 'gemini-2.5-flash',
    prompt: 'Route incoming webhook event to billing, auth, or onboarding queue based on event_type=invoice.payment_failed.',
    promptTokens: 84,
    completionTokens: 18,
    sessionLabel: 'sess_support_112',
    taskLabel: 'event-routing',
    latencyMs: 245,
  },
  {
    minutesAgo: 4,
    model: 'gpt-4o-mini',
    prompt: 'Normalize ISO-8601 timestamps and currency fields in the support escalation payload.',
    promptTokens: 210,
    completionTokens: 92,
    sessionLabel: 'sess_crm_305',
    taskLabel: 'payload-normalization',
    latencyMs: 360,
  },
];

export function generateCallId(): string {
  const randomPart = Math.floor(Math.random() * 0xffffffffff)
    .toString(16)
    .padStart(10, '0');
  return `call_${randomPart}`;
}

export function createSeedLogs(baseTimeMs = Date.now()): LlmCallLog[] {
  return SAMPLE_AGENT_RUNS.map((item) => {
    const timestamp = new Date(baseTimeMs - item.minutesAgo * 60_000).toISOString();
    const promptNormalized = normalizePrompt(item.prompt);
    return {
      id: generateCallId(),
      timestamp,
      model: item.model,
      endpoint: '/v1/chat/completions',
      promptPreview: buildPromptPreview(item.prompt),
      promptNormalized,
      promptHash: hashPrompt(promptNormalized),
      promptTokens: item.promptTokens,
      completionTokens: item.completionTokens,
      totalTokens: item.promptTokens + item.completionTokens,
      estimatedCostUsd: estimateCallCostUsd(item.model, item.promptTokens, item.completionTokens),
      sessionLabel: item.sessionLabel,
      taskLabel: item.taskLabel,
      latencyMs: item.latencyMs,
      statusCode: 200,
      isSimulated: true,
    };
  });
}
